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

/** A creator's own posts, newest first — used to attach a PPV card in a DM. */
export async function getPostsByCreator(creatorId: string, limit = 30) {
  const db = getDb();
  return db.query.posts.findMany({
    where: eq(posts.creatorId, creatorId),
    orderBy: [desc(posts.createdAt)],
    limit,
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

/**
 * Persist editable profile fields. Only keys present in `patch` are written, so
 * a username-only edit never clobbers the avatar. `username` is uniquely
 * indexed — a collision surfaces as a Postgres unique-violation for the caller
 * to translate into a 409.
 */
export async function updateUserProfile(
  walletAddress: string,
  patch: { username?: string | null; avatar?: string | null },
) {
  const db = getDb();
  const set: Partial<typeof users.$inferInsert> = {};
  if (patch.username !== undefined) set.username = patch.username;
  if (patch.avatar !== undefined) set.avatar = patch.avatar;
  const [user] = await db
    .update(users)
    .set(set)
    .where(eq(users.walletAddress, walletAddress.toLowerCase()))
    .returning();
  return user;
}

/**
 * The fan's collection — every post they've unlocked, newest first. Returns the
 * private media key so the caller can presign the real (unblurred) media: this
 * is the reward for having paid.
 */
export async function getUnlockedPosts(fanId: string, limit = 24) {
  const db = getDb();
  return db
    .select({
      postId: posts.id,
      title: posts.title,
      privateMediaKey: posts.privateMediaKey,
      blurredPreviewUrl: posts.blurredPreviewUrl,
      mediaType: posts.mediaType,
      unlockPrice: posts.unlockPrice,
      unlockedAt: unlocks.unlockedAt,
      creatorUsername: users.username,
    })
    .from(unlocks)
    .innerJoin(posts, eq(unlocks.postId, posts.id))
    .innerJoin(users, eq(posts.creatorId, users.id))
    .where(eq(unlocks.fanId, fanId))
    .orderBy(desc(unlocks.unlockedAt))
    .limit(limit);
}

/**
 * Notifications, derived (no dedicated table): the incoming unlock events on
 * *this user's* posts — i.e. "someone unveiled your post". Each carries the
 * actor, the post, the gross amount paid, and when. The creator-cut split is
 * applied by the caller (see /api/notifications).
 */
export async function getNotifications(userId: string, limit = 30) {
  const db = getDb();
  return db
    .select({
      id: unlocks.id,
      amountPaid: unlocks.amountPaid,
      unlockedAt: unlocks.unlockedAt,
      postId: posts.id,
      postTitle: posts.title,
      actorUsername: users.username,
      actorWallet: users.walletAddress,
      actorAvatar: users.avatar,
    })
    .from(unlocks)
    .innerJoin(posts, eq(unlocks.postId, posts.id))
    .innerJoin(users, eq(unlocks.fanId, users.id))
    .where(eq(posts.creatorId, userId))
    .orderBy(desc(unlocks.unlockedAt))
    .limit(limit);
}
