"use client";

import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { Hooks } from "wagmi/tempo";
import { parseUnits } from "viem";
import { Lock } from "lucide-react";
import { ALPHA_USD, STABLECOIN_DECIMALS, formatUsd } from "@/lib/constants";

const PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET as
  | `0x${string}`
  | undefined;

type UnlockState = "locked" | "pending" | "unlocked" | "error";

function haptic(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* unsupported — non-fatal */
    }
  }
}

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
    haptic(8); // the tap

    try {
      const started = Date.now();

      // Plain TIP-20 transfer (access-key signed). NOTE: do NOT pass a `memo` —
      // that routes to transferWithMemo, which the access-key spend-limit
      // validator rejects. Reconciliation is handled in the DB (unlocks table).
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
      onUnlock(signedUrl, settlementMs);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [account.address, postId, price, transfer, onUnlock]);

  if (state === "unlocked") return null;

  const connected = account.status === "connected";
  const pending = state === "pending";

  return (
    <div className="flex w-full flex-col items-center gap-2.5">
      <button
        onClick={handleUnlock}
        disabled={pending || !connected}
        className="bg-primary text-primary-fg flex h-[50px] min-w-[188px] items-center justify-center gap-2.5 rounded-pill px-6 text-[15.5px] font-semibold transition-transform duration-[140ms] ease-[var(--ease-veil)] active:scale-[0.96] disabled:opacity-60"
        style={{ boxShadow: "0 8px 30px var(--primary-glow)" }}
      >
        {pending ? (
          <>
            <span
              aria-hidden
              className="size-[17px] rounded-full border-2 border-white/35 border-t-white"
              style={{ animation: "vspin 0.7s linear infinite" }}
            />
            <span>Unlocking…</span>
          </>
        ) : (
          <>
            <Lock size={18} strokeWidth={2.2} />
            <span>
              Unlock · <span className="tabular font-medium">${formatUsd(price)}</span>
            </span>
          </>
        )}
      </button>

      {error ? (
        <p className="text-danger text-center text-xs">{error}</p>
      ) : (
        <p className="text-center text-xs" style={{ color: "rgba(245,242,243,.7)" }}>
          {connected ? "Tap to unlock and reveal" : "Sign in to unlock"}
        </p>
      )}
    </div>
  );
}
