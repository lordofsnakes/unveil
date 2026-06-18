import { NextRequest } from "next/server";
import { publishJob } from "@/lib/blur/jobs";

export const runtime = "nodejs";

// Approve → publish. The creator gate (PRD §11): nothing becomes public until
// this is called. Creates the posts row from the blurred derivative.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    unlockPrice?: string;
  };
  const title = body.title?.trim() || "Untitled";
  const unlockPrice = body.unlockPrice ?? "0.05";

  try {
    const { post } = await publishJob(id, { title, unlockPrice });
    return Response.json({ status: "published", postId: post.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
