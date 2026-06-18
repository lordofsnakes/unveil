import Link from "next/link";
import { Database, Sparkles } from "lucide-react";
import { getFeed } from "@/lib/db/queries";
import { presignPrivateGet } from "@/lib/blob";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";

// Feed depends on live DB + per-request account state, so render dynamically.
export const dynamic = "force-dynamic";

async function loadFeed(): Promise<FeedPost[] | null> {
  try {
    const rows = await getFeed(20, 0);
    return await Promise.all(
      rows.map(async (p) => ({
        id: p.id,
        title: p.title,
        // Preview blob is private; presign with a long TTL for the feed.
        blurredPreviewUrl: await presignPrivateGet(p.blurredPreviewUrl, 3600),
        unlockPrice: p.unlockPrice,
        mediaType: p.mediaType,
        creator: {
          username: p.creator?.username ?? null,
          avatar: p.creator?.avatar ?? null,
          wallet: p.creator?.walletAddress ?? null,
        },
      })),
    );
  } catch {
    // DB not provisioned yet — show the empty state instead of crashing.
    return null;
  }
}

export default async function FeedPage() {
  const posts = await loadFeed();

  return (
    <main className="flex min-h-dvh flex-1 flex-col">
      <TopBar />

      <div className="mx-auto w-full max-w-md flex-1 px-3.5 pt-3.5 pb-28">
        {/* Composer */}
        <Link
          href="/new"
          className="bg-surface-2 mb-4 flex items-center gap-3 rounded-card px-4 py-3.5"
        >
          <span
            className="size-[34px] shrink-0 rounded-full"
            style={{ background: "conic-gradient(from 120deg,#3a3640,#1c1a22)" }}
          />
          <span className="text-faint text-[15px]">Share something private…</span>
        </Link>

        {posts === null ? (
          <EmptyState
            icon={Database}
            title="Database not connected"
            body="Set DATABASE_URL, Supabase storage env, then run `npm run seed`."
          />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No posts yet"
            body="Run `npm run seed` to add demo content."
          />
        ) : (
          posts.map((post, i) => (
            <PostCard key={post.id} post={post} priority={i === 0} />
          ))
        )}
      </div>

      <BottomNav />
    </main>
  );
}
