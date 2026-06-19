import { createCipheriv, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getDb } from "../lib/db";
import { getPgPool } from "../lib/db/pool";
import {
  custodialLedger,
  custodialWallets,
  loyaltyLedger,
  paymentDeposits,
  unlocks,
  userBalances,
  users,
} from "../lib/db/schema";

const ENCRYPTION_SECRET_ENV = "CUSTODIAL_KEY_ENCRYPTION_SECRET";

type Summary = {
  usersScanned: number;
  walletsCreated: number;
  balancesReset: number;
  custodialLedgerRowsCleared: number;
  paymentDepositRowsCleared: number;
  unlockRowsCleared: number;
  loyaltyRowsCleared: number;
};

const VALID_MODES = new Set(["--backfill-wallets", "--reset-test-ledger"]);

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

async function getTempoWalletAddress(userId: string) {
  const wallet = await getDb().query.custodialWallets.findFirst({
    where: eq(custodialWallets.userId, userId),
    columns: { address: true },
  });
  return wallet?.address ?? null;
}

async function ensureTempoWalletForMigration(userId: string) {
  const existingAddress = await getTempoWalletAddress(userId);
  if (existingAddress) return { address: existingAddress, created: false };

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const encrypted = encryptPrivateKey(privateKey);
  await getDb().insert(custodialWallets).values({
    userId,
    address: account.address,
    ...encrypted,
  });
  return { address: account.address, created: true };
}

function requestedModes() {
  const modes = process.argv.slice(2).filter((arg) => arg.startsWith("--"));
  const unknown = modes.filter((mode) => !VALID_MODES.has(mode));
  if (unknown.length > 0 || modes.length === 0) {
    console.error(
      "Usage: tsx scripts/migrate-tempo-wallets.ts --backfill-wallets [--reset-test-ledger]",
    );
    if (unknown.length > 0) console.error(`Unknown mode(s): ${unknown.join(", ")}`);
    process.exit(1);
  }
  return new Set(modes);
}

async function backfillWallets(summary: Summary) {
  const db = getDb();
  const rows = await db.select({ id: users.id }).from(users);
  summary.usersScanned = rows.length;

  for (const user of rows) {
    const wallet = await ensureTempoWalletForMigration(user.id);
    if (wallet.created) summary.walletsCreated += 1;
  }
}

async function resetTestLedger(summary: Summary) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_TEST_LEDGER_RESET !== "true"
  ) {
    throw new Error(
      "--reset-test-ledger is refused in production unless ALLOW_TEST_LEDGER_RESET=true",
    );
  }

  const db = getDb();
  const loyaltyRows = await db
    .delete(loyaltyLedger)
    .where(eq(loyaltyLedger.eventType, "post_unlock"))
    .returning({ id: loyaltyLedger.id });
  const unlockRows = await db.delete(unlocks).returning({ id: unlocks.id });
  const ledgerRows = await db
    .delete(custodialLedger)
    .returning({ id: custodialLedger.id });
  const depositRows = await db
    .delete(paymentDeposits)
    .returning({ id: paymentDeposits.id });
  const balanceRows = await db
    .update(userBalances)
    .set({
      availableBalance: "0",
      escrowedBalance: "0",
      updatedAt: new Date(),
    })
    .returning({ userId: userBalances.userId });

  summary.loyaltyRowsCleared = loyaltyRows.length;
  summary.unlockRowsCleared = unlockRows.length;
  summary.custodialLedgerRowsCleared = ledgerRows.length;
  summary.paymentDepositRowsCleared = depositRows.length;
  summary.balancesReset = balanceRows.length;
}

async function main() {
  const modes = requestedModes();
  const summary: Summary = {
    usersScanned: 0,
    walletsCreated: 0,
    balancesReset: 0,
    custodialLedgerRowsCleared: 0,
    paymentDepositRowsCleared: 0,
    unlockRowsCleared: 0,
    loyaltyRowsCleared: 0,
  };

  if (modes.has("--backfill-wallets")) await backfillWallets(summary);
  if (modes.has("--reset-test-ledger")) await resetTestLedger(summary);

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPgPool().end();
    } catch {
      /* database was never opened */
    }
  });
