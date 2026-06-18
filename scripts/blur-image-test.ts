// P0 end-to-end test: run a local image through the REAL auto-blur image
// pipeline (lib/blur/*) and write every artifact to the gitignored
// auto-blur/api-output/ folder.
//
//   npm run blur:test [path/to/image]      # default: auto-blur/NSFW.png
//
// Requires Supabase Storage env + REPLICATE_API_TOKEN (with credit) in
// .env.local. The Replicate account must have billing credit or the model
// returns 402.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename } from "node:path";
import { deletePrivate, presignPrivateGet, uploadPrivate } from "../lib/blob";
import { processImage } from "../lib/blur/pipeline-image";
import { fetchBuffer } from "../lib/blur/composite";

const OUT_DIR = "auto-blur/api-output";
const OUTPUT_NAMES = ["annotated", "neg_annotated", "mask", "inverted_mask"];

async function main() {
  const localPath = process.argv[2] ?? "auto-blur/NSFW.png";
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error(
      "REPLICATE_API_TOKEN not set — add credit + a token to .env.local first",
    );
  }
  mkdirSync(OUT_DIR, { recursive: true });

  // 1. Upload privately + presign so Replicate can fetch (TTL outlives the job).
  const buf = readFileSync(localPath);
  const blob = await uploadPrivate(`blur-test/${basename(localPath)}`, buf, {
    contentType: "image/png",
    upsert: true,
  });
  const signedUrl = await presignPrivateGet(blob.pathname, 900);
  console.log(`↑ uploaded ${localPath} → ${blob.pathname}`);

  try {
    // 2. Run the real pipeline.
    const result = await processImage(signedUrl);
    console.log(`status=${result.status} coverage=${result.coverage.toFixed(4)}`);

    // 3. Save every API-returned image for inspection.
    for (let i = 0; i < result.outputs.length; i++) {
      const data = await fetchBuffer(result.outputs[i]);
      const name = OUTPUT_NAMES[i] ?? `out_${i}`;
      writeFileSync(`${OUT_DIR}/${name}.jpg`, data);
      console.log(`  ↓ ${OUT_DIR}/${name}.jpg`);
    }

    // 4. Save the composited blurred derivative (the deliverable).
    if (result.status === "ready_for_review") {
      writeFileSync(`${OUT_DIR}/blurred.jpg`, result.blurredBuffer);
      console.log(`  ✓ ${OUT_DIR}/blurred.jpg (ready_for_review)`);
    } else {
      console.log(
        `  ⚠ ${result.reason} → manual_review (fail-closed; nothing published)`,
      );
    }
  } finally {
    // 5. Clean up the private source blob.
    await deletePrivate(blob.pathname);
    console.log(`✗ cleaned up ${blob.pathname}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
