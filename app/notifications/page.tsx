import { Avatar } from "@/components/ui/Avatar";
import { BottomNav } from "@/components/BottomNav";

const TABS = ["All", "Unveils", "Tips", "Mentions"];

const NOTIFS = [
  { who: "Velour", what: "unveiled your reply", time: "3m ago", amt: "+$0.02", credit: true },
  { who: "Maison Rouge", what: "tipped you", time: "1h ago", amt: "+$0.50", credit: true },
  { who: "Noir Studio", what: "mentioned you in a post", time: "4h ago", amt: "" },
  { who: "Velour", what: "subscribed to you", time: "Yesterday", amt: "" },
];

export default function NotificationsPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <header className="bg-surface/80 border-hairline pt-safe sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto w-full max-w-md px-[18px] py-3.5">
          <span className="text-xl font-bold">Notifications</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 pb-28">
        <div className="border-hairline flex gap-2 overflow-x-auto border-b px-[18px] py-3.5">
          {TABS.map((t, i) => (
            <span
              key={t}
              className="rounded-pill px-4 py-2 text-[13.5px] font-semibold whitespace-nowrap"
              style={
                i === 0
                  ? {
                      background: "var(--primary-tint)",
                      border: "1px solid rgba(194,20,59,.35)",
                      color: "var(--text)",
                    }
                  : { background: "var(--surface-2)", color: "var(--text-muted)" }
              }
            >
              {t}
            </span>
          ))}
        </div>

        <ul className="px-[18px]">
          {NOTIFS.map((n, i) => (
            <li
              key={i}
              className="border-hairline flex items-center gap-3.5 border-b py-3.5"
            >
              <Avatar name={n.who} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] leading-snug">
                  <span className="font-semibold">{n.who}</span>{" "}
                  <span className="text-muted">{n.what}</span>
                </p>
                <p className="text-faint mt-0.5 text-[12px]">{n.time}</p>
              </div>
              {n.amt && (
                <span
                  className="tabular text-[12.5px]"
                  style={{ color: n.credit ? "var(--success)" : "var(--text-faint)" }}
                >
                  {n.amt}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <BottomNav />
    </main>
  );
}
