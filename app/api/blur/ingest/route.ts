import { NextRequest } from "next/server";
import { createJob } from "@/lib/blur/jobs";
import { startPipeline } from "@/lib/blur/state";
import { presignPrivateGet } from "@/lib/blob";

// neon + @vercel/blob signing + (video) ffmpeg keyframe extraction need Node.
export const runtime = "nodejs";
// Just enough to create the job and kick off the first stage — NOT to process.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { rawBlobKey, creatorId, mediaType, postId } = (await req.json()) as {
    rawBlobKey?: string;
    creatorId?: string;
    mediaType?: "image" | "video";
    postId?: string;
  };

  if (!rawBlobKey || !creatorId || (mediaType !== "image" && mediaType !== "video")) {
    return Response.json({ error: "Missing/invalid fields" }, { status: 400 });
  }

  // 1. Persist a job row (status: 'uploaded').
  const job = await createJob({ rawBlobKey, creatorId, mediaType, postId });

  // 2. Signed URL Replicate can fetch — TTL must outlive the whole pipeline.
  const signedRawUrl = await presignPrivateGet(rawBlobKey, 60 * 30);

  // 3. Kick off the pipeline with a webhook; do NOT await completion.
  //    Routes to the single Cog (P5) when configured, else the multi-stage chain.
  await startPipeline(job.id, signedRawUrl, mediaType);

  // 4. Return now. Replicate calls /api/blur/webhook as each stage finishes.
  return Response.json({ jobId: job.id, status: "detecting" });
}
