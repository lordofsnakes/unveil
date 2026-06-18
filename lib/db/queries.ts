import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "./index";
import { users, posts, unlocks, loyaltyLedger } from "./schema";

export async function upsertUser(walletAddress: string) {
  const db = getDb();
  const addr = walletAddress.toLowerCase();
  const [user] = await db
    .insert(users)
    .values({ walletAddress: addr })
    .onConflictDoUpdate({
      target: users.walletAddress,
      set: { walletAddress: addr },
    })
    .returning();
  return user;
}

/** Upsert a user and mark them a creator (idempotent). */
export async function upsertCreator(walletAddress: string) {
  const db = getDb();
  const addr = walletAddress.toLowerCase();
  const [user] = await db
    .insert(users)
    .values({ walletAddress: addr, isCreator: true })
    .onConflictDoUpdate({
      target: users.walletAddress,
      set: { isCreator: true },
    })
    .returning();
  return user;
}

export async function getFeed(limit = 20, offset = 0) {
  const db = getDb();
  return db.query.posts.findMany({
    where: eq(posts.isPublished, true),
    with: { creator: true },
    orderBy: [desc(posts.createdAt)],
    limit,
    offset,
  });
}

export async function getPost(postId: string) {
  const db = getDb();
  return db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: { creator: true },
  });
}

export async function getUserByWallet(walletAddress: string) {
  const db = getDb();
  return db.query.users.findFirst({
    where: eq(users.walletAddress, walletAddress.toLowerCase()),
  });
}

export async function hasUnlocked(fanId: string, postId: string) {
  const db = getDb();
  const row = await db.query.unlocks.findFirst({
    where: and(eq(unlocks.fanId, fanId), eq(unlocks.postId, postId)),
  });
  return !!row;
}

export async function recordUnlock(
  fanId: string,
  postId: string,
  paymentTxHash: string,
  amountPaid: string,
  settlementMs: number,
  loyaltyAmount: string,
) {
  // Use Pool (WebSocket) for the multi-statement transaction.
  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle: drizzleWs } = await import("drizzle-orm/neon-serverless");
  const schema = await import("./schema");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const txDb = drizzleWs(pool, { schema });

  try {
    return await txDb.transaction(async (tx) => {
      const [unlock] = await tx
        .insert(unlocks)
        .values({ fanId, postId, paymentTxHash, amountPaid, settlementMs })
        .returning();
      await tx.insert(loyaltyLedger).values({
        userId: fanId,
        amount: loyaltyAmount,
        eventType: "post_unlock",
        referenceId: unlock.id,
        txHash: paymentTxHash,
      });
      return unlock;
    });
  } finally {
    await pool.end();
  }
}

export async function getUserStats(userId: string) {
  const db = getDb();
  const [r] = await db
    .select({
      unlockCount: sql<number>`COUNT(*)`,
      totalPaid: sql<string>`COALESCE(SUM(${unlocks.amountPaid}), 0)`,
      avgSettleMs: sql<number>`COALESCE(ROUND(AVG(${unlocks.settlementMs})), 0)`,
    })
    .from(unlocks)
    .where(eq(unlocks.fanId, userId));
  return {
    unlockCount: Number(r?.unlockCount ?? 0),
    totalPaid: r?.totalPaid ?? "0",
    avgSettleMs: Number(r?.avgSettleMs ?? 0),
  };
}

export async function getLoyaltyBalance(userId: string): Promise<string> {
  const db = getDb();
  const [r] = await db
    .select({
      bal: sql<string>`COALESCE(SUM(${loyaltyLedger.amount}), 0)`,
    })
    .from(loyaltyLedger)
    .where(eq(loyaltyLedger.userId, userId));
  return r?.bal ?? "0";
}
