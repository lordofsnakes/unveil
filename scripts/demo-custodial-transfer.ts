import { createDecipheriv } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  pad,
  stringToHex,
  erc20Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Chain, tempoActions } from "viem/tempo";
import { getDb } from "../lib/db";
import { getPgPool } from "../lib/db/pool";
import { custodialWallets, users } from "../lib/db/schema";
import { ALPHA_USD, STABLECOIN_DECIMALS, TEMPO_TESTNET } from "../lib/constants";

const ENCRYPTION_SECRET_ENV = "CUSTODIAL_KEY_ENCRYPTION_SECRET";
const DEV_CLERK_ID = "dev_default_user";
const AMOUNT_USD = process.argv[2] ?? "1.00";

function encryptionKey() {
  const raw = process.env[ENCRYPTION_SECRET_ENV];
  if (!raw) throw new Error(`${ENCRYPTION_SECRET_ENV} is not set`);
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error(`${ENCRYPTION_SECRET_ENV} must be a base64 32-byte key`);
  return key;
}

function decryptPrivateKey(w: { encryptedPrivateKey: string; iv: string; authTag: string }) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(w.iv, "base64"));
  decipher.setAuthTag(Buffer.from(w.authTag, "base64"));
  const out = Buffer.concat([
    decipher.update(Buffer.from(w.encryptedPrivateKey, "base64")),
    decipher.final(),
  ]).toString("utf8");
  if (!/^0x[0-9a-fA-F]{64}$/.test(out)) throw new Error("decrypted key malformed");
  return out as `0x${string}`;
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
  const to = process.env.PLATFORM_WALLET_ADDRESS as `0x${string}` | undefined;
  if (!to) throw new Error("PLATFORM_WALLET_ADDRESS not set");

  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, DEV_CLERK_ID) });
  if (!user) throw new Error(`dev user (${DEV_CLERK_ID}) not found`);
  const wallet = await db.query.custodialWallets.findFirst({
    where: eq(custodialWallets.userId, user.id),
  });
  if (!wallet) throw new Error("dev user has no custodial wallet");

  const account = privateKeyToAccount(decryptPrivateKey(wallet));
  console.log(`Signing from custodied key for ${account.address}`);
  console.log(`  user wallet  before: ${await balance(account.address)}`);
  console.log(`  platform     before: ${await balance(to)}`);

  const chain = Chain.moderato.extend({ feeToken: ALPHA_USD });
  const client = createWalletClient({ account, chain, transport: http(rpc) }).extend(tempoActions());
  const memo = pad(stringToHex("demo:custody-test"), { size: 32 });

  const result = await client.token.transferSync({
    to,
    amount: parseUnits(Number(AMOUNT_USD).toFixed(STABLECOIN_DECIMALS), STABLECOIN_DECIMALS),
    token: ALPHA_USD,
    memo,
  });

  console.log(`\nSent ${AMOUNT_USD} AlphaUSD  user -> platform`);
  console.log(`  txHash: ${result.receipt?.transactionHash}`);
  console.log(`  status: ${result.receipt?.status}`);
  console.log(`\n  user wallet  after:  ${await balance(account.address)}`);
  console.log(`  platform     after:  ${await balance(to)}`);
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
