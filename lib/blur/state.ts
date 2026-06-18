import { put } from "@vercel/blob";
import { presignPrivateGet } from "@/lib/blob";
import {
  getReplicate,
  DESIRED_REGIONS,
  NEGATIVE_REGIONS,
  GROUNDED_SAM_OUTPUT,
} from "./replicate";
import { compositeImageBlur, maskCoverage, fetchBuffer } from "./composite";
import { regionsToSam2Clicks } from "./geometry";
import { getJob, updateJob, addPredictionId, type BlurJob } from "./jobs";
import type { DetectedRegion } from "@/lib/db/schema";

// ── Webhook URL ───────────────────────────────────────────────────────────────
// Replicate calls back here when a stage finishes. Must be a public URL.
function webhookUrl(jobId: string, stage: "detect" | "track"): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/api/blur/webhook?job=${jobId}&stage=${stage}`;
}

const TTL = 60 * 30; // signed-URL lifetime — must outlive the whole pipeline

// ════════════════════════════════════════════════════════════════════════════
// Stage 1 — DETECT (kicked off by ingest). Starts a Replicate prediction with a
// webhook; never awaits completion.
// ════════════════════════════════════════════════════════════════════════════
export type DetectOpts = { dilation?: number; boxThreshold?: number };

export async function detectStage(
  jobId: string,
  rawUrl: string,
  mediaType: "image" | "video",
  opts: DetectOpts = {},
) {
  const replicate = getReplicate();

  if (mediaType === "image") {
    // grounded_sam does detect + mask in one call.
    const pred = await replicate.predictions.create({
      version: process.env.REPLICATE_GROUNDED_SAM_VERSION!,
      input: {
        image: rawUrl,
        mask_prompt: DESIRED_REGIONS.join(","),
        negative_mask_prompt: NEGATIVE_REGIONS.join(","),
        adjustment_factor: opts.dilation ?? Number(process.env.BLUR_MASK_DILATION ?? 12),
      },
      webhook: webhookUrl(jobId, "detect"),
      webhook_events_filter: ["completed"],
    });
    await updateJob(jobId, { status: "detecting" });
    await addPredictionId(jobId, "detect", pred.id);
    return;
  }

  // video: detect boxes on the first frame (seed @ frame 0).
  const { keyframeUrl, fps } = await extractFirstFrame(jobId, rawUrl);
  const pred = await replicate.predictions.create({
    version: process.env.REPLICATE_GROUNDING_DINO_VERSION!,
    input: {
      image: keyframeUrl,
      query: DESIRED_REGIONS.join(","),
      box_threshold: opts.boxThreshold ?? Number(process.env.BLUR_BOX_THRESHOLD ?? 0.3),
      text_threshold: 0.25,
      show_visualisation: false,
    },
    webhook: webhookUrl(jobId, "detect"),
    webhook_events_filter: ["completed"],
  });
  await updateJob(jobId, { status: "detecting", sourceFps: Math.round(fps) });
  await addPredictionId(jobId, "detect", pred.id);
}

// ════════════════════════════════════════════════════════════════════════════
// advance() — called by the verified, deduped webhook receiver.
// ════════════════════════════════════════════════════════════════════════════
export async function advance(
  jobId: string,
  stage: string,
  payload: { output?: unknown; error?: string | null },
) {
  if (payload.error) {
    await updateJob(jobId, { status: "failed", error: String(payload.error) });
    return;
  }
  const job = await getJob(jobId);
  if (!job) return;

  if (stage === "detect") return onDetectComplete(job, payload.output);
  if (stage === "track") return onTrackComplete(job, payload.output);
}

// ── on detect complete ─────────────────────────────────────────────────────
async function onDetectComplete(job: BlurJob, output: unknown) {
  if (job.mediaType === "image") {
    // grounded_sam → [annotated, neg, mask, inverted]; index 2 is the clean mask.
    const outputs = Array.isArray(output) ? (output as unknown[]).map(String) : [];
    const maskUrl = outputs[GROUNDED_SAM_OUTPUT.mask];
    if (!maskUrl) {
      await updateJob(job.id, { status: "manual_review", error: "api_no_output" });
      return;
    }
    const coverage = await maskCoverage(maskUrl);
    if (coverage < Number(process.env.BLUR_MIN_COVERAGE ?? 0.001)) {
      // Fail closed: nothing detected → never auto-publish.
      await updateJob(job.id, {
        status: "manual_review",
        detectionConfidence: String(coverage),
      });
      return;
    }
    await compositeImageStage(job, maskUrl, coverage);
    return;
  }

  // video: grounding-dino → boxes.
  const det = (output ?? {}) as {
    detections?: Array<{ bbox: number[]; label: string; confidence: number }>;
  };
  const regions: DetectedRegion[] = (det.detections ?? []).map((d) => ({
    label: d.label,
    box: d.bbox as [number, number, number, number],
    confidence: d.confidence,
    frame: 0,
  }));
  // box_threshold already filtered low-confidence boxes, so "no regions" = nothing found.
  if (!regions.length) {
    await updateJob(job.id, { status: "manual_review", detectionConfidence: "0" });
    return;
  }
  const maxConf = regions.reduce((m, r) => Math.max(m, r.confidence), 0);
  await updateJob(job.id, { regions, detectionConfidence: String(maxConf) });
  await trackStage(job, regions);
}

// ── Stage 2 — TRACK (video only) ────────────────────────────────────────────
async function trackStage(job: BlurJob, regions: DetectedRegion[]) {
  const replicate = getReplicate();
  const rawUrl = await presignPrivateGet(job.rawBlobKey, TTL);
  const pred = await replicate.predictions.create({
    version: process.env.REPLICATE_SAM2_VIDEO_VERSION!,
    input: {
      input_video: rawUrl,
      ...regionsToSam2Clicks(regions),
      mask_type: "binary",
      output_video: true,
      video_fps: job.sourceFps ?? 30,
    },
    webhook: webhookUrl(job.id, "track"),
    webhook_events_filter: ["completed"],
  });
  await updateJob(job.id, { status: "tracking" });
  await addPredictionId(job.id, "track", pred.id);
}

// ── Stage 3 — COMPOSITE ───────────────────────────────────────────────────────
async function compositeImageStage(job: BlurJob, maskUrl: string, coverage: number) {
  await updateJob(job.id, { status: "compositing" });
  const rawUrl = await presignPrivateGet(job.rawBlobKey, TTL);
  const blurred = await compositeImageBlur(rawUrl, maskUrl);
  const blob = await put(`blur-jobs/${job.id}/blurred.jpg`, blurred, {
    access: "private",
    contentType: "image/jpeg",
    allowOverwrite: true,
  });
  await updateJob(job.id, {
    status: "ready_for_review",
    blurredBlobUrl: blob.pathname, // private/pending — published on approve (P3)
    originalBlobKey: job.rawBlobKey,
    detectionConfidence: String(coverage),
  });
}

async function onTrackComplete(job: BlurJob, output: unknown) {
  const outputs = Array.isArray(output) ? (output as unknown[]).map(String) : [String(output)];
  const maskVideoUrl = outputs[0];
  await updateJob(job.id, { status: "compositing" });

  // NOTE: ffmpeg compositing a full clip inside a function works for SHORT clips
  // but can exceed memory/time for long video — production moves this into the
  // Cog (P5) or a chunked worker (P4).
  const { compositeVideoBlur } = await import("./composite-video");
  const { mkdtempSync, writeFileSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");

  const work = mkdtempSync(join(tmpdir(), "veil-composite-"));
  try {
    const srcPath = join(work, "src.mp4");
    const maskPath = join(work, "mask.mp4");
    const outPath = join(work, "blurred.mp4");
    const rawUrl = await presignPrivateGet(job.rawBlobKey, TTL);
    writeFileSync(srcPath, await fetchBuffer(rawUrl));
    writeFileSync(maskPath, await fetchBuffer(maskVideoUrl));

    await compositeVideoBlur(srcPath, maskPath, outPath);

    const blob = await put(`blur-jobs/${job.id}/blurred.mp4`, readFileSync(outPath), {
      access: "private",
      contentType: "video/mp4",
      allowOverwrite: true,
    });
    await updateJob(job.id, {
      status: "ready_for_review",
      blurredBlobUrl: blob.pathname,
      originalBlobKey: job.rawBlobKey,
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────
async function extractFirstFrame(
  jobId: string,
  videoUrl: string,
): Promise<{ keyframeUrl: string; fps: number }> {
  const { execFileSync } = await import("node:child_process");
  const ffmpeg = (await import("@ffmpeg-installer/ffmpeg")).default;
  const { mkdtempSync, writeFileSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { probeVideo } = await import("./frames");

  const work = mkdtempSync(join(tmpdir(), "veil-detect-"));
  try {
    const vid = join(work, "src.mp4");
    writeFileSync(vid, await fetchBuffer(videoUrl));
    const fps = (await probeVideo(vid)).fps;
    const frame = join(work, "kf.jpg");
    execFileSync(ffmpeg.path, ["-y", "-i", vid, "-vframes", "1", "-q:v", "2", frame], {
      stdio: "ignore",
    });
    const blob = await put(`blur-jobs/${jobId}/keyframe.jpg`, readFileSync(frame), {
      access: "private",
      contentType: "image/jpeg",
      allowOverwrite: true,
    });
    return { keyframeUrl: await presignPrivateGet(blob.pathname, TTL), fps };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
