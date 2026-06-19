import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ALPHA_USD, STABLECOIN_DECIMALS, TEMPO_TESTNET } from "./constants";
import { getDb } from "./db";
import { custodialWallets } from "./db/schema";

const ENCRYPTION_SECRET_ENV = "CUSTODIAL_KEY_ENCRYPTION_SECRET";

function getEncryptionKey() {
  const raw = process.env[ENCRYPTION_SECRET_ENV];
  if (!raw) throw new Error(`${ENCRYPTION_SECRET_ENV} is not set`);

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`${ENCRYPTION_SECRET_ENV} must be a base64-encoded 32-byte key`);
  }

  return key;
}

function encryptPrivateKey(privateKey: `0x${string}`) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKey, "utf8"),
    cipher.final(),
  ]);

  return {
    encryptedPrivateKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptPrivateKey({
  encryptedPrivateKey,
  iv,
  authTag,
}: {
  encryptedPrivateKey: string;
  iv: string;
  authTag: string;
}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPrivateKey, "base64")),
    decipher.final(),
  ]).toString("utf8");

  if (!/^0x[0-9a-fA-F]{64}$/.test(decrypted)) {
    throw new Error("Decrypted user wallet key is malformed");
  }

  return decrypted as `0x${string}`;
}

export async function getOrCreateCustodialWallet(userId: string) {
  const db = getDb();
  const existing = await db.query.custodialWallets.findFirst({
    where: eq(custodialWallets.userId, userId),
  });
  if (existing) return existing;

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const encrypted = encryptPrivateKey(privateKey);
  const [created] = await db
    .insert(custodialWallets)
    .values({
      userId,
      address: account.address,
      ...encrypted,
    })
    .returning();
  return created;
}

export type CustodialSettlementResult =
  | { ok: true; txHash?: string; walletAddress: string }
  | { ok: false; reason: string };

export async function settleUnlockWithCustodialWallet({
  userId,
  amountUsd,
  reference,
}: {
  userId: string;
  amountUsd: string;
  reference: string;
}): Promise<CustodialSettlementResult> {
  const to = process.env.PLATFORM_WALLET_ADDRESS as `0x${string}` | undefined;
  if (!to) return { ok: false, reason: "PLATFORM_WALLET_ADDRESS is not set" };

  try {
    const wallet = await getOrCreateCustodialWallet(userId);
    const privateKey = decryptPrivateKey(wallet);
    const account = privateKeyToAccount(privateKey);
    const [{ createWalletClient, http, pad, parseUnits, stringToHex }, { Chain, tempoActions }] =
      await Promise.all([import("viem"), import("viem/tempo")]);
    const chain = Chain.moderato.extend({ feeToken: ALPHA_USD });
    const client = createWalletClient({
      account,
      chain,
      transport: http(process.env.TEMPO_RPC_URL ?? TEMPO_TESTNET.rpcHttp),
    }).extend(tempoActions());

    const memo = pad(stringToHex(`unlock:${reference.slice(0, 12)}`), {
      size: 32,
    });
    const result = await client.token.transferSync({
      to,
      amount: parseUnits(amountUsd, STABLECOIN_DECIMALS),
      token: ALPHA_USD,
      memo,
    });

    return {
      ok: true,
      txHash: result.receipt?.transactionHash,
      walletAddress: wallet.address,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "settlement failed",
    };
  }
}
