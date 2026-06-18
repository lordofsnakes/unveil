// MCP-mode P1 helper (no local REPLICATE_API_TOKEN needed): extract a seed
// keyframe from the clip's midpoint, upload BOTH the keyframe and the clip to
// private Supabase Storage, and print presigned URLs. The grounding-dino + sam-2-video
// calls are then made out-of-band via the authenticated Replicate MCP.
//
//   tsx scripts/blur-video-prep.ts <video>
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { presignPrivateGet, uploadPrivate } from "../lib/blob";
import { probeVideo } from "../lib/blur/frames";

async function main() {
  const video = process.argv[2];
  if (!video) throw new Error("usage: tsx scripts/blur-video-prep.ts <video>");

  const meta = await probeVideo(video);
  const mid = meta.durationSec / 2; // seed from a mid-clip frame (stable content)
  const frameIndex = Math.round(mid * meta.fps);

  const work = mkdtempSync(join(tmpdir(), "veil-prep-"));
  const kf = join(work, "kf.jpg");
  execFileSync(
    ffmpegInstaller.path,
    ["-y", "-ss", String(mid), "-i", video, "-vframes", "1", "-q:v", "2", kf],
    { stdio: "ignore" },
  );

  const kfBlob = await uploadPrivate("blur-test/kf.jpg", readFileSync(kf), {
    contentType: "image/jpeg",
    upsert: true,
  });
  const vidBlob = await uploadPrivate("blur-test/clip.mp4", readFileSync(video), {
    contentType: "video/mp4",
    upsert: true,
  });

  console.log("FRAME_INDEX=" + frameIndex);
  console.log("FPS=" + Math.round(meta.fps));
  console.log("KEYFRAME_PATHNAME=" + kfBlob.pathname);
  console.log("VIDEO_PATHNAME=" + vidBlob.pathname);
  console.log("KEYFRAME_URL=" + (await presignPrivateGet(kfBlob.pathname, 1800)));
  console.log("VIDEO_URL=" + (await presignPrivateGet(vidBlob.pathname, 1800)));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
