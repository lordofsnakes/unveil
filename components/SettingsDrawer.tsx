"use client";

import { useDisconnect, useAccount } from "wagmi";
import {
  X,
  User,
  Layers,
  Settings as SettingsIcon,
  CreditCard,
  Building2,
  HelpCircle,
  Moon,
  Globe,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useTheme } from "./useTheme";

export function SettingsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { theme, toggle } = useTheme();
  const { disconnect } = useDisconnect();
  const account = useAccount();

  if (!open) return null;

  const isLight = theme === "light";
  const shortAddr = account.address
    ? `${account.address.slice(0, 6)}…${account.address.slice(-4)}`
    : "Not signed in";

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(4,3,5,.55)", animation: "vscrim .2s ease both" }}
      />
      <aside
        className="bg-surface fixed inset-y-0 right-0 z-50 flex w-[328px] max-w-[85vw] flex-col"
        style={{
          animation: "vdrawer .24s cubic-bezier(.22,1,.36,1) both",
          boxShadow: "-20px 0 60px rgba(0,0,0,.5)",
        }}
      >
        {/* Header */}
        <div className="border-hairline pt-safe border-b px-5 pt-6 pb-[18px]">
          <div className="flex items-start justify-between">
            <div className="relative size-[52px]">
              <div
                className="size-[52px] rounded-full"
                style={{ background: "conic-gradient(from 120deg,#3a3640,#1c1a22)" }}
              />
              <span
                className="absolute right-0 bottom-0 size-[13px] rounded-full"
                style={{ background: "var(--success)", border: "2px solid var(--surface)" }}
              />
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-text flex size-[34px] items-center justify-center"
              aria-label="Close"
            >
              <X size={22} />
            </button>
          </div>
          <div className="mt-3 text-lg font-bold">You</div>
          <div className="text-faint tabular mt-0.5 text-[13px]">{shortAddr}</div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto py-2">
          <Row icon={User} label="My profile" href="/profile" onNavigate={onClose} />
          <Row icon={Layers} label="Collections" />
          <Row icon={SettingsIcon} label="Settings" />
          <Divider />
          <Row icon={CreditCard} label="Your cards" hint="(to subscribe)" />
          <Row icon={Building2} label="Become a creator" hint="(to earn)" />
          <Divider />
          <Row icon={HelpCircle} label="Help and support" />

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="flex w-full items-center gap-3.5 px-[22px] py-3.5 text-left"
          >
            <Moon size={21} strokeWidth={1.8} className="text-muted" />
            <span className="flex-1 text-[15px] font-medium">
              {isLight ? "Light mode" : "Dark mode"}
            </span>
            <span
              className="relative h-6 w-[42px] rounded-pill transition-colors"
              style={{ background: isLight ? "var(--primary)" : "var(--surface-3)" }}
            >
              <span
                className="absolute top-0.5 size-5 rounded-full bg-white transition-[left]"
                style={{ left: isLight ? 20 : 2, boxShadow: "0 1px 3px rgba(0,0,0,.3)" }}
              />
            </span>
          </button>

          <button className="flex w-full items-center gap-3.5 px-[22px] py-3.5 text-left">
            <Globe size={21} strokeWidth={1.8} className="text-muted" />
            <span className="flex-1 text-[15px] font-medium">English</span>
            <ChevronDown size={18} className="text-faint" />
          </button>
          <Divider />
          <button
            onClick={() => {
              disconnect();
              onClose();
            }}
            className="flex w-full items-center gap-3.5 px-[22px] py-3.5 text-left"
          >
            <LogOut size={21} strokeWidth={1.8} className="text-muted" />
            <span className="text-[15px] font-medium">Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function Divider() {
  return <div className="bg-hairline mx-[22px] my-2 h-px" />;
}

function Row({
  icon: Icon,
  label,
  hint,
  href,
  onNavigate,
}: {
  icon: typeof User;
  label: string;
  hint?: string;
  href?: string;
  onNavigate?: () => void;
}) {
  const inner = (
    <>
      <Icon size={21} strokeWidth={1.8} className="text-muted" />
      <span className="text-[15px] font-medium">
        {label}
        {hint && <span className="text-faint font-normal"> {hint}</span>}
      </span>
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        onClick={onNavigate}
        className="flex items-center gap-3.5 px-[22px] py-3.5"
      >
        {inner}
      </a>
    );
  }
  return (
    <button className="flex w-full items-center gap-3.5 px-[22px] py-3.5 text-left">
      {inner}
    </button>
  );
}
