import clsx from "clsx";
import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "brand" | "green";
  className?: string;
}) {
  return (
    <div className={clsx("vg-card p-4", className)}>
      <div className="text-[12px] font-medium text-faint">{label}</div>
      <div
        className={clsx(
          "mt-1.5 font-display text-[22px] font-bold tracking-[-0.01em]",
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

/** Simple bar chart, no chart library needed for a 14/30 point series. */
export function BarChart({
  data,
  height = 56,
  accent = "var(--color-brand)",
  labels,
}: {
  data: number[];
  height?: number;
  accent?: string;
  labels?: [string, string];
}) {
  const max = Math.max(...data, 1);
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }} role="img" aria-label="Daily totals">
        {data.map((value, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[3px] transition-all"
            style={{
              height: `${Math.max(3, (value / max) * 100)}%`,
              background: value > 0 ? accent : "var(--color-line)",
              opacity: value > 0 ? 0.35 + (value / max) * 0.65 : 1,
            }}
            title={`${value}`}
          />
        ))}
      </div>
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
  color = "#7DE8AC",
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
