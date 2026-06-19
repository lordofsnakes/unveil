import { getLoyaltyBalance, getUserStats } from "@/lib/db/queries";
import {
  requireCurrentAppUser,
  unauthorizedJson,
  UnauthorizedError,
} from "@/lib/app-user";

export const runtime = "nodejs";

/**
 * Loyalty (VEIL points) balance for the signed-in user. The off-chain ledger is the
 * source of truth for the demo; when ENABLE_ONCHAIN_REWARDS is on, the same
 * points are also minted on-chain as VEIL.
 *
 *   GET /api/loyalty
 */
export async function GET() {
  let user;
  try {
    user = await requireCurrentAppUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedJson();
    throw err;
  }

  const points = await getLoyaltyBalance(user.id);
  const stats = await getUserStats(user.id);

  return Response.json({
    wallet: user.walletAddress,
    points,
    stats,
    veilToken: process.env.NEXT_PUBLIC_VEIL_TOKEN_ADDRESS || null,
    onchain: process.env.ENABLE_ONCHAIN_REWARDS === "true",
  });
}
