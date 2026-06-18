"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bell, Plus, MessageCircle } from "lucide-react";

const TABS = [
  { href: "/", label: "Feed", icon: Home },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "12" },
  { href: "/messages", label: "Messages", icon: MessageCircle, badge: "3" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="bg-surface/95 border-hairline fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-xl"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-around px-4 pt-2">
        <NavTab {...TABS[0]} active={isActive(TABS[0].href)} />
        <NavTab {...TABS[1]} active={isActive(TABS[1].href)} />

        {/* Center: New post */}
        <Link
          href="/new"
          aria-label="New post"
          className="bg-primary text-primary-fg flex h-[42px] w-[50px] items-center justify-center rounded-[14px]"
          style={{ boxShadow: "0 6px 20px var(--primary-glow)" }}
        >
          <Plus size={24} strokeWidth={2.3} />
        </Link>

        <NavTab {...TABS[2]} active={isActive(TABS[2].href)} />

        {/* Profile */}
        <Link
          href="/profile"
          aria-label="Profile"
          className="flex size-12 items-center justify-center"
        >
          <span
            className="size-[30px] rounded-full"
            style={{
              background: "conic-gradient(from 120deg,#3a3640,#1c1a22)",
              boxShadow: `0 0 0 2px ${isActive("/profile") ? "var(--primary)" : "transparent"}`,
            }}
          />
        </Link>
      </div>
    </nav>
  );
}

function NavTab({
  href,
  label,
  icon: Icon,
  badge,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="relative flex size-12 items-center justify-center transition-colors"
      style={{ color: active ? "var(--primary)" : "var(--faint)" }}
    >
      <Icon size={25} strokeWidth={1.9} />
      {badge && (
        <span
          className="bg-primary text-primary-fg tabular absolute top-1 right-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
