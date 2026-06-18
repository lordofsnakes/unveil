"use client";

import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { Hooks } from "wagmi/tempo";
import { parseUnits, BaseError, UserRejectedRequestError } from "viem";
import { ALPHA_USD, STABLECOIN_DECIMALS } from "@/lib/constants";

/**
 * Turn a transfer/unlock failure into one short, human line. The raw viem
 * revert (a multi-paragraph dump with calldata + sender) is kept in the console
 * for debugging but must never reach the UI, where it bled across the post.
 */
function friendlyUnlockError(err: unknown): string {
  console.error("[unlock] failed:", err);

  if (err instanceof BaseError) {
    // User dismissed the passkey / wallet prompt.
    if (err.walk((e) => e instanceof UserRejectedRequestError)) {
      return "Unlock cancelled.";
    }
    // On-chain revert — on testnet this is almost always an empty AlphaUSD
    // balance. The token reverts with no reason string, so we can't be more
    // specific without a pre-flight balance read.
    if (/revert/i.test(err.shortMessage) || /revert/i.test(err.message)) {
      return "Payment failed — check your balance and try again.";
    }
    return err.shortMessage || "Couldn't complete the unlock. Please try again.";
  }

  // Errors we throw ourselves (e.g. from /api/unlock) are already short.
  if (err instanceof Error) return err.message;
  return "Couldn't complete the unlock. Please try again.";
}

const PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET as
  | `0x${string}`
  | undefined;

export type UnlockState = "locked" | "pending" | "unlocked" | "error";

function haptic(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* unsupported — non-fatal */
    }
  }
}

/**
 * The pay-to-unlock flow, shared by the feed's <UnlockButton> and DM PPV cards.
 * Performs the access-key-signed TIP-20 transfer, then records it via
 * /api/unlock and returns the short-lived signed URL. NOTE: no `memo` on the
 * transfer — that routes to transferWithMemo, which the spend-limit validator
 * rejects; reconciliation lives in the unlocks table.
 */
export function useUnlock(
  postId: string,
  price: string,
  opts?: { onUnlock?: (signedUrl: string, settlementMs: number) => void },
) {
  const account = useAccount();
  const [state, setState] = useState<UnlockState>("locked");
  const [error, setError] = useState<string | null>(null);
  const transfer = Hooks.token.useTransferSync();

  const unlock = useCallback(async () => {
    if (!account.address) return;
    if (!PLATFORM_WALLET) {
      setState("error");
      setError("Platform wallet not configured");
      return;
    }
    setState("pending");
    setError(null);
    haptic(8); // the tap

    try {
      const started = Date.now();

      const result = await transfer.mutateAsync({
        amount: parseUnits(price, STABLECOIN_DECIMALS),
        to: PLATFORM_WALLET,
        token: ALPHA_USD,
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
      haptic([6, 40, 12]); // settled
      opts?.onUnlock?.(signedUrl, settlementMs);
    } catch (err) {
      setState("error");
      setError(friendlyUnlockError(err));
    }
  }, [account.address, postId, price, transfer, opts]);

  return {
    state,
    error,
    unlock,
    connected: account.status === "connected",
  };
}
