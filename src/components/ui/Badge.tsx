import clsx from "clsx";
import type { ReactNode } from "react";
import type { ChargerStatus, StationStatus } from "@/lib/types";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "green" | "amber" | "danger" | "lilac";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-alt text-muted",
    brand: "bg-brand-tint text-brand",
    green: "bg-grid-green-tint text-grid-green",
    amber: "bg-amber-tint text-amber-dark",
    danger: "bg-danger-tint text-danger-dark",
    lilac: "bg-lilac-tint text-lilac",
  } as const;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATION_TONE: Record<
  StationStatus,
  { tone: "green" | "amber" | "danger" | "neutral"; dot: string; label: string }
> = {
  AVAILABLE: { tone: "green", dot: "bg-grid-green-bright", label: "Available" },
  BUSY: { tone: "amber", dot: "bg-amber", label: "Busy" },
  OFFLINE: { tone: "danger", dot: "bg-danger", label: "Offline" },
  MAINTENANCE: { tone: "neutral", dot: "bg-faint", label: "Maintenance" },
};

export function StationStatusBadge({
  status,
  available,
  total,
}: {
  status: StationStatus;
  available?: number;
  total?: number;
}) {
  const meta = STATION_TONE[status];
  let label = meta.label;
  let tone = meta.tone;

  if (status === "AVAILABLE" && available !== undefined && total !== undefined) {
    label = `${available} of ${total} free`;
    if (available === 0) tone = "danger";
    else if (available / total <= 0.4) tone = "amber";
  }
  if (status === "BUSY" && total !== undefined) label = `All ${total} in use`;

  return (
    <Badge tone={tone}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {label}
    </Badge>
  );
}

const CHARGER_TONE: Record<
  ChargerStatus,
  { tone: "green" | "amber" | "danger" | "neutral" | "brand"; label: string }
> = {
  AVAILABLE: { tone: "green", label: "Available" },
  CHARGING: { tone: "brand", label: "Charging" },
  RESERVED: { tone: "amber", label: "Reserved" },
  OFFLINE: { tone: "danger", label: "Offline" },
  MAINTENANCE: { tone: "neutral", label: "Maintenance" },
};

export function ChargerStatusBadge({ status }: { status: ChargerStatus }) {
  const meta = CHARGER_TONE[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
