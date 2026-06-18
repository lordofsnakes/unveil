/**
 * "Proof of magic" chip — the beat that sells the Tempo story to judges.
 * Shown after every unlock: amount paid · settlement time · zero gas.
 */
export function ProofChip({
  amountUsd,
  settlementMs,
}: {
  amountUsd: string;
  settlementMs: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-green-700/40 bg-green-950/60 px-3 py-1.5 font-mono text-xs">
      <span className="text-green-400">✓</span>
      <span className="text-green-300">paid ${amountUsd}</span>
      <span className="text-gray-500">·</span>
      <span className="text-green-300">{settlementMs}ms</span>
      <span className="text-gray-500">·</span>
      <span className="text-green-300">$0 gas</span>
    </div>
  );
}
