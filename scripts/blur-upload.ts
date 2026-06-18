// One-off helper for the auto-blur P0 test.
// Uploads a local image to private Supabase Storage and prints a short-lived
// signed GET URL that Replicate can fetch. Also supports deleting it after.
//
//   tsx scripts/blur-upload.ts <localPath>          # upload + presign
//   tsx scripts/blur-upload.ts --del <pathname>     # cleanup
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
import { readFileSync } from "node:fs";
import { deletePrivate, presignPrivateGet, uploadPrivate } from "../lib/blob";

async function main() {
  const [arg1, arg2] = process.argv.slice(2);

  if (arg1 === "--del") {
    await deletePrivate(arg2);
    console.log("DELETED=" + arg2);
    return;
  }

  const localPath = arg1;
  if (!localPath) throw new Error("usage: tsx scripts/blur-upload.ts <localPath>");

  const buf = readFileSync(localPath);
  const blob = await uploadPrivate("blur-test/source.png", buf, {
    contentType: "image/png",
    upsert: true,
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
