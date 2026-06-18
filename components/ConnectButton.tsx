"use client";

import { useConnect, useConnectors, useDisconnect, useAccount } from "wagmi";
import { ScanFace } from "lucide-react";

export function ConnectButton() {
  const account = useAccount();
  const { connect, isPending } = useConnect();
  const [connector] = useConnectors();
  const { disconnect } = useDisconnect();

  if (account.status === "connected" && account.address) {
    return (
      <div className="flex items-center gap-2.5">
        <span className="tabular bg-surface-2 text-text rounded-pill px-3 py-1.5 text-[13px]">
          {account.address.slice(0, 6)}…{account.address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-faint hover:text-text text-[13px]"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector })}
      disabled={isPending}
      className="bg-primary text-primary-fg flex items-center gap-2 rounded-pill px-5 py-2.5 text-sm font-semibold transition-transform duration-[140ms] ease-[var(--ease-veil)] active:scale-[0.97] disabled:opacity-60"
    >
      <ScanFace size={17} />
      {isPending ? "Opening…" : "Sign in"}
    </button>
  );
}
