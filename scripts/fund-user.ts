import { createCipheriv, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import {
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  pad,
  stringToHex,
  erc20Abi,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Chain } from "viem/tempo";
import { getDb } from "../lib/db";
import { getPgPool } from "../lib/db/pool";
import { custodialLedger, custodialWallets, userBalances, users } from "../lib/db/schema";
import { getPlatformClient } from "../lib/tempo-server";
import { ALPHA_USD, STABLECOIN_DECIMALS, TEMPO_TESTNET } from "../lib/constants";

const ENCRYPTION_SECRET_ENV = "CUSTODIAL_KEY_ENCRYPTION_SECRET";
const EMAIL = process.argv[2] ?? "12345678910.kerem@gmail.com";
const AMOUNT = process.argv[3] ?? "10"; // local credit (USD)
const RESERVE = process.env.USER_WALLET_FEE_RESERVE_USD ?? "0.10";

function encryptionKey() {
  const raw = process.env[ENCRYPTION_SECRET_ENV];
  if (!raw) throw new Error(`${ENCRYPTION_SECRET_ENV} is not set`);
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error(`${ENCRYPTION_SECRET_ENV} must be a base64 32-byte key`);
  return key;
}

function encryptPrivateKey(pk: `0x${string}`) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(pk, "utf8"), cipher.final()]);
  return {
    encryptedPrivateKey: enc.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

const rpc = process.env.TEMPO_RPC_URL ?? TEMPO_TESTNET.rpcHttp;
const pub = createPublicClient({ chain: Chain.moderato, transport: http(rpc) });

async function balance(addr: string) {
  const b = (await pub.readContract({
    address: ALPHA_USD,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [addr as `0x${string}`],
  })) as bigint;
  return formatUnits(b, STABLECOIN_DECIMALS);
}

async function main() {
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.email, EMAIL) });
  if (!user) throw new Error(`no user with email ${EMAIL}`);

  // 1. Ensure custodial wallet.
  let wallet = await db.query.custodialWallets.findFirst({
    where: eq(custodialWallets.userId, user.id),
  });
  if (!wallet) {
    const pk = generatePrivateKey();
    const account = privateKeyToAccount(pk);
    [wallet] = await db
      .insert(custodialWallets)
      .values({ userId: user.id, address: account.address, ...encryptPrivateKey(pk) })
      .returning();
    console.log(`created custodial wallet ${wallet.address}`);
  }

  console.log(`user: ${EMAIL} (${user.id})`);
  console.log(`wallet ${wallet.address} before: ${await balance(wallet.address)} AlphaUSD`);

  // 2. Fund the custodial wallet on-chain (deposit + fee reserve), platform-signed.
  const client = getPlatformClient();
  if (!client) throw new Error("PLATFORM_PRIVATE_KEY not set");
  const fundUsd = (Number(AMOUNT) + Number(RESERVE)).toFixed(STABLECOIN_DECIMALS);
  const memo = pad(stringToHex("topup:manual-fund"), { size: 32 });
  const result = await client.token.transferSync({
    to: wallet.address as `0x${string}`,
    amount: parseUnits(fundUsd, STABLECOIN_DECIMALS),
    token: ALPHA_USD,
    memo,
  });
  console.log(`funded ${fundUsd} AlphaUSD  tx=${result.receipt?.transactionHash} status=${result.receipt?.status}`);
  console.log(`wallet ${wallet.address} after:  ${await balance(wallet.address)} AlphaUSD`);

  // 3. Credit the local app ledger by the deposit amount.
  const credit = Number(AMOUNT).toFixed(8);
  await db.insert(userBalances).values({ userId: user.id }).onConflictDoNothing();
  const [bal] = await db
    .update(userBalances)
    .set({ availableBalance: sql`${userBalances.availableBalance} + ${credit}`, updatedAt: new Date() })
    .where(eq(userBalances.userId, user.id))
    .returning();
  await db.insert(custodialLedger).values({
    userId: user.id,
    eventType: "deposit",
    amount: credit,
    balanceAfter: bal.availableBalance,
    reference: `manual:${randomBytes(8).toString("hex")}`,
  });
  console.log(`local available balance now: ${bal.availableBalance}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPgPool().end();
    } catch {
      /* never opened */
    }
  });
