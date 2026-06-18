// P1 end-to-end PoC: run a local video clip through the REAL video pipeline
// (keyframe detect → sam-2-video track → ffmpeg composite) and write the
// blurred result to the gitignored auto-blur/api-output/.
//
//   npm run blur:video -- path/to/clip.mp4
//
// Requires BLOB_READ_WRITE_TOKEN + REPLICATE_API_TOKEN (with credit) in
// .env.local. sam-2-video is a GPU video model — costs more than the image
// path; keep test clips short.
import { existsSync } from "node:fs";
import { put, del } from "@vercel/blob";
import { presignPrivateGet } from "../lib/blob";
import { processVideo, type Uploader } from "../lib/blur/pipeline-video";

const OUT = "auto-blur/api-output";

async function main() {
  const localVideo = process.argv[2];
  if (!localVideo || !existsSync(localVideo)) {
    throw new Error("usage: npm run blur:video -- <path/to/clip.mp4>");
  }
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not set — add credit + a token to .env.local");
  }

  // Upload privately + presign (30-min TTL must outlive the whole tracking job).
  const upload: Uploader = async (data, name, contentType) => {
    const blob = await put(`blur-test/${name}`, data, {
      access: "private",
      contentType,
      allowOverwrite: true,
    });
    const url = await presignPrivateGet(blob.pathname, 60 * 30);
    return {
      url,
      cleanup: () => del(blob.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN }),
    };
  };

  const outPath = `${OUT}/video-blurred.mp4`;
  const result = await processVideo(localVideo, outPath, upload);

  if (result.status === "ready_for_review") {
    console.log(
      `✓ ready_for_review — ${result.regions.length} region(s), ` +
        `${result.meta.width}x${result.meta.height}@${Math.round(result.meta.fps)}fps, ` +
        `audio=${result.meta.hasAudio}\n  → ${result.outPath}`,
    );
  } else {
    console.log(`⚠ manual_review (${result.reason}) — fail-closed, nothing published`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
