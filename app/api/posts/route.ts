import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { upsertCreator, createPost } from "@/lib/db/queries";
import { createJob } from "@/lib/blur/jobs";

export const runtime = "nodejs";

// Soft cap to stay well under serverless request-body limits. Large videos
// should use Vercel Blob client upload (auto-blur PRD §10) — a follow-up.
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Creator upload / post-creation. The UPLOAD side of the auto-blur flow:
 *   1. store the raw media as a PRIVATE blob (this is what the blur pipeline reads)
 *   2. create an UNPUBLISHED post (fail-closed — not public until blur is reviewed)
 *   3. enqueue a `blur_jobs` row (status "uploaded") linked to the post
 *   4. best-effort kick off detection IF Replicate is configured (never blocks)
 *
 * The actual detection/compositing/publish (the "blur flow") is owned elsewhere;
 * this route just hands off a clean `uploaded` job + raw blob in the shape the
 * pipeline expects (`lib/blur/jobs.ts` + `lib/blur/state.ts`).
 *
 *   POST /api/posts  (multipart/form-data: file, title, price, wallet)
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  const title = (form.get("title") as string | null)?.trim() ?? "";
  const price = (form.get("price") as string | null)?.trim() ?? "";
  const wallet = (form.get("wallet") as string | null)?.trim() ?? "";

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Media file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "File too large (max 25 MB for now)" },
      { status: 413 },
    );
  }
  if (!title) {
    return Response.json({ error: "Caption is required" }, { status: 400 });
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return Response.json({ error: "Connect a wallet to post" }, { status: 401 });
  }
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return Response.json({ error: "Invalid price" }, { status: 400 });
  }

  const mediaType: "image" | "video" = file.type.startsWith("video")
    ? "video"
    : "image";

  // 1. Store the raw upload privately. The pipeline presigns this on demand.
  const creator = await upsertCreator(wallet);
  const ext =
    file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
    (mediaType === "video" ? "mp4" : "jpg");
  const buffer = Buffer.from(await file.arrayBuffer());

  let rawBlobKey: string;
  try {
    const blob = await put(`uploads/${creator.id}/${randomUUID()}.${ext}`, buffer, {
      access: "private",
      contentType: file.type || "application/octet-stream",
    });
    rawBlobKey = blob.pathname;
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 502 },
    );
  }

  // 2. Unpublished post + 3. blur job (the handoff). Preview is the raw key as a
  //    placeholder; the blur publish step overwrites it with the real derivative.
  //    Safe because unpublished posts never reach the feed (getFeed filters them).
  const post = await createPost({
    creatorId: creator.id,
    title,
    unlockPrice: priceNum.toFixed(8),
    mediaType,
    blurredPreviewUrl: rawBlobKey,
    privateMediaKey: rawBlobKey,
    isPublished: false,
  });

  const job = await createJob({
    creatorId: creator.id,
    mediaType,
    rawBlobKey,
    postId: post.id,
  });

  // 4. Optional handoff trigger — only if the blur pipeline is configured. Never
  //    let a detection failure (or missing Replicate creds) fail the upload.
  const blurConfigured =
    !!process.env.REPLICATE_API_TOKEN &&
    (mediaType === "image"
      ? !!process.env.REPLICATE_GROUNDED_SAM_VERSION
      : !!process.env.REPLICATE_GROUNDING_DINO_VERSION);

  if (blurConfigured) {
    try {
      const [{ detectStage }, { presignPrivateGet }] = await Promise.all([
        import("@/lib/blur/state"),
        import("@/lib/blob"),
      ]);
      const rawUrl = await presignPrivateGet(rawBlobKey, 60 * 30);
      await detectStage(job.id, rawUrl, mediaType);
    } catch (err) {
      // Leave the job in "uploaded" for the pipeline to pick up later.
      console.error("blur detect trigger failed (non-fatal):", err);
    }
  }

  return Response.json({
    postId: post.id,
    jobId: job.id,
    status: blurConfigured ? "processing" : "uploaded",
  });
}
