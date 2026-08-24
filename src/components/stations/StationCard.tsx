"use client";

import Link from "next/link";
import clsx from "clsx";
import { StationStatusBadge } from "@/components/ui/Badge";
import { HeartIcon, PinIcon, StarIcon } from "@/components/ui/Icons";
import { km, kw, thb } from "@/lib/format";
import type { StationDTO } from "@/lib/types";

export function StationCard({
  station,
  onToggleFavorite,
  className,
}: {
  station: StationDTO;
  onToggleFavorite?: (station: StationDTO) => void;
  className?: string;
}) {
  return (
    <div className={clsx("vg-card relative p-4 transition-shadow hover:shadow-[0_14px_30px_-24px_rgba(18,22,28,0.6)]", className)}>
      {onToggleFavorite ? (
        <button
          onClick={() => onToggleFavorite(station)}
          aria-label={station.isFavorite ? "Remove from favourites" : "Save to favourites"}
          aria-pressed={station.isFavorite}
          className={clsx(
            "absolute top-3.5 right-3.5 flex h-8 w-8 items-center justify-center rounded-[10px] border transition-colors",
            station.isFavorite
              ? "border-danger-tint bg-danger-tint text-danger"
              : "border-line bg-white text-faint hover:text-ink",
          )}
        >
          <HeartIcon filled={station.isFavorite} />
        </button>
      ) : null}

      <Link href={`/stations/${station.id}`} className="block pr-10">
        <div className="font-display text-[15px] font-semibold text-ink">{station.name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-faint">
          <PinIcon className="text-faint" />
          <span className="truncate">{station.address}</span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted">
          <span>{km(station.distanceKm)}</span>
          <span aria-hidden className="text-line-strong">·</span>
          <span>{station.etaMin} min away</span>
          <span aria-hidden className="text-line-strong">·</span>
          <span>up to {kw(station.maxPowerKw)}</span>
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
            {thb(station.pricePerKwh, 2)}
            <span className="font-sans text-[11px] font-normal text-faint">/kWh</span>
          </span>
        </div>
      </Link>
    </div>
  );
}

/** The horizontally scrolling recommendation card used on the dashboard. */
export function StationHeroCard({ station }: { station: StationDTO }) {
  const badge =
    station.maxPowerKw >= 150
      ? { text: "Fastest nearby", tone: "text-brand" }
      : station.pricePerKwh <= 7.5
        ? { text: "Best value", tone: "text-grid-green" }
        : { text: "Closest to you", tone: "text-ink" };

  return (
    <Link
      href={`/stations/${station.id}`}
      className="vg-card w-[226px] shrink-0 overflow-hidden lg:w-auto"
    >
      <div className="relative h-24 bg-[linear-gradient(140deg,#16305E,#1A66F0_70%,#2E9B6B)]">
        <svg
          viewBox="0 0 226 96"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full opacity-25"
          aria-hidden
        >
          <rect x="24" y="34" width="28" height="62" rx="7" fill="#fff" opacity=".5" />
          <rect x="78" y="24" width="28" height="72" rx="7" fill="#fff" opacity=".35" />
          <rect x="132" y="42" width="28" height="54" rx="7" fill="#fff" opacity=".45" />
          <rect x="186" y="30" width="28" height="66" rx="7" fill="#fff" opacity=".3" />
        </svg>
        <span
          className={clsx(
            "absolute bottom-2.5 left-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold",
            badge.tone,
          )}
        >
          {badge.text}
        </span>
      </div>
      <div className="p-3.5">
        <div className="font-display text-[14.5px] font-semibold text-ink">{station.name}</div>
        <div className="mt-1 truncate text-[12.5px] text-faint">
          {km(station.distanceKm)} · {kw(station.maxPowerKw)} · {station.openingHours}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <StationStatusBadge
            status={station.status}
            available={station.availableCount}
            total={station.chargerCount}
          />
          <div className="flex-1" />
          <span className="font-display text-[13px] font-bold text-ink">
            {thb(station.pricePerKwh, 2)}
            <span className="font-sans text-[11px] font-normal text-faint">/kWh</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
