import { formatUsd } from "@/lib/constants";

/**
 * "Proof of magic" chip — the beat that sells the Tempo story to judges.
 * Shown after every unlock: amount paid and settlement time.
 */
export function ProofChip({
  amountUsd,
  settlementMs,
}: {
  amountUsd: string;
  settlementMs: number;
}) {
  return (
    <div
      className="border-hairline inline-flex items-center gap-2 rounded-pill px-3 py-1.5 backdrop-blur-md"
      style={{ background: "var(--primary-tint)", borderWidth: 1 }}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{
          background: "var(--success)",
          animation: "vpulse 2s ease-in-out infinite",
        }}
        aria-hidden
      />
      <span className="text-success text-[11px] font-semibold tracking-wide">
        Settled
      </span>
      <span className="text-faint">·</span>
      <span className="tabular text-text text-[12.5px]">${formatUsd(amountUsd)}</span>
      <span className="text-faint">·</span>
      <span className="tabular text-text text-[12.5px]">{settlementMs}ms</span>
    </div>
  );
}
