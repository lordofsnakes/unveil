import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { posts, unlocks } from "@/lib/db/schema";
import { upsertUser, recordUnlock } from "@/lib/db/queries";
import { verifyTempoPayment } from "@/lib/tempo-server";
import { presignPrivateGet } from "@/lib/blob";
import { POINTS_PER_UNLOCK } from "@/lib/constants";

// neon-serverless + @vercel/blob signing need the Node.js runtime.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { postId, paymentTxHash, walletAddress, settlementMs } =
    (await req.json()) as {
      postId?: string;
      paymentTxHash?: string;
      walletAddress?: string;
      settlementMs?: number;
    };

  if (!postId || !paymentTxHash || !walletAddress) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const db = getDb();

  // 1. Post must exist.
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });

  // 2. Ensure the fan has a user record (create on first interaction).
  const fan = await upsertUser(walletAddress);

  // 3. Idempotency — already unlocked? Re-issue a signed URL.
  const existing = await db.query.unlocks.findFirst({
    where: and(eq(unlocks.fanId, fan.id), eq(unlocks.postId, postId)),
  });
  if (existing) {
    const signedUrl = await presignPrivateGet(post.privateMediaKey, 300);
    return Response.json({ signedUrl, alreadyUnlocked: true });
  }

  // 4. Verify payment on-chain.
  const isValid = await verifyTempoPayment(
    paymentTxHash,
    post.unlockPrice,
    walletAddress,
  );
  if (!isValid) {
    return Response.json({ error: "Payment not verified" }, { status: 402 });
  }

  // 5. Record unlock + loyalty points (atomic).
  await recordUnlock(
    fan.id,
    postId,
    paymentTxHash,
    post.unlockPrice,
    settlementMs ?? 0,
    String(POINTS_PER_UNLOCK),
  );

  // 6. Issue a short-lived signed URL for the unblurred media.
  const ttl = post.mediaType === "video" ? 300 : 60;
  const signedUrl = await presignPrivateGet(post.privateMediaKey, ttl);

  return Response.json({ signedUrl, settlementMs });
}
