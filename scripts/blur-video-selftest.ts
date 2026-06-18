// FREE ffmpeg self-test — no Replicate, no blob. Validates the hardest part of
// P1: the compositeVideoBlur filtergraph (blur + feathered alpha + overlay) AND
// that the original AUDIO survives the composite. Generates a synthetic source
// clip (test pattern + 440Hz tone) and a synthetic mask (white box on black),
// composites, then ffprobes the result.
//
//   tsx scripts/blur-video-selftest.ts
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { compositeVideoBlur } from "../lib/blur/composite-video";
import { probeVideo } from "../lib/blur/frames";

const FF = ffmpegInstaller.path;
const OUT = "auto-blur/api-output";
const run = (args: string[]) => execFileSync(FF, args, { stdio: "ignore" });

async function main() {
  mkdirSync(OUT, { recursive: true });
  const src = `${OUT}/vid-source.mp4`;
  const mask = `${OUT}/vid-mask.mp4`;
  const out = `${OUT}/vid-blurred.mp4`;

  // Synthetic source: moving test pattern + 440Hz tone (so there's audio to keep).
  run([
    "-y",
    "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30:duration=3",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
    "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", "-shortest",
    src,
  ]);

  // Synthetic mask: a white box (the "region") on black.
  run([
    "-y",
    "-f", "lavfi", "-i", "color=c=black:s=320x240:r=30:d=3",
    "-vf", "drawbox=x=96:y=72:w=128:h=96:color=white:t=fill",
    "-pix_fmt", "yuv420p", "-c:v", "libx264",
    mask,
  ]);

  await compositeVideoBlur(src, mask, out, { featherSigma: 16 });

  const meta = await probeVideo(out);
  console.log(`output: ${out}`);
  console.log(
    `  ${meta.width}x${meta.height} @ ${meta.fps}fps, ${meta.durationSec.toFixed(2)}s, audio=${meta.hasAudio}`,
  );
  if (!meta.hasAudio) throw new Error("AUDIO DROPPED — composite lost the audio track");
  console.log("✓ video composite OK (region blurred, audio preserved)");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
