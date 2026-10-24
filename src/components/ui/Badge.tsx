"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import type { ChargerStatus, StationStatus } from "@/lib/types";
import { useI18n } from "@/i18n/I18nProvider";

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
  { tone: "green" | "amber" | "danger" | "neutral"; dot: string }
> = {
  AVAILABLE: { tone: "green", dot: "bg-grid-green-bright" },
  BUSY: { tone: "amber", dot: "bg-amber" },
  OFFLINE: { tone: "danger", dot: "bg-danger" },
  MAINTENANCE: { tone: "neutral", dot: "bg-faint" },
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
  const { m } = useI18n();
  const meta = STATION_TONE[status];
  let label = m.status.station[status];
  let tone = meta.tone;

  if (status === "AVAILABLE" && available !== undefined && total !== undefined) {
    label = m.status.stationFree(available, total);
    if (available === 0) tone = "danger";
    else if (available / total <= 0.4) tone = "amber";
  }
  if (status === "BUSY" && total !== undefined) label = m.status.stationAllBusy(total);

  return (
    <Badge tone={tone}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {label}
    </Badge>
  );
}

const CHARGER_TONE: Record<
  ChargerStatus,
  { tone: "green" | "amber" | "danger" | "neutral" | "brand" }
> = {
  AVAILABLE: { tone: "green" },
  CHARGING: { tone: "brand" },
  RESERVED: { tone: "amber" },
  OFFLINE: { tone: "danger" },
  MAINTENANCE: { tone: "neutral" },
};

export function ChargerStatusBadge({ status }: { status: ChargerStatus }) {
  const { m } = useI18n();
  return <Badge tone={CHARGER_TONE[status].tone}>{m.status.charger[status]}</Badge>;
}
