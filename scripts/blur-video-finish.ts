// MCP-mode P1 helper: given the sam-2-video mask-video URL, download it and run
// the REAL composite-video.ts (blur + feathered alpha + overlay + audio mux)
// against the source clip, then probe the result and clean up the blobs.
//
//   tsx scripts/blur-video-finish.ts <sourceVideo> <maskUrl> <videoPathname> <kfPathname>
import { writeFileSync, mkdirSync } from "node:fs";
import { del } from "@vercel/blob";
import { fetchBuffer } from "../lib/blur/composite";
import { compositeVideoBlur } from "../lib/blur/composite-video";
import { probeVideo } from "../lib/blur/frames";

const OUT = "auto-blur/api-output";

async function main() {
  const [sourceVideo, maskUrl, vidPathname, kfPathname] = process.argv.slice(2);
  if (!sourceVideo || !maskUrl) {
    throw new Error(
      "usage: tsx scripts/blur-video-finish.ts <sourceVideo> <maskUrl> [videoPathname] [kfPathname]",
    );
  }
  mkdirSync(OUT, { recursive: true });

  const maskPath = `${OUT}/video-mask.mp4`;
  writeFileSync(maskPath, await fetchBuffer(maskUrl));
  console.log(`↓ mask track → ${maskPath}`);

  const out = `${OUT}/video-blurred.mp4`;
  await compositeVideoBlur(sourceVideo, maskPath, out);

  const m = await probeVideo(out);
  console.log(
    `✓ ${out} — ${m.width}x${m.height}@${Math.round(m.fps)}fps, ${m.durationSec.toFixed(2)}s, audio=${m.hasAudio}`,
  );
  if (!m.hasAudio) console.log("  ⚠ no audio in output (source may have been silent)");

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (vidPathname) await del(vidPathname, { token });
  if (kfPathname) await del(kfPathname, { token });
  if (vidPathname || kfPathname) console.log("✗ cleaned up source blobs");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
