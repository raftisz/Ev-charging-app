"use client";

import Link from "next/link";
import clsx from "clsx";
import { StationStatusBadge } from "@/components/ui/Badge";
import { HeartIcon, PinIcon, StarIcon } from "@/components/ui/Icons";
import type { StationDTO } from "@/lib/types";
import { StationPhoto } from "@/components/stations/StationPhoto";
import { useI18n } from "@/i18n/I18nProvider";

export function StationCard({
  station,
  onToggleFavorite,
  className,
}: {
  station: StationDTO;
  onToggleFavorite?: (station: StationDTO) => void;
  className?: string;
}) {
  const { m, f } = useI18n();
  return (
    <div className={clsx("vg-card relative p-4.5 px-5 py-4.5 transition-shadow hover:shadow-[var(--shadow-raised)]", className)}>
      {onToggleFavorite ? (
        <button
          onClick={() => onToggleFavorite(station)}
          aria-label={station.isFavorite ? m.stations.removeFavorite : m.stations.saveFavorite}
          aria-pressed={station.isFavorite}
          className={clsx(
            "absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full transition-colors",
            station.isFavorite
              ? "bg-danger-tint text-danger"
              : "bg-surface-alt text-faint hover:text-ink",
          )}
        >
          <HeartIcon filled={station.isFavorite} />
        </button>
      ) : null}

      <Link href={`/stations/${station.id}`} className="flex gap-3.5 pr-10">
        <StationPhoto
          station={station}
          sizes="112px"
          className="h-[88px] w-[88px] shrink-0 rounded-[14px] sm:h-[104px] sm:w-[112px]"
        />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[15px] font-semibold text-ink">{station.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-faint">
            <PinIcon className="text-faint" />
            <span className="truncate">{station.address}</span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted">
            <span>{f.km(station.distanceKm)}</span>
            <span aria-hidden className="text-line-strong">·</span>
            <span>{m.stations.minAway(station.etaMin)}</span>
            <span aria-hidden className="text-line-strong">·</span>
            <span>{m.stations.upTo(f.kw(station.maxPowerKw))}</span>
            <span className="flex items-center gap-1 text-ink">
              <StarIcon className="text-amber" />
              {station.rating.toFixed(1)}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <StationStatusBadge
              status={station.status}
              available={station.availableCount}
              total={station.chargerCount}
            />
            <div className="flex-1" />
            <span className="font-display text-[15px] font-bold text-ink">
              {f.thb(station.pricePerKwh)}
              <span className="font-sans text-[11px] font-normal text-faint">{m.stations.perKwh}</span>
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

/** The horizontally scrolling recommendation card used on the dashboard. */
export function StationHeroCard({ station }: { station: StationDTO }) {
  const { m, f } = useI18n();
  const badge =
    station.maxPowerKw >= 150
      ? { text: m.stations.fastestNearby, tone: "text-brand" }
      : station.pricePerKwh <= 7.5
        ? { text: m.stations.bestValue, tone: "text-grid-green" }
        : { text: m.stations.closest, tone: "text-ink" };

  return (
    <Link
      href={`/stations/${station.id}`}
      className="vg-card w-[236px] shrink-0 overflow-hidden transition-shadow hover:shadow-[var(--shadow-raised)] lg:w-auto"
    >
      <StationPhoto station={station} sizes="(min-width: 1024px) 33vw, 236px" className="h-28">
        <span
          className={clsx(
            "absolute bottom-2.5 left-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold shadow-sm",
            badge.tone,
          )}
        >
          {badge.text}
        </span>
      </StationPhoto>
      <div className="p-3.5">
        <div className="font-display text-[14.5px] font-semibold text-ink">{station.name}</div>
        <div className="mt-1 truncate text-[12.5px] text-faint">
          {f.km(station.distanceKm)} · {f.kw(station.maxPowerKw)} ·{" "}
          {m.stations.hours[station.openingHours] ?? station.openingHours}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <StationStatusBadge
            status={station.status}
            available={station.availableCount}
            total={station.chargerCount}
          />
          <div className="flex-1" />
          <span className="font-display text-[13px] font-bold text-ink">
            {f.thb(station.pricePerKwh)}
            <span className="font-sans text-[11px] font-normal text-faint">{m.stations.perKwh}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
