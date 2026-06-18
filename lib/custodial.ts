import { randomBytes } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  custodialLedger,
  loyaltyLedger,
  paymentDeposits,
  unlocks,
  userBalances,
  users,
} from "./db/schema";
import { POINTS_PER_UNLOCK } from "./constants";

export const CUSTODIAL_ACCOUNT_COOKIE = "veil_account";

export type CustodialAccount = {
  userId: string;
  availableBalance: string;
  escrowedBalance: string;
};

export type CustodialUnlockResult =
  | { status: "already_unlocked"; txHash?: string }
  | { status: "unlocked"; txHash: string; balance: string }
  | { status: "insufficient_funds"; balance: string; required: string };

function internalAddress() {
  return `0x${randomBytes(20).toString("hex")}`;
}

function internalReference(prefix: string) {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}

function internalTxHash() {
  return `0x${randomBytes(32).toString("hex")}`;
}

export function normalizeMoney(input: unknown): string {
  const raw = typeof input === "string" ? input.trim() : String(input ?? "");
  if (!/^\d{1,6}(\.\d{1,8})?$/.test(raw)) {
    throw new Error("Invalid amount");
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid amount");
  }

  return value.toFixed(8);
}

export async function createCustodialAccount(): Promise<CustodialAccount> {
  return getDb().transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ walletAddress: internalAddress() })
      .returning();

    const [balance] = await tx
      .insert(userBalances)
      .values({ userId: user.id })
      .returning();

    return {
      userId: user.id,
      availableBalance: balance.availableBalance,
      escrowedBalance: balance.escrowedBalance,
    };
  });
}

export async function getCustodialAccount(
  userId: string | undefined,
): Promise<CustodialAccount | null> {
  if (!userId) return null;

  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;

  const balance = await db.query.userBalances.findFirst({
    where: eq(userBalances.userId, user.id),
  });

  if (!balance) {
    const [created] = await db
      .insert(userBalances)
      .values({ userId: user.id })
      .onConflictDoNothing()
      .returning();

    return {
      userId: user.id,
      availableBalance: created?.availableBalance ?? "0",
      escrowedBalance: created?.escrowedBalance ?? "0",
    };
  }

  return {
    userId: user.id,
    availableBalance: balance.availableBalance,
    escrowedBalance: balance.escrowedBalance,
  };
}

export async function getOrCreateCustodialAccount(userId: string | undefined) {
  return (await getCustodialAccount(userId)) ?? createCustodialAccount();
}

export async function recordPendingCardDeposit({
  userId,
  amount,
  currency,
  providerSessionId,
}: {
  userId: string;
  amount: string;
  currency: string;
  providerSessionId: string;
}) {
  await getDb()
    .insert(paymentDeposits)
    .values({
      userId,
      provider: "stripe_onramp",
      amount,
      currency: currency.toLowerCase(),
      providerSessionId,
      status: "pending",
    })
    .onConflictDoNothing();
}

export async function creditCardDeposit({
  userId,
  amount,
  currency,
  providerSessionId,
  providerPaymentIntentId,
}: {
  userId: string;
  amount: string;
  currency: string;
  providerSessionId: string;
  providerPaymentIntentId?: string;
}) {
  return getDb().transaction(async (tx) => {
    await tx
      .insert(paymentDeposits)
      .values({
        userId,
        provider: "stripe_onramp",
        amount,
        currency: currency.toLowerCase(),
        providerSessionId,
        providerPaymentIntentId,
        status: "pending",
      })
      .onConflictDoNothing();

    const [deposit] = await tx
      .update(paymentDeposits)
      .set({
        providerPaymentIntentId,
        status: "succeeded",
        creditedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentDeposits.providerSessionId, providerSessionId),
          eq(paymentDeposits.status, "pending"),
        ),
      )
      .returning();

    if (!deposit) {
      const current = await tx.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      return {
        status: "already_processed" as const,
        availableBalance: current?.availableBalance ?? "0",
      };
    }

    await tx.insert(userBalances).values({ userId }).onConflictDoNothing();

    const [balance] = await tx
      .update(userBalances)
      .set({
        availableBalance: sql`${userBalances.availableBalance} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(userBalances.userId, userId))
      .returning();

    await tx.insert(custodialLedger).values({
      userId,
      eventType: "deposit",
      amount,
      balanceAfter: balance.availableBalance,
      reference: `stripe:${providerSessionId}`,
    });

    return {
      status: "credited" as const,
      availableBalance: balance.availableBalance,
    };
  });
}

export async function withdrawCustodialBalance(userId: string, amount: string) {
  return getDb().transaction(async (tx) => {
    const [balance] = await tx
      .update(userBalances)
      .set({
        availableBalance: sql`${userBalances.availableBalance} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userBalances.userId, userId),
          sql`${userBalances.availableBalance} >= ${amount}`,
        ),
      )
      .returning();

    if (!balance) {
      const current = await tx.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      return {
        status: "insufficient_funds" as const,
        availableBalance: current?.availableBalance ?? "0",
      };
    }

    await tx.insert(custodialLedger).values({
      userId,
      eventType: "withdrawal",
      amount: `-${amount}`,
      balanceAfter: balance.availableBalance,
      reference: internalReference("withdrawal"),
    });

    return {
      status: "withdrawn" as const,
      availableBalance: balance.availableBalance,
      escrowedBalance: balance.escrowedBalance,
    };
  });
}

export async function unlockWithCustodialBalance({
  userId,
  postId,
  amount,
  settlementMs,
}: {
  userId: string;
  postId: string;
  amount: string;
  settlementMs: number;
}): Promise<CustodialUnlockResult> {
  return getDb().transaction(async (tx) => {
    const existing = await tx.query.unlocks.findFirst({
      where: and(eq(unlocks.fanId, userId), eq(unlocks.postId, postId)),
    });
    if (existing) {
      return {
        status: "already_unlocked",
        txHash: existing.paymentTxHash,
      };
    }

    await tx.insert(userBalances).values({ userId }).onConflictDoNothing();

    const [balance] = await tx
      .update(userBalances)
      .set({
        availableBalance: sql`${userBalances.availableBalance} - ${amount}`,
        escrowedBalance: sql`${userBalances.escrowedBalance} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userBalances.userId, userId),
          sql`${userBalances.availableBalance} >= ${amount}`,
        ),
      )
      .returning();

    if (!balance) {
      const current = await tx.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      return {
        status: "insufficient_funds",
        balance: current?.availableBalance ?? "0",
        required: amount,
      };
    }

    const txHash = internalTxHash();

    await tx.insert(custodialLedger).values({
      userId,
      eventType: "unlock_debit",
      amount: `-${amount}`,
      balanceAfter: balance.availableBalance,
      postId,
      reference: txHash,
    });

    const [unlock] = await tx
      .insert(unlocks)
      .values({
        fanId: userId,
        postId,
        paymentTxHash: txHash,
        amountPaid: amount,
        settlementMs,
      })
      .returning();

    await tx.insert(loyaltyLedger).values({
      userId,
      amount: String(POINTS_PER_UNLOCK),
      eventType: "post_unlock",
      referenceId: unlock.id,
      txHash,
    });

    return {
      status: "unlocked",
      txHash,
      balance: balance.availableBalance,
    };
  });
}
