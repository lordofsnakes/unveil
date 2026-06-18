import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  blurJobs,
  blurWebhookEvents,
  blurStatusEnum,
} from "@/lib/db/schema";

export type BlurStatus = (typeof blurStatusEnum.enumValues)[number];
type JobPatch = Partial<typeof blurJobs.$inferInsert>;

export async function createJob(input: {
  creatorId: string;
  mediaType: "image" | "video";
  rawBlobKey: string;
  postId?: string | null;
}) {
  const db = getDb();
  const [job] = await db
    .insert(blurJobs)
    .values({
      creatorId: input.creatorId,
      mediaType: input.mediaType,
      rawBlobKey: input.rawBlobKey,
      postId: input.postId ?? null,
      status: "uploaded",
    })
    .returning();
  return job;
}

export async function getJob(id: string) {
  return getDb().query.blurJobs.findFirst({ where: eq(blurJobs.id, id) });
}

export type BlurJob = NonNullable<Awaited<ReturnType<typeof getJob>>>;

export async function updateJob(id: string, patch: JobPatch) {
  const db = getDb();
  const [job] = await db
    .update(blurJobs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(blurJobs.id, id))
    .returning();
  return job;
}

/** Merge one stage's prediction id into the predictionIds jsonb map. */
export async function addPredictionId(id: string, stage: string, predictionId: string) {
  const db = getDb();
  await db
    .update(blurJobs)
    .set({
      predictionIds: sql`COALESCE(${blurJobs.predictionIds}, '{}'::jsonb) || ${JSON.stringify(
        { [stage]: predictionId },
      )}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(blurJobs.id, id));
}

// ── Webhook idempotency ───────────────────────────────────────────────────────
/**
 * Atomically claim a webhook event. Returns true only the FIRST time an event
 * id is seen; a duplicate/retried event (or a concurrent retry that races a
 * slow handler) returns false and must be skipped. INSERT … ON CONFLICT DO
 * NOTHING RETURNING gives us the claim in a single round-trip.
 */
export async function claimWebhookEvent(
  eventId: string,
  jobId?: string,
): Promise<boolean> {
  const rows = await getDb()
    .insert(blurWebhookEvents)
    .values({ id: eventId, jobId: jobId ?? null })
    .onConflictDoNothing()
    .returning({ id: blurWebhookEvents.id });
  return rows.length > 0;
}
