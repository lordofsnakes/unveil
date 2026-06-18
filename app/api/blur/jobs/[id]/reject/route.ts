import { NextRequest } from "next/server";
import { getJob, updateJob } from "@/lib/blur/jobs";
import { detectStage } from "@/lib/blur/state";
import { presignPrivateGet } from "@/lib/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ATTEMPTS = 3;

/**
 * Reject (PRD §9.3). Two modes:
 *  - "adjust" (default): re-run detection with STRONGER params (more mask
 *    dilation, lower box threshold). Capped at MAX_ATTEMPTS → then manual.
 *  - "manual": hand off to a human (status → manual_review).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { mode } = (await req.json().catch(() => ({}))) as {
    mode?: "adjust" | "manual";
  };

  const job = await getJob(id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const attempts = (job.attempts ?? 0) + 1;

  if (mode === "manual" || attempts > MAX_ATTEMPTS) {
    await updateJob(id, { status: "manual_review", attempts });
    return Response.json({
      status: "manual_review",
      reason: attempts > MAX_ATTEMPTS ? "max_attempts" : "manual",
    });
  }

  // Re-run detection, escalating strength each attempt.
  await updateJob(id, { status: "uploaded", attempts });
  const rawUrl = await presignPrivateGet(job.rawBlobKey, 60 * 30);
  await detectStage(id, rawUrl, job.mediaType, {
    dilation: Number(process.env.BLUR_MASK_DILATION ?? 12) + 8 * attempts,
    boxThreshold: Math.max(0.15, 0.3 - 0.05 * attempts),
  });
  return Response.json({ status: "detecting", attempts });
}
