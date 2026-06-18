// Offline feather comparison — NO Replicate call, NO blob, costs nothing.
// Re-composites the original image against the already-saved grounded_sam mask
// at several feather strengths so you can compare edge blending side by side.
// Writes blurred_featherNN.jpg into the gitignored auto-blur/api-output/.
//
//   tsx scripts/blur-feather-test.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { compositeBlurBuffers } from "../lib/blur/composite";

const SRC = "auto-blur/NSFW.png";
const MASK = "auto-blur/api-output/mask.jpg";
const OUT_DIR = "auto-blur/api-output";
const FEATHERS = [0, 8, 16, 24];

async function main() {
  if (!existsSync(MASK)) {
    throw new Error(`missing ${MASK} — run a detection first (npm run blur:test)`);
  }
  const imgBuf = readFileSync(SRC);
  const maskBuf = readFileSync(MASK);

  for (const f of FEATHERS) {
    const out = await compositeBlurBuffers(imgBuf, maskBuf, { featherSigma: f });
    const name = `blurred_feather${String(f).padStart(2, "0")}.jpg`;
    writeFileSync(`${OUT_DIR}/${name}`, out);
    console.log(`  ✓ ${OUT_DIR}/${name} (feather=${f}px, ${out.length} bytes)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
