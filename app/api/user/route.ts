import { NextRequest } from "next/server";
import {
  getUserByWallet,
  upsertUser,
  updateUserProfile,
} from "@/lib/db/queries";

export const runtime = "nodejs";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
// 3–20 chars, lowercase letters/digits/underscore. Matches the unique column.
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** GET /api/user?wallet=0x… — the editable profile fields for a wallet. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return Response.json({ error: "Missing wallet" }, { status: 400 });

  const user = await getUserByWallet(wallet);
  return Response.json({
    user: user
      ? {
          username: user.username,
          avatar: user.avatar,
          isCreator: user.isCreator,
          walletAddress: user.walletAddress,
        }
      : null,
  });
}

/** PATCH /api/user — update username/avatar for the connected wallet. */
export async function PATCH(req: NextRequest) {
  const { wallet, username, avatar } = (await req.json()) as {
    wallet?: string;
    username?: string;
    avatar?: string;
  };

  if (!wallet || !WALLET_RE.test(wallet)) {
    return Response.json({ error: "Invalid wallet" }, { status: 400 });
  }

  const patch: { username?: string; avatar?: string } = {};
  if (username !== undefined) {
    const u = username.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) {
      return Response.json(
        { error: "Username must be 3–20 chars: a–z, 0–9, _" },
        { status: 400 },
      );
    }
    patch.username = u;
  }
  if (avatar !== undefined) patch.avatar = avatar;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Ensure a row exists for browse-only wallets that never posted/unlocked.
  await upsertUser(wallet);

  try {
    const user = await updateUserProfile(wallet, patch);
    return Response.json({
      user: {
        username: user.username,
        avatar: user.avatar,
        isCreator: user.isCreator,
        walletAddress: user.walletAddress,
      },
    });
  } catch (err) {
    // Unique-violation on username → 409.
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      return Response.json({ error: "Username already taken" }, { status: 409 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 },
    );
  }
}
