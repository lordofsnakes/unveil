// P0 verification WITHOUT a local REPLICATE_API_TOKEN.
//
// The grounded_sam call is made out-of-band (via the authenticated Replicate
// MCP); its output URLs are passed in here. This exercises the REAL lib/blur
// composite + fail-closed logic and writes every artifact to the gitignored
// auto-blur/api-output/ folder — i.e. everything `processImage()` does except
// the (trivial) `replicate.run()` glue.
//
//   tsx scripts/blur-verify.ts <sourceUrl> <out0,out1,out2,out3>
import { writeFileSync, mkdirSync } from "node:fs";
import {
  fetchBuffer,
  maskCoverage,
  compositeImageBlur,
} from "../lib/blur/composite";
import { GROUNDED_SAM_OUTPUT } from "../lib/blur/replicate";

const OUT_DIR = "auto-blur/api-output";
const NAMES = ["annotated", "neg_annotated", "mask", "inverted_mask"];

async function main() {
  const [sourceUrl, outsCsv] = process.argv.slice(2);
  if (!sourceUrl || !outsCsv) {
    throw new Error(
      "usage: tsx scripts/blur-verify.ts <sourceUrl> <out0,out1,out2,out3>",
    );
  }
  const outputs = outsCsv.split(",");
  mkdirSync(OUT_DIR, { recursive: true });

  // Save every API-returned image for inspection.
  for (let i = 0; i < outputs.length; i++) {
    const data = await fetchBuffer(outputs[i]);
    const name = NAMES[i] ?? `out_${i}`;
    writeFileSync(`${OUT_DIR}/${name}.jpg`, data);
    console.log(`  ↓ ${OUT_DIR}/${name}.jpg (${data.length} bytes)`);
  }

  // Fail-closed routing (mirrors lib/blur/pipeline-image.ts).
  const maskUrl = outputs[GROUNDED_SAM_OUTPUT.mask];
  const coverage = await maskCoverage(maskUrl);
  const minCoverage = Number(process.env.BLUR_MIN_COVERAGE ?? 0.001);
  console.log(`coverage=${coverage.toFixed(5)} min=${minCoverage}`);

  if (coverage < minCoverage) {
    console.log(
      "status=manual_review reason=no_region_detected (fail-closed; nothing published)",
    );
    return;
  }

  const blurred = await compositeImageBlur(sourceUrl, maskUrl);
  writeFileSync(`${OUT_DIR}/blurred.jpg`, blurred);
  console.log(
    `status=ready_for_review → ${OUT_DIR}/blurred.jpg (${blurred.length} bytes)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
