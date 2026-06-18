import { NextRequest, NextResponse } from "next/server";
import {
  getPost,
  hasUnlocked,
  recordUnlock,
  upsertUser,
} from "@/lib/db/queries";
import { presignPrivateGet } from "@/lib/blob";
import {
  CUSTODIAL_ACCOUNT_COOKIE,
  getOrCreateCustodialAccount,
  unlockWithCustodialBalance,
} from "@/lib/custodial";
import { POINTS_PER_UNLOCK } from "@/lib/constants";
import { verifyTempoPayment } from "@/lib/tempo-server";

// Postgres + Supabase Storage signing need the Node.js runtime.
export const runtime = "nodejs";

function jsonWithAccountCookie(
  body: Record<string, unknown>,
  userId: string,
  init?: ResponseInit,
) {
  const res = NextResponse.json(body, init);
  res.cookies.set(CUSTODIAL_ACCOUNT_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export async function POST(req: NextRequest) {
  const {
    postId,
    paymentTxHash,
    walletAddress,
    settlementMs: providedSettlementMs,
    settlementStartedAt,
  } = (await req.json()) as {
    postId?: string;
    paymentTxHash?: string;
    walletAddress?: string;
    settlementMs?: number;
    settlementStartedAt?: number;
  };

  if (!postId) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  // 1. Post must exist.
  const post = await getPost(postId);
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });

  // 2a. Direct Tempo wallet payment: verify the tx receipt before recording.
  if (paymentTxHash || walletAddress) {
    if (!paymentTxHash || !walletAddress) {
      return Response.json({ error: "Missing payment proof" }, { status: 400 });
    }

    const fan = await upsertUser(walletAddress);
    const alreadyUnlocked = await hasUnlocked(fan.id, postId);
    if (!alreadyUnlocked) {
      const payment = await verifyTempoPayment(
        paymentTxHash,
        post.unlockPrice,
        walletAddress,
      );
      if (!payment.ok) {
        return Response.json(
          { error: `Payment verification failed: ${payment.reason}` },
          { status: 402 },
        );
      }

      await recordUnlock(
        fan.id,
        postId,
        paymentTxHash,
        post.unlockPrice,
        providedSettlementMs ?? 0,
        String(POINTS_PER_UNLOCK),
      );
    }

    const ttl = post.mediaType === "video" ? 300 : 60;
    const signedUrl = await presignPrivateGet(post.privateMediaKey, ttl);
    return Response.json({
      signedUrl,
      settlementMs: providedSettlementMs ?? 0,
      alreadyUnlocked,
      paymentTxHash,
    });
  }

  // 2b. Custodial account demo path: users hold an app balance, not a visible wallet.
  const account = await getOrCreateCustodialAccount(
    req.cookies.get(CUSTODIAL_ACCOUNT_COOKIE)?.value,
  );
  const settlementMs = settlementStartedAt ? Date.now() - settlementStartedAt : 0;
  const unlock = await unlockWithCustodialBalance({
    userId: account.userId,
    postId,
    amount: post.unlockPrice,
    settlementMs,
  });

  if (unlock.status === "insufficient_funds") {
    return jsonWithAccountCookie(
      {
        error: "Insufficient balance",
        balance: unlock.balance,
        required: unlock.required,
      },
      account.userId,
      { status: 402 },
    );
  }

  // 3. Issue a short-lived signed URL for the unblurred media.
  const ttl = post.mediaType === "video" ? 300 : 60;
  const signedUrl = await presignPrivateGet(post.privateMediaKey, ttl);

  return jsonWithAccountCookie(
    {
      signedUrl,
      settlementMs,
      alreadyUnlocked: unlock.status === "already_unlocked",
      balance: unlock.status === "unlocked" ? unlock.balance : undefined,
      internalReference: unlock.txHash,
    },
    account.userId,
  );
}
