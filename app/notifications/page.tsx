"use client";

import { useEffect, useState } from "react";
import { Bell, KeyRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { ConnectButton } from "@/components/ConnectButton";
import { EmptyState } from "@/components/EmptyState";
import { timeAgo } from "@/lib/time";
import { useAppAuth } from "@/components/useAppAuth";
import { usePasskeyEnrollment } from "@/components/usePasskeyEnrollment";

type Notif = {
  id: string;
  actor: string;
  avatar: string | null;
  action: string;
  postTitle: string;
  amount: string;
  at: string;
};

export default function NotificationsPage() {
  const { isSignedIn } = useAppAuth();
  const connected = isSignedIn === true;
  const passkey = usePasskeyEnrollment();
  // Local-only synthetic notification — never returned by /api/notifications.
  const showPasskeyNotif = passkey.canEnroll && !passkey.isDismissed;
  const [items, setItems] = useState<Notif[] | null>(null);

  useEffect(() => {
    if (!connected) return;
    let live = true;
    setItems(null);
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => live && setItems(d.items ?? []))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [connected]);

  return (
    <main className="flex min-h-dvh flex-1 flex-col">
      <header className="bg-surface/80 border-hairline pt-safe sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto w-full max-w-md px-[18px] py-3.5">
          <span className="text-xl font-bold">Notifications</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 pb-28">
        {!connected ? (
          <div className="mt-24 flex flex-col items-center gap-5 px-8 text-center">
            <Avatar name="you" size="xl" />
            <div>
              <p className="text-text font-semibold">Sign in to see activity</p>
              <p className="text-faint mt-1 text-sm">
                Unlocks and earnings on your posts show up here.
              </p>
            </div>
            <ConnectButton />
          </div>
        ) : (
          <>
            {showPasskeyNotif && (
              <ul className="px-[18px]">
                <PasskeyNotifRow
                  isPending={passkey.isPending}
                  error={passkey.error}
                  onAdd={passkey.enrollPasskey}
                  onLater={passkey.dismissPrompt}
                />
              </ul>
            )}
            {items === null ? (
              <p className="text-faint mt-16 text-center text-sm">Loading…</p>
            ) : items.length === 0 ? (
              showPasskeyNotif ? null : (
                <div className="mt-10">
                  <EmptyState
                    icon={Bell}
                    title="Nothing yet"
                    body="When someone unveils one of your posts, you'll see it here."
                  />
                </div>
              )
            ) : (
              <ul className="px-[18px]">
                {items.map((n) => (
                  <li
                    key={n.id}
                    className="border-hairline flex items-center gap-3.5 border-b py-3.5"
                  >
                    <Avatar name={n.actor} src={n.avatar} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] leading-snug">
                        <span className="font-semibold">{n.actor}</span>{" "}
                        <span className="text-muted">{n.action} </span>
                        <span className="text-text">“{n.postTitle}”</span>
                      </p>
                      <p className="text-faint mt-0.5 text-[12px]">
                        {timeAgo(n.at)}
                      </p>
                    </div>
                    <span
                      className="tabular text-[12.5px]"
                      style={{ color: "var(--success)" }}
                    >
                      {n.amount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function PasskeyNotifRow({
  isPending,
  error,
  onAdd,
  onLater,
}: {
  isPending: boolean;
  error: string | null;
  onAdd: () => void;
  onLater: () => void;
}) {
  return (
    <li className="border-hairline flex items-center gap-3.5 border-b py-3.5">
      <span className="bg-primary/15 text-primary flex size-11 shrink-0 items-center justify-center rounded-full">
        <KeyRound size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] leading-snug">
          <span className="font-semibold">Add a passkey</span>{" "}
          <span className="text-muted">to make future logins faster.</span>
        </p>
        {error && <p className="text-danger mt-0.5 text-[12px]">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onLater}
          disabled={isPending}
          className="text-muted hover:text-text text-[12.5px] font-semibold disabled:opacity-50"
        >
          Later
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={isPending}
          className="bg-primary text-primary-fg rounded-pill px-3 py-1.5 text-[12.5px] font-bold disabled:opacity-60"
        >
          {isPending ? "…" : "Add"}
        </button>
      </div>
    </li>
  );
}
