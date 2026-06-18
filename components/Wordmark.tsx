/** The Veil wordmark: a conic-gradient seal + tracked letterforms. */
export function Wordmark({
  size = 19,
  dot = 23,
  className = "",
}: {
  size?: number;
  dot?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span
        className="shrink-0 rounded-full"
        style={{
          width: dot,
          height: dot,
          background:
            "conic-gradient(from 215deg,var(--primary),#7a0c24 55%,var(--primary))",
          boxShadow: "0 0 12px var(--primary-glow)",
        }}
        aria-hidden
      />
      <span
        className="font-bold"
        style={{ fontSize: size, letterSpacing: "0.2em", paddingLeft: "0.1em" }}
      >
        VEIL
      </span>
    </div>
  );
}
