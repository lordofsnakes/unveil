// One-off helper for the auto-blur P0 test.
// Uploads a local image to a PRIVATE Vercel Blob and prints a short-lived
// signed GET URL that Replicate can fetch. Also supports deleting it after.
//
//   tsx scripts/blur-upload.ts <localPath>          # upload + presign
//   tsx scripts/blur-upload.ts --del <pathname>     # cleanup
//
// Requires BLOB_READ_WRITE_TOKEN in .env.local.
import { readFileSync } from "node:fs";
import { put, del } from "@vercel/blob";
import { presignPrivateGet } from "../lib/blob";

async function main() {
  const [arg1, arg2] = process.argv.slice(2);

  if (arg1 === "--del") {
    await del(arg2, { token: process.env.BLOB_READ_WRITE_TOKEN });
    console.log("DELETED=" + arg2);
    return;
  }

  const localPath = arg1;
  if (!localPath) throw new Error("usage: tsx scripts/blur-upload.ts <localPath>");

  const buf = readFileSync(localPath);
  const blob = await put("blur-test/source.png", buf, {
    access: "private",
    contentType: "image/png",
    allowOverwrite: true,
  });

  // 15 min — comfortably outlives a fast image prediction.
  const url = await presignPrivateGet(blob.pathname, 900);

  console.log("PATHNAME=" + blob.pathname);
  console.log("SIGNED_URL=" + url);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
