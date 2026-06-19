"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { Wordmark } from "./Wordmark";

export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header
      className="border-hairline-strong pt-safe text-text sticky top-0 z-40 border-b bg-[var(--header-bg)]"
      style={{ boxShadow: "0 8px 24px rgba(0,0,0,.28)" }}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-[18px] py-3.5">
        <Wordmark showMark={false} />
        <div className="flex items-center gap-1.5">
          <Link
            href="/search"
            className="text-muted hover:text-text flex size-[42px] items-center justify-center"
            aria-label="Search"
          >
            <Search size={22} />
          </Link>
          {children}
        </div>
      </div>
    </header>
  );
}
