// Seed one ready_for_review blur_job from the real P0 artifacts so the review
// page can be exercised in a browser. Uploads the original + blurred derivative
// privately and inserts the job with the real detections.
//
//   tsx scripts/blur-seed-review.ts   → prints JOB_ID + REVIEW_URL
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { users, blurJobs } from "../lib/db/schema";
import { uploadPrivate } from "../lib/blob";
import type { DetectedRegion } from "../lib/db/schema";

async function main() {
  const db = getDb();

  const [creator] = await db
    .insert(users)
    .values({
      walletAddress: "0x1111111111111111111111111111111111111111",
      username: "demo_creator",
      isCreator: true,
    })
    .onConflictDoUpdate({
      target: users.walletAddress,
      set: { isCreator: true },
    })
    .returning();

  // Insert first to get an id, then upload derivatives under that id.
  const [job] = await db
    .insert(blurJobs)
    .values({
      creatorId: creator.id,
      mediaType: "image",
      status: "uploaded",
      rawBlobKey: "pending",
    })
    .returning();

  const origBlob = await uploadPrivate(
    `blur-jobs/${job.id}/original.png`,
    readFileSync("auto-blur/NSFW.png"),
    { contentType: "image/png", upsert: true },
  );
  const blurBlob = await uploadPrivate(
    `blur-jobs/${job.id}/blurred.jpg`,
    readFileSync("auto-blur/api-output/blurred.jpg"),
    { contentType: "image/jpeg", upsert: true },
  );

  const regions: DetectedRegion[] = [
    { label: "breast", box: [151, 457, 793, 1120], confidence: 0.37, frame: 0 },
    { label: "breast", box: [154, 489, 685, 1117], confidence: 0.31, frame: 0 },
    { label: "buttocks", box: [154, 689, 428, 1060], confidence: 0.33, frame: 0 },
  ];

  await db
    .update(blurJobs)
    .set({
      status: "ready_for_review",
      rawBlobKey: origBlob.pathname,
      originalBlobKey: origBlob.pathname,
      blurredBlobUrl: blurBlob.pathname,
      regions,
      detectionConfidence: "0.179",
      updatedAt: new Date(),
    })
    .where(eq(blurJobs.id, job.id));

  console.log("JOB_ID=" + job.id);
  console.log("REVIEW_URL=/blur-review/" + job.id);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
