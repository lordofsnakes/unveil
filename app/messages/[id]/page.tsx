"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import {
  ArrowLeft,
  MoreHorizontal,
  Lock,
  Plus,
  Send,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useUnlock } from "@/components/useUnlock";

// A conversation is per-viewer (PPV cards resolve to the viewer's unlock state),
// so this is a live client view keyed on the connected wallet.

type TextMsg = { id: string; kind: "text"; me: boolean; text: string };
type PpvMsg = {
  id: string;
  kind: "ppv";
  me: boolean;
  revealed: boolean;
  title: string;
  caption: string;
  url?: string | null;
  mediaType?: "image" | "video";
  postId?: string;
  price?: string;
  priceLabel?: string;
  previewUrl?: string | null;
};
type Msg = TextMsg | PpvMsg;
type ThreadInfo = {
  id: string;
  name: string;
  avatar: string | null;
  viewerIsCreator: boolean;
};
type MyPost = {
  id: string;
  title: string;
  priceLabel: string;
  mediaType: "image" | "video";
  previewUrl: string | null;
};

export default function DmPage() {
  const { id } = useParams<{ id: string }>();
  const account = useAccount();
  const wallet = account.address;

  const [thread, setThread] = useState<ThreadInfo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!wallet) return;
    const res = await fetch(`/api/messages/${id}?wallet=${wallet}`);
    if (!res.ok) {
      setLoaded(true);
      return;
    }
    const d = (await res.json()) as { thread: ThreadInfo; messages: Msg[] };
    setThread(d.thread);
    setMessages(d.messages);
    setLoaded(true);
  }, [id, wallet]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function sendText() {
    const body = text.trim();
    if (!body || !wallet || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, kind: "text", body }),
      });
      if (res.ok) await load();
      else setText(body); // restore on failure
    } finally {
      setSending(false);
    }
  }

  async function sendPpv(postId: string) {
    if (!wallet) return;
    setAttachOpen(false);
    await fetch(`/api/messages/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, kind: "ppv", postId }),
    });
    await load();
  }

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
            <Avatar name={thread?.name ?? "…"} src={thread?.avatar} size="md" />
            <span
              className="absolute right-0 bottom-0 size-[11px] rounded-full"
              style={{ background: "var(--success)", border: "2px solid var(--surface)" }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[15.5px] font-semibold">
                {thread?.name ?? "Conversation"}
              </span>
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
        {!wallet ? (
          <p className="text-faint mt-16 text-center text-sm">
            Sign in to view this conversation.
          </p>
        ) : !loaded ? (
          <p className="text-faint mt-16 text-center text-sm">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-faint mt-16 text-center text-sm">
            No messages yet. Say hello 👋
          </p>
        ) : (
          messages.map((m) =>
            m.kind === "text" ? (
              <div
                key={m.id}
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
              <PpvCard key={m.id} msg={m} />
            ),
          )
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="bg-surface border-hairline border-t">
        <div
          className="mx-auto flex w-full max-w-md items-center gap-2.5 px-3.5 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        >
          {thread?.viewerIsCreator && (
            <button
              onClick={() => setAttachOpen(true)}
              className="text-muted flex size-[38px] shrink-0 items-center justify-center"
              aria-label="Attach locked content"
            >
              <Lock size={22} strokeWidth={1.9} />
            </button>
          )}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
            placeholder="Send a message…"
            disabled={!wallet}
            className="bg-surface-2 border-hairline text-text placeholder:text-faint h-[42px] flex-1 rounded-pill border px-4 text-[14px] outline-none"
          />
          <button
            onClick={sendText}
            disabled={!text.trim() || sending}
            className="bg-primary text-primary-fg flex size-[42px] shrink-0 items-center justify-center rounded-full disabled:opacity-50"
            style={{ boxShadow: "0 6px 18px var(--primary-glow)" }}
            aria-label="Send"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {attachOpen && wallet && (
        <AttachSheet
          wallet={wallet}
          onPick={sendPpv}
          onClose={() => setAttachOpen(false)}
        />
      )}
    </main>
  );
}

/** A pay-per-view card in a DM. Recipients unlock via the normal Tempo flow;
 *  the sender (creator) just sees their sent locked card. */
function PpvCard({ msg }: { msg: PpvMsg }) {
  const [revealedUrl, setRevealedUrl] = useState<string | null>(
    msg.revealed ? (msg.url ?? null) : null,
  );
  const { state, error, unlock, connected } = useUnlock(
    msg.postId ?? "",
    msg.price ?? "0",
    { onUnlock: (url) => setRevealedUrl(url) },
  );

  const showReveal = msg.revealed || state === "unlocked";

  return (
    <div className="flex justify-start">
      <div className="bg-surface-2 border-hairline w-[230px] overflow-hidden rounded-[20px] border">
        <div className="relative" style={{ aspectRatio: "4 / 5" }}>
          {showReveal && revealedUrl ? (
            msg.mediaType === "video" ? (
              <video
                src={revealedUrl}
                className="size-full object-cover"
                controls
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={revealedUrl} alt={msg.title} className="size-full object-cover" />
            )
          ) : (
            <>
              {msg.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={msg.previewUrl}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  style={{ filter: "blur(2px)", transform: "scale(1.05)" }}
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(130% 120% at 30% 12%,#5a2738,#1f131a 56%,#0c0a0c)",
                  }}
                />
              )}
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
                {msg.me ? (
                  <span className="text-[12.5px] text-white/90">
                    Locked · {msg.priceLabel} · sent
                  </span>
                ) : (
                  <button
                    onClick={unlock}
                    disabled={state === "pending" || !connected}
                    className="bg-primary text-primary-fg flex h-[42px] items-center gap-1.5 rounded-pill px-[18px] text-[13.5px] font-semibold disabled:opacity-60"
                    style={{ boxShadow: "0 6px 20px var(--primary-glow)" }}
                  >
                    {state === "pending" ? (
                      "Unlocking…"
                    ) : (
                      <>
                        Unlock ·{" "}
                        <span className="tabular font-medium">{msg.priceLabel}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {(msg.caption || msg.title) && (
          <div className="text-text px-3.5 py-2.5 text-[13.5px]">
            {msg.caption || msg.title}
          </div>
        )}
        {error && (
          <div className="text-danger px-3.5 pb-2.5 text-[12px]">{error}</div>
        )}
      </div>
    </div>
  );
}

/** Bottom sheet: pick one of the creator's posts to send as a locked DM card. */
function AttachSheet({
  wallet,
  onPick,
  onClose,
}: {
  wallet: string;
  onPick: (postId: string) => void;
  onClose: () => void;
}) {
  const [posts, setPosts] = useState<MyPost[] | null>(null);

  useEffect(() => {
    fetch(`/api/posts?wallet=${wallet}`)
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => setPosts([]));
  }, [wallet]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-surface border-hairline w-full max-w-md rounded-t-card border-t p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-semibold">Send locked content</span>
          <button onClick={onClose} aria-label="Close" className="text-muted">
            <X size={20} />
          </button>
        </div>
        {posts === null ? (
          <p className="text-faint py-8 text-center text-sm">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-faint py-8 text-center text-sm">
            You have no posts yet to send.
          </p>
        ) : (
          <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto">
            {posts.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p.id)}
                className="relative overflow-hidden rounded-md"
                style={{ aspectRatio: "4 / 5" }}
              >
                {p.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.previewUrl}
                    alt={p.title}
                    className="size-full object-cover"
                    style={{ filter: "blur(1px)" }}
                  />
                ) : (
                  <div className="bg-surface-2 size-full" />
                )}
                <span
                  className="tabular absolute bottom-1 left-1 rounded-pill px-1.5 py-0.5 text-[10px] text-white"
                  style={{ background: "rgba(8,6,8,.65)" }}
                >
                  {p.priceLabel}
                </span>
                <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/50 text-white">
                  <Plus size={14} />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
