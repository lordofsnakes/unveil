"use client";

import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { Hooks } from "wagmi/tempo";
import { parseUnits, pad, stringToHex } from "viem";
import { ALPHA_USD, STABLECOIN_DECIMALS } from "@/lib/constants";

const PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET as
  | `0x${string}`
  | undefined;

type UnlockState = "locked" | "pending" | "unlocked" | "error";

export function UnlockButton({
  postId,
  price,
  onUnlock,
}: {
  postId: string;
  price: string;
  onUnlock: (signedUrl: string, settlementMs: number) => void;
}) {
  const account = useAccount();
  const [state, setState] = useState<UnlockState>("locked");
  const [error, setError] = useState<string | null>(null);

  // Access-key signed: NO biometric prompt after the one-time authorization.
  const transfer = Hooks.token.useTransferSync();

  const handleUnlock = useCallback(async () => {
    if (!account.address) return;
    if (!PLATFORM_WALLET) {
      setState("error");
      setError("Platform wallet not configured");
      return;
    }
    setState("pending");
    setError(null);

    try {
      const started = Date.now();

      // 32-byte memo for creator-revenue reconciliation (first 16 bytes of postId).
      const memo = pad(stringToHex(postId.slice(0, 16)), { size: 32 });

      const result = await transfer.mutateAsync({
        amount: parseUnits(price, STABLECOIN_DECIMALS),
        to: PLATFORM_WALLET,
        token: ALPHA_USD,
        memo,
      });

      const settlementMs = Date.now() - started;
      const txHash = result.receipt?.transactionHash;

      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          paymentTxHash: txHash,
          walletAddress: account.address,
          settlementMs,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Unlock failed");
      }

      const { signedUrl } = (await res.json()) as { signedUrl: string };
      setState("unlocked");
      onUnlock(signedUrl, settlementMs);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [account.address, postId, price, transfer, onUnlock]);

  if (state === "unlocked") return null;

  return (
    <div className="w-full">
      <button
        onClick={handleUnlock}
        disabled={state === "pending" || account.status !== "connected"}
        className="w-full rounded-2xl bg-purple-600 py-4 text-lg font-bold text-white transition-all hover:bg-purple-700 disabled:opacity-50"
      >
        {state === "pending" ? "⚡ Processing…" : `🔓 Unlock for $${price}`}
      </button>
      {error && (
        <p className="mt-2 text-center text-sm text-red-400">{error}</p>
      )}
      {account.status !== "connected" && (
        <p className="mt-2 text-center text-xs text-gray-500">
          Connect wallet to unlock
        </p>
      )}
    </div>
  );
}
