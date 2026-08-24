import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Figures on white. `tint` turns it into one of the pastel tiles from the
 * design reference, with a small icon chip above the number.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  tint,
  glyph,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "brand" | "green";
  tint?: "lilac" | "amber" | "mint" | "blue";
  glyph?: string;
  className?: string;
}) {
  const tints = {
    lilac: { bg: "bg-lilac-tint", chip: "bg-white text-lilac", value: "text-lilac" },
    amber: { bg: "bg-amber-tint", chip: "bg-white text-amber-dark", value: "text-amber-dark" },
    mint: {
      bg: "bg-grid-green-tint",
      chip: "bg-white text-grid-green",
      value: "text-grid-green",
    },
    blue: { bg: "bg-brand-tint", chip: "bg-white text-brand", value: "text-brand" },
  } as const;

  if (tint) {
    const t = tints[tint];
    return (
      <div className={clsx("vg-tile", t.bg, className)}>
        {glyph ? (
          <span
            className={clsx(
              "mb-2.5 flex h-8 w-8 items-center justify-center rounded-[10px] font-display text-[13px] font-bold",
              t.chip,
            )}
            aria-hidden
          >
            {glyph}
          </span>
        ) : null}
        <div className={clsx("font-display text-[20px] font-bold", t.value)}>{value}</div>
        <div className="mt-0.5 text-[11.5px] font-medium text-muted">{label}</div>
      </div>
    );
  }

  return (
    <div className={clsx("vg-card p-4.5 px-5 py-4.5", className)}>
      <div className="text-[12px] font-medium text-faint">{label}</div>
      <div
        className={clsx(
          "mt-1.5 font-display text-[23px] font-bold tracking-[-0.02em]",
          tone === "brand" && "text-brand",
          tone === "green" && "text-grid-green",
          tone === "default" && "text-ink",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-[12px] text-faint">{hint}</div> : null}
    </div>
  );
}

/**
 * Rounded bars, pale by default with the peak picked out in solid blue —
 * the treatment used on the concept's "Statistic" card.
 */
export function BarChart({
  data,
  height = 56,
  accent = "var(--color-brand)",
  pale = "var(--color-brand-tint)",
  labels,
  format = (v: number) => String(v),
}: {
  data: number[];
  height?: number;
  accent?: string;
  pale?: string;
  labels?: [string, string];
  format?: (value: number) => string;
}) {
  const max = Math.max(...data, 1);
  const peak = data.indexOf(max);

  return (
    <div>
      <div
        className="flex items-end gap-[3px]"
        style={{ height }}
        role="img"
        aria-label="Daily totals"
      >
        {data.map((value, i) => (
          <div
            key={i}
            className="flex-1 rounded-full transition-all"
            style={{
              height: `${Math.max(6, (value / max) * 100)}%`,
              minHeight: 6,
              background: value > 0 && i === peak ? accent : pale,
            }}
            title={format(value)}
          />
        ))}
      </div>
      {labels ? (
        <div className="mt-2.5 flex justify-between text-[11px] text-faint">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Soft gradient area chart, as on the concept's weather card. */
export function AreaChart({
  data,
  height = 110,
  labels,
  ariaLabel = "Trend",
}: {
  data: number[];
  height?: number;
  labels?: [string, string];
  ariaLabel?: string;
}) {
  const w = 600;
  const h = 160;
  const max = Math.max(...data, 1);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data.map((v, i) => [i * step, h - (v / max) * (h - 16) - 8] as const);

  // Smooth the line so it reads as a soft curve rather than a jagged polyline.
  const line = points
    .map(([x, y], i) => {
      if (i === 0) return `M ${x} ${y}`;
      const [px, py] = points[i - 1];
      const cx = (px + x) / 2;
      return `C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ height, width: "100%" }}
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id="vg-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L ${w} ${h} L 0 ${h} Z`} fill="url(#vg-area)" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {labels ? (
        <div className="mt-2 flex justify-between text-[11px] text-faint">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      ) : null}
    </div>
  );
}

export function ProgressRing({
  percent,
  size = 78,
  stroke = 8,
  track = "rgba(255,255,255,.22)",
  color = "#6ee7b7",
  children,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  track?: string;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            transition: "stroke-dashoffset .6s ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Capsule segmented control, as used for 24 hours / 30 days / 1 years. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx("inline-flex gap-1 rounded-full bg-surface-alt p-1", className)}>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={clsx(
            "rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors",
            value === o.key
              ? "bg-brand text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.9)]"
              : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
