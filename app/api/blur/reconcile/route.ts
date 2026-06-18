import { NextRequest } from "next/server";
import { getReplicate } from "@/lib/blur/replicate";
import { findStuckJobs } from "@/lib/blur/jobs";
import { advance } from "@/lib/blur/state";

export const runtime = "nodejs";
export const maxDuration = 300;

const STUCK_AFTER_MS = 10 * 60 * 1000; // 10 min in a non-terminal state

/**
 * Reconciliation cron (PRD §10): a webhook can be lost. Find jobs stuck in a
 * non-terminal state, poll Replicate for their latest stage's prediction, and
 * advance (recover a missed success) or fail them. Idempotent: re-advancing an
 * already-final job is a no-op-ish update.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET
 * is set in the project env.
 */
export async function GET(req: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stuck = await findStuckJobs(STUCK_AFTER_MS);
  if (stuck.length === 0) return Response.json({ checked: 0, results: [] });

  const replicate = getReplicate(); // only instantiate when there's work to poll
  const results: Array<Record<string, unknown>> = [];

  for (const job of stuck) {
    const preds = job.predictionIds ?? {};
    // Poll the most recent stage that has a Replicate prediction.
    const stage = preds.track ? "track" : preds.detect ? "detect" : null;
    const predId = stage ? preds[stage] : undefined;
    if (!stage || !predId) {
      results.push({ job: job.id, skipped: "no_prediction" });
      continue;
    }

    const pred = await replicate.predictions.get(predId);
    if (pred.status === "succeeded") {
      await advance(job.id, stage, { output: pred.output });
      results.push({ job: job.id, recovered: stage });
    } else if (pred.status === "failed" || pred.status === "canceled") {
      await advance(job.id, stage, { error: String(pred.error ?? "prediction failed") });
      results.push({ job: job.id, failed: stage });
    } else {
      results.push({ job: job.id, still: pred.status });
    }
  }

  return Response.json({ checked: stuck.length, results });
}
