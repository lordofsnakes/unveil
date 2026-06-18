"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Menu, Zap } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { FlexCard } from "@/components/FlexCard";
import { BottomNav } from "@/components/BottomNav";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { ConnectButton } from "@/components/ConnectButton";

type Loyalty = {
  points: string;
  stats: { unlockCount: number; totalPaid: string; avgSettleMs: number };
  onchain: boolean;
};

const GALLERY = [
  "radial-gradient(120% 120% at 30% 12%,#5a2738,#1f131a)",
  "linear-gradient(150deg,#2c2832,#12101a)",
  "radial-gradient(120% 120% at 72% 22%,#6a2031,#241420)",
  "conic-gradient(from 200deg,#4a2030,#1c1117,#4a2030)",
  "radial-gradient(120% 120% at 40% 80%,#3a2230,#140e12)",
  "linear-gradient(135deg,#3a1622,#160d12)",
];

export default function ProfilePage() {
  const account = useAccount();
  const [drawer, setDrawer] = useState(false);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);

  useEffect(() => {
    if (!account.address) return;
    let live = true;
    fetch(`/api/loyalty?wallet=${account.address}`)
      .then((r) => r.json())
      .then((d) => live && setLoyalty(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [account.address]);

  const connected = account.status === "connected" && account.address;
  const handle = account.address
    ? `@${account.address.slice(2, 8).toLowerCase()}`
    : "@you";
  const stats = loyalty?.stats;

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      {/* Header bar */}
      <header className="bg-surface/80 border-hairline pt-safe sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-[18px] py-3.5">
          <span className="text-xl font-bold">Profile</span>
          <button
            onClick={() => setDrawer(true)}
            className="text-muted hover:text-text flex size-[38px] items-center justify-center"
            aria-label="Menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-[18px] pt-5 pb-28">
        {!connected ? (
          <div className="mt-20 flex flex-col items-center gap-5 text-center">
            <Avatar name="you" size="xl" />
            <div>
              <p className="text-text font-semibold">Sign in to see your profile</p>
              <p className="text-faint mt-1 text-sm">
                Your unlocks, VEIL balance, and flex card live here.
              </p>
            </div>
            <ConnectButton />
          </div>
        ) : (
          <>
            {/* Identity */}
            <div className="flex items-end gap-4">
              <Avatar name={handle} size="xl" verified />
              <div className="flex-1 pb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-bold">You</span>
                </div>
                <div className="text-faint tabular mt-0.5 text-[13.5px]">{handle}</div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="h-[46px] flex-1 text-sm">
                Edit profile
              </Button>
              <Button variant="secondary" className="h-[46px] flex-1 text-sm">
                Share
              </Button>
            </div>

            {/* Lifetime proof strip (DESIGN_PRD §5.2) */}
            <div className="border-hairline mt-5 grid grid-cols-4 gap-px overflow-hidden rounded-md border">
              <ProofStat label="Unlocked" value={String(stats?.unlockCount ?? 0)} />
              <ProofStat label="Paid" value={`$${fmt(stats?.totalPaid ?? "0")}`} />
              <ProofStat
                label="Avg settle"
                value={stats?.avgSettleMs ? `${stats.avgSettleMs}ms` : "—"}
              />
              <ProofStat label="Gas" value="$0" accent />
            </div>

            {/* Flex card */}
            <div className="mt-6">
              <FlexCard
                handle={handle}
                balance={fmtPoints(loyalty?.points ?? "0")}
              />
              {loyalty?.onchain && (
                <div className="text-faint mt-2 flex items-center justify-center gap-1.5 text-[12px]">
                  <Zap size={12} className="text-success" />
                  VEIL minted on-chain
                </div>
              )}
            </div>

            {/* Collection */}
            <h2 className="text-text mt-7 mb-3 text-[15px] font-semibold">
              Your collection
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {GALLERY.map((g, i) => (
                <div
                  key={i}
                  className="rounded-md"
                  style={{ aspectRatio: "1", background: g }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav />
      <SettingsDrawer open={drawer} onClose={() => setDrawer(false)} />
    </main>
  );
}

function ProofStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-surface-2 px-1 py-3 text-center">
      <div
        className="tabular text-[15px] font-bold"
        style={accent ? { color: "var(--success)" } : undefined}
      >
        {value}
      </div>
      <div className="text-faint mt-0.5 text-[11px]">{label}</div>
    </div>
  );
}

function fmt(n: string): string {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(2) : "0.00";
}

function fmtPoints(n: string): string {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0";
}
