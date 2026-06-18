"use client";

import { useConnect, useConnectors, useDisconnect, useAccount } from "wagmi";

export function ConnectButton() {
  const account = useAccount();
  const { connect, isPending } = useConnect();
  const [connector] = useConnectors();
  const { disconnect } = useDisconnect();

  if (account.status === "connected" && account.address) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">
          {account.address.slice(0, 6)}…{account.address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-xs text-gray-400 hover:text-white"
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
      className="rounded-2xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
    >
      {isPending ? "Opening wallet…" : "🔐 Sign in with Face ID"}
    </button>
  );
}
