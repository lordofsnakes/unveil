import { NextRequest } from "next/server";
import { getUserByWallet, upsertUser, upsertCreator } from "@/lib/db/queries";
import { listThreads, getOrCreateThread } from "@/lib/db/messages";

export const runtime = "nodejs";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function handleFor(u: {
  username: string | null;
  walletAddress: string;
}): string {
  return u.username ?? `@${u.walletAddress.slice(2, 8).toLowerCase()}`;
}

/** GET /api/messages?wallet=0x… — the user's inbox. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return Response.json({ error: "Missing wallet" }, { status: 400 });

  const user = await getUserByWallet(wallet);
  if (!user) return Response.json({ threads: [] });

  const rows = await listThreads(user.id);
  const threads = rows.map((t) => ({
    id: t.id,
    name: handleFor(t.other),
    avatar: t.other.avatar,
    preview: t.preview,
    at: t.lastMessageAt,
    unread: t.unread,
  }));
  return Response.json({ threads });
}

/**
 * POST /api/messages — open (or reuse) a conversation with a creator.
 * Body: { wallet, creatorWallet }. The target is marked a creator; the caller
 * is the fan. Returns the thread id to navigate to.
 */
export async function POST(req: NextRequest) {
  const { wallet, creatorWallet } = (await req.json()) as {
    wallet?: string;
    creatorWallet?: string;
  };

  if (!wallet || !WALLET_RE.test(wallet)) {
    return Response.json({ error: "Invalid wallet" }, { status: 400 });
  }
  if (!creatorWallet || !WALLET_RE.test(creatorWallet)) {
    return Response.json({ error: "Invalid creator" }, { status: 400 });
  }
  if (wallet.toLowerCase() === creatorWallet.toLowerCase()) {
    return Response.json({ error: "Cannot message yourself" }, { status: 400 });
  }

  const [fan, creator] = await Promise.all([
    upsertUser(wallet),
    upsertCreator(creatorWallet),
  ]);

  const thread = await getOrCreateThread(creator.id, fan.id);
  return Response.json({ threadId: thread.id });
}
