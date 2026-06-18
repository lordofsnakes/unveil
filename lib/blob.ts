import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type UploadBody = Parameters<
  ReturnType<SupabaseClient["storage"]["from"]>["upload"]
>[1];

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
  const { data, error } = await storage().upload(normalized, body, {
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
  const { error } = await storage().remove(paths);
  if (error) throw error;
}

/** The stored key for private storage is its pathname (stable; presign on demand). */
export function privateKeyFromPut(result: StorageUploadResult): string {
  return result.pathname;
}
