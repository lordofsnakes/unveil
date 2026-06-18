import { issueSignedToken, presignUrl, type PutBlobResult } from "@vercel/blob";

/**
 * Mint a short-lived signed GET URL for a PRIVATE blob.
 *
 * @vercel/blob v2 flow: issue a scoped delegation token, then presign a
 * concrete object URL. The unblurred media never reaches the client until
 * payment is verified, and the URL expires quickly so it can't be shared.
 *
 * @param pathname  blob pathname, e.g. "media/<postId>/original.jpg"
 *                  (the `pathname` field returned by `put()`)
 * @param ttlSeconds  URL lifetime — 60s for images, 300s for video.
 */
export async function presignPrivateGet(
  pathname: string,
  ttlSeconds = 60,
): Promise<string> {
  const validUntil = Date.now() + ttlSeconds * 1000;
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  const signed = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
    token,
  });

  const { presignedUrl } = await presignUrl(signed, {
    operation: "get",
    pathname,
    validUntil,
    access: "private",
  });

  return presignedUrl;
}

/** The stored key for a private blob is its pathname (stable; presign on demand). */
export function privateKeyFromPut(result: PutBlobResult): string {
  return result.pathname;
}
