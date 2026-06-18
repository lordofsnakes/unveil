import { NextRequest } from "next/server";
import { getUserByWallet, getPost } from "@/lib/db/queries";
import {
  getThreadFor,
  getMessages,
  markThreadRead,
  sendMessage,
} from "@/lib/db/messages";
import { presignPrivateGet } from "@/lib/blob";
import { formatUsd } from "@/lib/constants";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/messages/[id]?wallet=0x… — a conversation. PPV messages are resolved
 * per-viewer: the sender sees their locked card, an unlocked recipient gets a
 * presigned real-media URL, everyone else gets the blurred preview + price.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return Response.json({ error: "Missing wallet" }, { status: 400 });

  const user = await getUserByWallet(wallet);
  if (!user) return Response.json({ error: "Unknown user" }, { status: 404 });

  const thread = await getThreadFor(user.id, id);
  if (!thread) return Response.json({ error: "Thread not found" }, { status: 404 });

  const rows = await getMessages(id, user.id);

  const messages = await Promise.all(
    rows.map(async (m) => {
      const me = m.senderId === user.id;
      if (m.kind !== "ppv" || !m.postId) {
        return { id: m.id, kind: "text" as const, me, text: m.body ?? "" };
      }
      // Recipient who has paid → reveal the real media.
      if (!me && m.viewerUnlockId) {
        return {
          id: m.id,
          kind: "ppv" as const,
          me,
          revealed: true,
          title: m.postTitle ?? "",
          caption: m.body ?? "",
          url: m.privateMediaKey
            ? await presignPrivateGet(m.privateMediaKey, 300)
            : null,
          mediaType: m.mediaType,
        };
      }
      // Sender's own card, or a recipient who hasn't unlocked → preview only.
      return {
        id: m.id,
        kind: "ppv" as const,
        me,
        revealed: false,
        postId: m.postId,
        title: m.postTitle ?? "",
        caption: m.body ?? "",
        price: m.unlockPrice ?? "0",
        priceLabel: m.unlockPrice ? `$${formatUsd(m.unlockPrice)}` : "$0",
        previewUrl: m.blurredPreviewUrl
          ? await presignPrivateGet(m.blurredPreviewUrl, 3600)
          : null,
        mediaType: m.mediaType,
      };
    }),
  );

  // Now that the viewer has loaded it, clear their unread badge for this thread.
  await markThreadRead(id, user.id);

  const other = thread.creatorId === user.id ? thread.fan : thread.creator;
  return Response.json({
    thread: {
      id: thread.id,
      name: other.username ?? `@${other.walletAddress.slice(2, 8).toLowerCase()}`,
      avatar: other.avatar,
      // Whether the *viewer* is the creator side — gates PPV composing.
      viewerIsCreator: thread.creatorId === user.id,
    },
    messages,
  });
}

/**
 * POST /api/messages/[id] — send a message.
 * Body: { wallet, kind?: "text"|"ppv", body?, postId? }. PPV is creator-only and
 * must reference one of the creator's own posts (it reuses the unlock flow).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { wallet, kind = "text", body, postId } = (await req.json()) as {
    wallet?: string;
    kind?: "text" | "ppv";
    body?: string;
    postId?: string;
  };

  if (!wallet) return Response.json({ error: "Missing wallet" }, { status: 400 });

  const user = await getUserByWallet(wallet);
  if (!user) return Response.json({ error: "Unknown user" }, { status: 404 });

  const thread = await getThreadFor(user.id, id);
  if (!thread) return Response.json({ error: "Thread not found" }, { status: 404 });

  if (kind === "ppv") {
    if (thread.creatorId !== user.id) {
      return Response.json(
        { error: "Only the creator can send locked content" },
        { status: 403 },
      );
    }
    if (!postId) {
      return Response.json({ error: "postId required for PPV" }, { status: 400 });
    }
    const post = await getPost(postId);
    if (!post || post.creatorId !== user.id) {
      return Response.json({ error: "Not your post" }, { status: 400 });
    }
    const msg = await sendMessage({
      threadId: id,
      senderId: user.id,
      kind: "ppv",
      body: body?.trim() || null,
      postId,
    });
    return Response.json({ ok: true, id: msg.id });
  }

  const text = body?.trim();
  if (!text) return Response.json({ error: "Empty message" }, { status: 400 });

  const msg = await sendMessage({
    threadId: id,
    senderId: user.id,
    kind: "text",
    body: text,
  });
  return Response.json({ ok: true, id: msg.id });
}
