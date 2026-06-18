import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { THREADS } from "@/lib/demo-threads";

export default function MessagesPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <header className="bg-surface/80 border-hairline pt-safe sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto w-full max-w-md px-[18px] py-3.5">
          <span className="text-xl font-bold">Messages</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 pb-28">
        <div className="flex items-center gap-2.5 px-[18px] pt-3.5 pb-2.5">
          <span
            className="rounded-pill px-4 py-1.5 text-[13px] font-semibold"
            style={{
              background: "var(--primary-tint)",
              border: "1px solid rgba(194,20,59,.35)",
              color: "var(--text)",
            }}
          >
            All
          </span>
          <span className="bg-surface-2 text-muted flex items-center gap-1.5 rounded-pill px-4 py-1.5 text-[13px] font-medium">
            Unread <span className="tabular text-primary">3</span>
          </span>
        </div>

        <ul className="px-[18px]">
          {THREADS.map((t) => (
            <li key={t.id} className="border-hairline border-b">
              <Link
                href={`/messages/${t.id}`}
                className="flex items-center gap-3.5 py-3.5"
              >
                <Avatar name={t.name} size="lg" verified />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{t.name}</p>
                  <p className="text-muted mt-0.5 truncate text-[13.5px]">{t.preview}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-faint text-[12px]">{t.time}</span>
                  {t.unread && (
                    <span className="bg-primary size-[9px] rounded-full" />
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <BottomNav />
    </main>
  );
}
