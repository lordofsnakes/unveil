import { NextRequest } from "next/server";
import { getUserByWallet, getUnlockedPosts } from "@/lib/db/queries";
import { presignPrivateGet } from "@/lib/blob";

export const runtime = "nodejs";

/**
 * GET /api/collection?wallet=0x… — the fan's unlocked posts as gallery tiles.
 * Each tile presigns the REAL (unblurred) media: having paid is the access
 * grant, so the collection shows what they own, not the public preview.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return Response.json({ error: "Missing wallet" }, { status: 400 });

  const user = await getUserByWallet(wallet);
  if (!user) return Response.json({ items: [] });

  const rows = await getUnlockedPosts(user.id);
  const items = await Promise.all(
    rows.map(async (r) => ({
      postId: r.postId,
      title: r.title,
      mediaType: r.mediaType,
      unlockPrice: r.unlockPrice,
      creator: r.creatorUsername,
      url: await presignPrivateGet(r.privateMediaKey, 3600),
    })),
  );

  return Response.json({ items });
}
