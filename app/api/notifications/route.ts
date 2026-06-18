import { NextRequest } from "next/server";
import { getUserByWallet, getNotifications } from "@/lib/db/queries";
import { CREATOR_CUT } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * GET /api/notifications?wallet=0x… — derived activity feed: the unlock events
 * on this user's posts ("someone unveiled your post"). No dedicated table; the
 * `unlocks` ledger is the source of truth. The displayed amount is the creator's
 * net cut, matching what actually lands with them.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return Response.json({ error: "Missing wallet" }, { status: 400 });

  const user = await getUserByWallet(wallet);
  if (!user) return Response.json({ items: [] });

  const rows = await getNotifications(user.id);
  const items = rows.map((r) => {
    const net = (parseFloat(r.amountPaid) * CREATOR_CUT).toFixed(2);
    const actor =
      r.actorUsername ?? `@${r.actorWallet.slice(2, 8).toLowerCase()}`;
    return {
      id: r.id,
      actor,
      avatar: r.actorAvatar,
      action: "unveiled",
      postTitle: r.postTitle,
      amount: `+$${net}`,
      at: r.unlockedAt,
    };
  });

  return Response.json({ items });
}
