import { NextRequest } from "next/server";
import { getJob } from "@/lib/blur/jobs";

export const runtime = "nodejs";

// Next 16: dynamic route params are async — `await ctx.params`.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  // Status-poll shape — never leak blob keys/prediction ids to the client.
  return Response.json({
    id: job.id,
    status: job.status,
    mediaType: job.mediaType,
    regions: job.regions,
    detectionConfidence: job.detectionConfidence,
    error: job.error,
    updatedAt: job.updatedAt,
  });
}
