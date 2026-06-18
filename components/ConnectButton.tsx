"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Landmark } from "lucide-react";

type Account = {
  userId: string;
  availableBalance: string;
  escrowedBalance: string;
};

function formatMoney(value: string | null) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function ConnectButton() {
  const [account, setAccount] = useState<Account | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAccount = useCallback(async () => {
    const res = await fetch("/api/account", { cache: "no-store" });
    if (!res.ok) return;

    const body = (await res.json()) as { account: Account };
    setAccount(body.account);
  }, []);

  useEffect(() => {
    void refreshAccount();

    const refresh = () => void refreshAccount();
    window.addEventListener("veil:balance-changed", refresh);
    return () => window.removeEventListener("veil:balance-changed", refresh);
  }, [refreshAccount]);

  const startDeposit = useCallback(
    async (amount: string) => {
      setIsPending(true);
      setError(null);

      try {
        const res = await fetch("/api/account/deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };
        if (!res.ok || !body.url) {
          throw new Error(body.error ?? "Deposit failed");
        }
        window.location.assign(body.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Deposit failed");
        setIsPending(false);
      }
    },
    [],
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((open) => !open)}
        className="bg-primary text-primary-fg rounded-pill px-5 py-2.5 text-sm font-semibold transition-transform duration-[140ms] ease-[var(--ease-veil)] active:scale-[0.97]"
      >
        {account ? formatMoney(account.availableBalance) : "Balance"}
      </button>

      {isOpen && (
        <div className="border-hairline bg-surface-1 absolute right-0 top-12 z-50 w-64 rounded-[22px] p-4 shadow-2xl">
          <div>
            <p className="text-faint text-xs uppercase tracking-wide">
              Available
            </p>
            <p className="text-text mt-1 text-2xl font-bold">
              {formatMoney(account?.availableBalance ?? null)}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => startDeposit("10")}
              disabled={isPending}
              className="bg-surface-2 text-text flex items-center justify-center gap-1.5 rounded-[14px] px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <CreditCard size={15} />
              $10
            </button>
            <button
              onClick={() => startDeposit("25")}
              disabled={isPending}
              className="bg-surface-2 text-text flex items-center justify-center gap-1.5 rounded-[14px] px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <CreditCard size={15} />
              $25
            </button>
            <button
              onClick={() => startDeposit("50")}
              disabled={isPending}
              className="bg-surface-2 text-text col-span-2 flex items-center justify-center gap-1.5 rounded-[14px] px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <Landmark size={15} />
              Add $50
            </button>
          </div>

          {error && <p className="text-danger mt-3 text-sm">{error}</p>}
        </div>
      )}
    </div>
  );
}
