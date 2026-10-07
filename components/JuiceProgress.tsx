/** Progress bar that fills like juice, with a moving wave edge. */
export function JuiceProgress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className="relative h-2 w-full overflow-hidden rounded-full bg-track"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div
        className="absolute inset-y-0 left-0 overflow-hidden rounded-full bg-mint"
        style={{
          width: `${pct}%`,
          transition: "width 700ms cubic-bezier(0.34, 1.3, 0.64, 1)",
        }}
      >
        <svg
          className="absolute inset-y-0 left-0 h-full w-[200%] opacity-60"
          viewBox="0 0 200 12"
          preserveAspectRatio="none"
          style={{ animation: "ju-wave 2.4s linear infinite" }}
          aria-hidden
        >
          <path
            d="M0 6 Q 12.5 1 25 6 T 50 6 T 75 6 T 100 6 T 125 6 T 150 6 T 175 6 T 200 6 V12 H0Z"
            fill="#2fc79f"
          />
        </svg>
        <div className="absolute inset-x-0 top-[2px] mx-1.5 h-[3px] rounded-full bg-white/50" />
      </div>
    </div>
  );
}

/** A glass that fills up to `value` (0..1) — used on the final score screen. */
export function JuiceGlass({ value, className = "" }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  // Inner glass area runs from y=18 (top) to y=150 (bottom).
  const top = 150 - 132 * pct;
  return (
    <svg viewBox="0 0 120 170" className={className} aria-hidden>
      <defs>
        <clipPath id="glass-clip">
          <path d="M14 14 H106 L94 152 Q93 160 85 160 H35 Q27 160 26 152 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#glass-clip)">
        <rect x="0" y="0" width="120" height="170" fill="var(--ju-field)" />
        <g
          style={{
            transform: `translateY(${top}px)`,
            transition: "transform 1600ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <g style={{ animation: "ju-wave 2.2s linear infinite", transformBox: "fill-box" }}>
            <path
              d="M0 6 Q 15 0 30 6 T 60 6 T 90 6 T 120 6 T 150 6 T 180 6 T 210 6 T 240 6 V200 H0Z"
              fill="#63e8c6"
            />
          </g>
          <g
            style={{ animation: "ju-wave 3.4s linear infinite reverse", transformBox: "fill-box" }}
            opacity="0.55"
          >
            <path
              d="M0 9 Q 15 4 30 9 T 60 9 T 90 9 T 120 9 T 150 9 T 180 9 T 210 9 T 240 9 V200 H0Z"
              fill="#2fc79f"
            />
          </g>
          {/* bubbles */}
          <circle cx="40" cy="40" r="3" fill="#fff" opacity="0.6">
            <animate attributeName="cy" values="60;20;60" dur="3.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="72" cy="50" r="2" fill="#fff" opacity="0.6">
            <animate attributeName="cy" values="70;25;70" dur="2.6s" repeatCount="indefinite" />
          </circle>
        </g>
      </g>
      <path
        d="M14 14 H106 L94 152 Q93 160 85 160 H35 Q27 160 26 152 Z"
        fill="none"
        stroke="var(--ju-paper)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* straw */}
      <path d="M78 2 L66 90" stroke="#ff67aa" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
