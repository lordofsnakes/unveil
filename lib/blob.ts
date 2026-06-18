import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  del as deleteBlob,
  issueSignedToken,
  presignUrl,
  put,
  type PutBlobResult,
} from "@vercel/blob";

type SupabaseUploadBody = Parameters<
  ReturnType<SupabaseClient["storage"]["from"]>["upload"]
>[1];
type BlobUploadBody = Parameters<typeof put>[1];
type UploadBody = SupabaseUploadBody | BlobUploadBody;

export type StorageUploadResult = {
  pathname: string;
};

let supabaseAdmin: SupabaseClient | null = null;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function bucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET ?? "media";
}

function hasSupabaseStorage() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function requireBlobToken() {
  return requireEnv("BLOB_READ_WRITE_TOKEN", process.env.BLOB_READ_WRITE_TOKEN);
}

function storage() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      requireEnv("SUPABASE_URL", process.env.SUPABASE_URL),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
      {
        auth: { persistSession: false },
      },
    );
  }

  return supabaseAdmin.storage.from(bucketName());
}

function normalizePath(pathname: string) {
  return pathname.replace(/^\/+/, "");
}

/**
 * Upload a private object to Supabase Storage. The DB stores only the object
 * path; callers presign it on demand.
 */
export async function uploadPrivate(
  pathname: string,
  body: UploadBody,
  options: { contentType?: string; upsert?: boolean } = {},
): Promise<StorageUploadResult> {
  const normalized = normalizePath(pathname);

  if (!hasSupabaseStorage()) {
    requireBlobToken();
    const blob = await put(normalized, body as BlobUploadBody, {
      access: "private",
      allowOverwrite: options.upsert ?? true,
      contentType: options.contentType,
    });
    return { pathname: blob.pathname };
  }

  const { data, error } = await storage().upload(normalized, body as SupabaseUploadBody, {
    contentType: options.contentType,
    upsert: options.upsert ?? true,
  });

  if (error) throw error;
  return { pathname: data.path };
}

/**
 * Mint a short-lived signed GET URL for a private Supabase Storage object.
 *
 * @param pathname object path, e.g. "media/<postId>/original.jpg"
 * @param ttlSeconds URL lifetime — 60s for images, 300s for video.
 */
export async function presignPrivateGet(
  pathname: string,
  ttlSeconds = 60,
): Promise<string> {
  if (!hasSupabaseStorage()) {
    const validUntil = Date.now() + ttlSeconds * 1000;
    const signed = await issueSignedToken({
      pathname: normalizePath(pathname),
      operations: ["get"],
      validUntil,
      token: requireBlobToken(),
    });

    const { presignedUrl } = await presignUrl(signed, {
      operation: "get",
      pathname: normalizePath(pathname),
      validUntil,
      access: "private",
    });
    return presignedUrl;
  }

  const { data, error } = await storage().createSignedUrl(
    normalizePath(pathname),
    ttlSeconds,
  );

  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Supabase did not return a signed URL");
  return data.signedUrl;
}

export async function deletePrivate(pathname: string | string[]) {
  const paths = (Array.isArray(pathname) ? pathname : [pathname]).map(normalizePath);
  if (!hasSupabaseStorage()) {
    requireBlobToken();
    await deleteBlob(paths);
    return;
  }
  const { error } = await storage().remove(paths);
  if (error) throw error;
}

/** The stored key for private storage is its pathname (stable; presign on demand). */
export function privateKeyFromPut(result: StorageUploadResult | PutBlobResult): string {
  return result.pathname;
}
