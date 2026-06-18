"use client";

import { useConnect, useConnectors } from "wagmi";
import { ScanFace, Lock } from "lucide-react";
import { Wordmark } from "./Wordmark";

/**
 * Full-screen connect hero (matches the prototype onboarding). "Sign in with
 * Face ID" triggers the Tempo passkey connector; a secondary action lets judges
 * browse the gated feed before connecting.
 */
export function Onboarding({ onSkip }: { onSkip: () => void }) {
  const { connect, isPending } = useConnect();
  const [connector] = useConnectors();

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{
        background:
          "radial-gradient(125% 78% at 50% 116%, rgba(194,20,59,.55), rgba(194,20,59,.08) 42%, transparent 62%), var(--bg)",
      }}
    >
      <div className="pt-safe absolute inset-x-0 top-0 flex flex-col items-center gap-3.5 pt-16">
        <span
          className="size-[42px] rounded-full"
          style={{
            background:
              "conic-gradient(from 215deg,var(--primary),#7a0c24 55%,var(--primary))",
            boxShadow: "0 0 26px var(--primary-glow)",
          }}
          aria-hidden
        />
        <span
          className="text-muted text-sm font-semibold"
          style={{ letterSpacing: "0.46em", paddingLeft: "0.46em" }}
        >
          VEIL
        </span>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-[18px] px-[30px] pb-14">
        <div className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
          Members only
        </div>
        <h1 className="text-[42px] leading-none font-bold tracking-tight">
          Lift the
          <br />
          veil.
        </h1>
        <p className="text-muted max-w-[312px] text-base leading-relaxed">
          Every post hides a secret. Subscribe to a creator, or tap to unlock{" "}
          <span className="text-text">just the one you want</span>.
        </p>

        <button
          onClick={() => connect({ connector })}
          disabled={isPending}
          className="bg-primary text-primary-fg mt-1.5 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-pill text-base font-semibold transition-transform duration-[140ms] ease-[var(--ease-veil)] active:scale-[0.97] disabled:opacity-60"
          style={{ boxShadow: "0 8px 28px var(--primary-glow)", animation: "vglow 3.2s ease-in-out infinite" }}
        >
          <ScanFace size={21} />
          {isPending ? "Opening wallet…" : "Sign in with Face ID"}
        </button>

        <button
          onClick={onSkip}
          className="border-hairline-strong text-text h-[50px] rounded-pill border text-[15px] font-semibold transition-transform duration-[140ms] ease-[var(--ease-veil)] active:scale-[0.97]"
        >
          Browse the feed
        </button>

        <div className="text-faint mt-0.5 flex items-center justify-center gap-2 text-xs">
          <Lock size={13} />
          Add to Home Screen to install
        </div>
      </div>
    </div>
  );
}
