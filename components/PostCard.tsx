"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import {
  Heart,
  MessageCircle,
  CircleDollarSign,
  Bookmark,
  MoreHorizontal,
  Lock,
} from "lucide-react";
import { Avatar } from "./ui/Avatar";
import { UnlockButton } from "./UnlockButton";
import { ProofChip } from "./ProofChip";
import { RevealMedia } from "./RevealMedia";

export type FeedPost = {
  id: string;
  title: string;
  blurredPreviewUrl: string;
  unlockPrice: string;
  mediaType: "image" | "video";
  creator: { username: string | null; avatar: string | null; wallet: string | null };
};

export function PostCard({
  post,
  isUnlocked: initialUnlocked,
  priority = false,
}: {
  post: FeedPost;
  isUnlocked?: boolean;
  priority?: boolean;
}) {
  const account = useAccount();
  const router = useRouter();
  const free = Number(post.unlockPrice) === 0;
  const [unlocked, setUnlocked] = useState(initialUnlocked ?? false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [proof, setProof] = useState<{ settlementMs: number } | null>(null);
  const [messaging, setMessaging] = useState(false);

  const handleUnlock = useCallback((url: string, settlementMs: number) => {
    setSignedUrl(url);
    setUnlocked(true);
    setProof({ settlementMs });
  }, []);

  const messageCreator = useCallback(async () => {
    if (!account.address || !post.creator.wallet || messaging) return;
    setMessaging(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: account.address,
          creatorWallet: post.creator.wallet,
        }),
      });
      if (res.ok) {
        const { threadId } = (await res.json()) as { threadId: string };
        router.push(`/messages/${threadId}`);
      }
    } finally {
      setMessaging(false);
    }
  }, [account.address, post.creator.wallet, messaging, router]);

  const username = post.creator.username ?? "creator";
  const revealed = unlocked || free;

  return (
    <article
      className="bg-surface-2 mb-4 overflow-hidden rounded-card"
      style={{ boxShadow: "0 8px 24px rgba(0,0,0,.32)" }}
    >
      {/* Creator header */}
      <header className="flex items-center gap-3 px-4 pt-3.5 pb-3">
        <Avatar name={username} src={post.creator.avatar} size="lg" verified />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-tight font-semibold">{username}</p>
          <p className="text-faint text-[12.5px] leading-snug">@{username}</p>
        </div>
        <button
          type="button"
          className="text-faint hover:text-muted flex size-9 items-center justify-center"
          aria-label="More"
        >
          <MoreHorizontal size={20} />
        </button>
      </header>

      {/* Caption */}
      <p className="text-text px-4 pb-3 text-[15.5px] leading-relaxed">
        {post.title}
      </p>

      {/* Media + blur gate / reveal */}
      <RevealMedia
        previewUrl={post.blurredPreviewUrl}
        revealedUrl={signedUrl}
        revealed={revealed}
        alt={post.title}
        priority={priority}
        overlay={
          !free && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6"
              style={{ background: "rgba(8,6,8,.46)" }}
            >
              <div
                className="border-hairline-strong flex size-[54px] items-center justify-center rounded-full"
                style={{ background: "rgba(8,6,8,.55)", borderWidth: 1 }}
              >
                <Lock size={24} />
              </div>
              <UnlockButton
                postId={post.id}
                price={post.unlockPrice}
                onUnlock={handleUnlock}
              />
            </div>
          )
        }
      />

      {/* Footer */}
      <footer className="px-4 pt-3.5 pb-3.5">
        {proof && (
          <motion.div
            className="mb-3"
            style={{ animation: "vspring 0.5s var(--ease-veil) both" }}
          >
            <ProofChip
              amountUsd={post.unlockPrice}
              settlementMs={proof.settlementMs}
            />
          </motion.div>
        )}
        <div className="text-muted flex items-center gap-2">
          <button
            type="button"
            className="flex size-10 items-center justify-center gap-1.5 text-[13.5px] hover:text-text"
            aria-label="Like"
          >
            <Heart size={22} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={messageCreator}
            disabled={messaging || !account.address || !post.creator.wallet}
            aria-label="Message creator"
            className="flex size-10 items-center justify-center hover:text-text disabled:opacity-50"
          >
            <MessageCircle size={22} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            className="flex h-10 items-center gap-1.5 rounded-pill px-1 text-[13px] font-semibold hover:text-text"
            aria-label="Tip"
          >
            <CircleDollarSign size={22} strokeWidth={1.9} />
            <span>Tip</span>
          </button>
          <div className="flex-1" />
          <button
            type="button"
            aria-label="Save"
            className="flex size-10 items-center justify-center hover:text-text"
          >
            <Bookmark size={21} strokeWidth={1.9} />
          </button>
        </div>
      </footer>
    </article>
  );
}
