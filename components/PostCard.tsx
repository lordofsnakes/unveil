"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { UnlockButton } from "./UnlockButton";
import { ProofChip } from "./ProofChip";

export type FeedPost = {
  id: string;
  title: string;
  blurredPreviewUrl: string;
  unlockPrice: string;
  mediaType: "image" | "video";
  creator: { username: string | null; avatar: string | null };
};

export function PostCard({
  post,
  isUnlocked: initialUnlocked,
}: {
  post: FeedPost;
  isUnlocked?: boolean;
}) {
  const [unlocked, setUnlocked] = useState(initialUnlocked ?? false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [proof, setProof] = useState<{ settlementMs: number } | null>(null);

  const handleUnlock = useCallback((url: string, settlementMs: number) => {
    setSignedUrl(url);
    setUnlocked(true);
    setProof({ settlementMs });
  }, []);

  const username = post.creator.username ?? "creator";

  return (
    <div className="mb-4 overflow-hidden rounded-3xl border border-gray-800/50 bg-gray-950">
      {/* Creator header */}
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-sm font-bold">
          {username[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <p className="text-sm font-semibold">{username}</p>
          <p className="text-xs text-gray-500">Creator</p>
        </div>
      </div>

      {/* Media area */}
      <div className="relative aspect-square bg-gray-900">
        <AnimatePresence mode="wait">
          {unlocked && signedUrl ? (
            <motion.div
              key="revealed"
              initial={{ opacity: 0, filter: "blur(20px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <Image
                src={signedUrl}
                alt={post.title}
                fill
                className="object-cover"
                unoptimized
              />
            </motion.div>
          ) : (
            <motion.div key="locked" className="absolute inset-0">
              <Image
                src={post.blurredPreviewUrl}
                alt="Locked content"
                fill
                className="object-cover"
                style={{ filter: "blur(12px)", transform: "scale(1.1)" }}
                sizes="(max-width: 768px) 100vw, 500px"
                unoptimized
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-3xl">
                  🔒
                </div>
                <p className="text-center font-semibold text-white">
                  Unlock for{" "}
                  <span className="font-bold text-purple-400">
                    ${post.unlockPrice}
                  </span>
                </p>
                <UnlockButton
                  postId={post.id}
                  price={post.unlockPrice}
                  onUnlock={handleUnlock}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Post info */}
      <div className="p-4">
        <p className="mb-1 text-sm font-semibold">{post.title}</p>
        {proof && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2"
          >
            <ProofChip
              amountUsd={post.unlockPrice}
              settlementMs={proof.settlementMs}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
