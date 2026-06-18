"use client";

import { Search } from "lucide-react";
import { Wordmark } from "./Wordmark";

export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="bg-surface/80 border-hairline pt-safe sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-[18px] py-3.5">
        <Wordmark />
        <div className="flex items-center gap-1">
          {children}
          <button
            type="button"
            disabled
            className="text-muted flex size-[42px] items-center justify-center opacity-45"
            aria-label="Search unavailable"
          >
            <Search size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}
