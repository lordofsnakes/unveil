"use client";

import { ConnectButton } from "./ConnectButton";

export function TopBar() {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-800/50 bg-black/80 px-4 py-3 backdrop-blur-md pt-safe">
      <h1 className="text-xl font-bold">Veil</h1>
      <ConnectButton />
    </div>
  );
}
