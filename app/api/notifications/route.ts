import { getNotifications } from "@/lib/db/queries";
import { CREATOR_CUT } from "@/lib/constants";
import {
  requireCurrentAppUser,
  unauthorizedJson,
  UnauthorizedError,
} from "@/lib/app-user";

export const runtime = "nodejs";

/**
 * GET /api/notifications — derived activity feed: the unlock events
 * on this user's posts ("someone unveiled your post"). No dedicated table; the
 * `unlocks` ledger is the source of truth. The displayed amount is the creator's
 * net cut, matching what actually lands with them.
 */
export async function GET() {
  let user;
  try {
    user = await requireCurrentAppUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedJson();
    throw err;
  }

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
