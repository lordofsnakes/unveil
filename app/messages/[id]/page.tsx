import Link from "next/link";
import { ArrowLeft, MoreHorizontal, Lock, Image as ImageIcon, Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { getThread } from "@/lib/demo-threads";

// DM conversation — design Veil.dc.html §"DM CONVERSATION". No bottom nav here
// (the input bar takes its place); back returns to the thread list.
export const dynamic = "force-dynamic";

type Msg =
  | { kind: "text"; me: boolean; text: string }
  | { kind: "locked"; caption: string; priceLabel: string };

export default async function DmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const thread = getThread(id) ?? {
    id,
    name: "Creator",
    preview: "Hey you 💋",
    time: "now",
    unread: false,
  };

  const messages: Msg[] = [
    { kind: "text", me: false, text: "Hey you — so glad you made it 💋" },
    { kind: "text", me: false, text: thread.preview },
    { kind: "text", me: true, text: "Just subscribed! Obsessed already." },
    { kind: "locked", caption: "A little something just for you 🔥", priceLabel: "$4.99" },
    { kind: "text", me: false, text: "Let me know what you think 😘" },
  ];

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      {/* Header */}
      <header className="bg-surface/80 border-hairline pt-safe sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 py-3">
          <Link
            href="/messages"
            aria-label="Back"
            className="text-text flex size-[34px] items-center justify-center"
          >
            <ArrowLeft size={22} />
          </Link>
          <div className="relative">
            <Avatar name={thread.name} size="md" />
            <span
              className="absolute right-0 bottom-0 size-[11px] rounded-full"
              style={{ background: "var(--success)", border: "2px solid var(--surface)" }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[15.5px] font-semibold">{thread.name}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" fill="var(--primary)" />
                <path
                  d="m8 12 3 3 5-6"
                  stroke="#fff"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="mt-px text-[12px]" style={{ color: "var(--success)" }}>
              Active now
            </div>
          </div>
          <button
            className="text-muted flex size-[38px] items-center justify-center"
            aria-label="More"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      {/* Conversation */}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-2.5 px-3.5 py-[18px]">
        <div className="text-faint mb-1 text-center text-[11px]">Today</div>

        {messages.map((m, i) =>
          m.kind === "text" ? (
            <div
              key={i}
              className="flex"
              style={{ justifyContent: m.me ? "flex-end" : "flex-start" }}
            >
              <div
                className="max-w-[74%] rounded-[20px] px-3.5 py-2.5 text-[14.5px] leading-snug"
                style={{
                  background: m.me ? "var(--primary)" : "var(--surface-2)",
                  color: m.me ? "#fff" : "var(--text)",
                }}
              >
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="bg-surface-2 border-hairline w-[230px] overflow-hidden rounded-[20px] border">
                <div className="relative" style={{ aspectRatio: "4 / 5" }}>
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(130% 120% at 30% 12%,#5a2738,#1f131a 56%,#0c0a0c)",
                      filter: "blur(15px)",
                      transform: "scale(1.1)",
                    }}
                  />
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                    style={{ background: "rgba(8,6,8,.5)" }}
                  >
                    <div
                      className="border-hairline-strong flex size-[46px] items-center justify-center rounded-full text-white"
                      style={{ background: "rgba(8,6,8,.55)", borderWidth: 1 }}
                    >
                      <Lock size={20} />
                    </div>
                    <button
                      className="bg-primary text-primary-fg flex h-[42px] items-center gap-1.5 rounded-pill px-[18px] text-[13.5px] font-semibold"
                      style={{ boxShadow: "0 6px 20px var(--primary-glow)" }}
                    >
                      Unlock ·{" "}
                      <span className="tabular font-medium">{m.priceLabel}</span>
                    </button>
                  </div>
                </div>
                <div className="text-text px-3.5 py-2.5 text-[13.5px]">
                  {m.caption}
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      {/* Composer */}
      <div className="bg-surface border-hairline border-t">
        <div
          className="mx-auto flex w-full max-w-md items-center gap-2.5 px-3.5 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        >
          <button
            className="text-muted flex size-[38px] shrink-0 items-center justify-center"
            aria-label="Add media"
          >
            <ImageIcon size={24} strokeWidth={1.9} />
          </button>
          <div className="bg-surface-2 border-hairline text-faint flex h-[42px] flex-1 items-center rounded-pill border px-4 text-[14px]">
            Send a message…
          </div>
          <button
            className="bg-primary text-primary-fg flex size-[42px] shrink-0 items-center justify-center rounded-full"
            style={{ boxShadow: "0 6px 18px var(--primary-glow)" }}
            aria-label="Send"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </main>
  );
}
