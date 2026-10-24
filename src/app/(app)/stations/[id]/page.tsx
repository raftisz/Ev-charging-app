"use client";

import { use, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { Button } from "@/components/ui/Button";
import { Badge, ChargerStatusBadge, StationStatusBadge } from "@/components/ui/Badge";
import { ChevronLeft, HeartIcon, PinIcon, StarIcon } from "@/components/ui/Icons";
import { CardSkeleton, ErrorState } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Field, Input } from "@/components/ui/Field";
import type { ChargerDTO } from "@/lib/types";
import { StationPhoto } from "@/components/stations/StationPhoto";
import { useI18n } from "@/i18n/I18nProvider";

const StationMap = dynamic(() => import("@/components/stations/StationMap"), {
  ssr: false,
  loading: () => <div className="vg-skeleton h-full w-full rounded-[16px]" />,
});

export default function StationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const stationId = Number(id);
  const router = useRouter();
  const toast = useToast();
  const { m, f } = useI18n();

  const { data, loading, error, reload, setData } = useAsync(
    () => api.station(stationId),
    [stationId],
  );
  const station = data?.station ?? null;

  const [startCharger, setStartCharger] = useState<ChargerDTO | null>(null);
  const [startPercent, setStartPercent] = useState(25);
  const [targetPercent, setTargetPercent] = useState(80);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function toggleFavorite() {
    if (!station) return;
    const next = !station.isFavorite;
    setData({ station: { ...station, isFavorite: next } });
    try {
      if (next) await api.addFavorite(station.id);
      else await api.removeFavorite(station.id);
      toast.push(next ? m.stations.saved : m.stations.removed);
    } catch {
      setData({ station: { ...station, isFavorite: !next } });
      toast.push(m.stations.favoriteFailed, "error");
    }
  }

  async function beginCharging() {
    if (!station || !startCharger) return;
    setStartError(null);
    if (targetPercent <= startPercent) {
      setStartError(m.stations.targetTooLow);
      return;
    }
    setStarting(true);
    try {
      await api.startSession({
        stationId: station.id,
        chargerId: startCharger.id,
        startPercent,
        targetPercent,
      });
      toast.push(m.stations.started);
      router.push("/charging");
    } catch (err) {
      setStartError(
        err instanceof ApiRequestError ? err.message : m.stations.startFailed,
      );
      setStarting(false);
    }
  }

  return (
    <Page title={station?.name ?? m.stations.stationFallback} subtitle={station?.address}>
      <Link
        href="/stations"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink"
      >
        <ChevronLeft size={16} /> {m.stations.allStations}
      </Link>

      {error && !station ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !station ? (
        <div className="space-y-4">
          <div className="vg-skeleton h-52 rounded-[20px]" />
          <CardSkeleton rows={4} />
        </div>
      ) : null}

      {station ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="min-w-0 space-y-4">
            <div className="vg-card overflow-hidden">
              <StationPhoto
                station={station}
                sizes="(min-width: 1024px) 720px, 100vw"
                priority
                scrim
                className="h-48 sm:h-64"
              >
                <button
                  onClick={toggleFavorite}
                  aria-pressed={station.isFavorite}
                  aria-label={station.isFavorite ? m.stations.removeFavorite : m.stations.saveFavorite}
                  className={clsx(
                    "absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-xl backdrop-blur transition-colors",
                    station.isFavorite ? "bg-white text-danger" : "bg-slate-900/40 text-white hover:bg-slate-900/55",
                  )}
                >
                  <HeartIcon size={18} filled={station.isFavorite} />
                </button>
                <div className="absolute right-4 bottom-4 left-4 text-white">
                  <h2 className="font-display text-[22px] font-bold [text-shadow:0_1px_8px_rgba(0,0,0,0.45)] sm:text-[26px]">
                    {station.name}
                  </h2>
                  <div className="mt-1 flex items-center gap-1.5 text-[13px] text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
                    <PinIcon /> {station.address}
                  </div>
                </div>
              </StationPhoto>

              <div className="grid grid-cols-2 sm:grid-cols-4">
                <Fact
                  label={m.stations.price}
                  value={`${f.thb(station.pricePerKwh)}${m.stations.perKwh}`}
                />
                <Fact label={m.stations.maxPower} value={f.kw(station.maxPowerKw)} />
                <Fact
                  label={m.stations.distance}
                  value={`${f.km(station.distanceKm)} · ${f.duration(station.etaMin)}`}
                />
                <Fact
                  label={m.stations.rating}
                  value={
                    <span className="flex items-center gap-1.5">
                      <StarIcon className="text-amber" />
                      {station.rating.toFixed(1)}
                      <span className="font-sans text-[11.5px] font-normal text-faint">
                        ({station.reviewCount})
                      </span>
                    </span>
                  }
                />
              </div>
            </div>

            <div className="vg-card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
                <h3 className="flex-1 font-display text-[16px] font-semibold text-ink">
                  {m.stations.chargers}
                </h3>
                <StationStatusBadge
                  status={station.status}
                  available={station.availableCount}
                  total={station.chargerCount}
                />
              </div>
              <ul>
                {station.chargers.map((charger) => (
                  <li
                    key={charger.id}
                    className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5 last:border-0"
                  >
                    <span
                      className={clsx(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-[13px] font-bold",
                        charger.status === "AVAILABLE"
                          ? "bg-grid-green-tint text-grid-green"
                          : charger.status === "CHARGING"
                            ? "bg-brand-tint text-brand"
                            : "bg-surface-alt text-faint",
                      )}
                    >
                      {charger.chargerCode}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-ink">
                        {charger.connectors.map((c) => c.label).join(", ")}
                      </div>
                      <div className="text-[12.5px] text-faint">
                        {f.kw(charger.powerKw)} ·{" "}
                        {charger.powerKw >= 100
                          ? m.stations.fastDc
                          : charger.powerKw >= 50
                            ? "DC"
                            : "AC"}
                      </div>
                    </div>
                    <ChargerStatusBadge status={charger.status} />
                    <Button
                      size="sm"
                      variant={charger.status === "AVAILABLE" ? "primary" : "secondary"}
                      disabled={charger.status !== "AVAILABLE"}
                      onClick={() => {
                        setStartCharger(charger);
                        setStartError(null);
                      }}
                    >
                      {charger.status === "AVAILABLE" ? m.stations.startCharging : m.stations.unavailable}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="vg-card p-4">
              <h3 className="mb-3 font-display text-[16px] font-semibold text-ink">
                {m.stations.amenitiesHours}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge tone="brand">
                  {m.stations.hours[station.openingHours] ?? station.openingHours}
                </Badge>
                {station.amenities.map((amenity) => (
                  <Badge key={amenity}>{m.stations.amenity[amenity] ?? amenity}</Badge>
                ))}
                {station.amenities.length === 0 ? (
                  <span className="text-[13px] text-faint">{m.stations.noAmenities}</span>
                ) : null}
              </div>
              <dl className="mt-4 grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
                <Row label={m.stations.operator} value={station.operator} />
                <Row
                  label={m.stations.city}
                  value={m.stations.cityName[station.city] ?? station.city}
                />
                <Row
                  label={m.stations.connectors}
                  value={station.connectorTypes.map((t) => f.connector(t)).join(", ")}
                />
                <Row
                  label={m.stations.coordinates}
                  value={`${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}`}
                />
              </dl>
            </div>
          </div>

          <div className="min-w-0 space-y-3.5">
            <div className="h-[260px] overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-card)]">
              <StationMap stations={[station]} selectedId={station.id} />
            </div>

            <div className="vg-card p-4">
              <div className="font-display text-[15px] font-semibold text-ink">
                {m.stations.reserveTitle}
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-faint">
                {m.stations.reserveBody(f.thb(20))}
              </p>
              <Button
                href={`/reservations/new?station=${station.id}`}
                fullWidth
                className="mt-3"
                disabled={station.status === "OFFLINE" || station.status === "MAINTENANCE"}
              >
                {m.stations.pickSlot}
              </Button>
              <Button
                variant="secondary"
                fullWidth
                className="mt-2"
                href={`https://www.openstreetmap.org/?mlat=${station.latitude}&mlon=${station.longitude}#map=17/${station.latitude}/${station.longitude}`}
              >
                {m.stations.directions}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={Boolean(startCharger)}
        onClose={() => setStartCharger(null)}
        title={m.stations.startTitle(startCharger?.chargerCode ?? "")}
        description={`${startCharger ? f.kw(startCharger.powerKw) : ""} · ${
          startCharger?.connectors.map((c) => c.label).join(", ") ?? ""
        }. ${m.stations.startHint}`}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setStartCharger(null)}>
              {m.common.cancel}
            </Button>
            <Button variant="green" fullWidth loading={starting} onClick={beginCharging}>
              {m.stations.startCharging}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {startError ? (
            <div
              role="alert"
              className="rounded-[14px] bg-danger-tint px-4 py-2.5 text-[13px] font-medium text-danger-dark"
            >
              {startError}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label={m.stations.batteryNow}>
              <Input
                type="number"
                min={0}
                max={99}
                value={startPercent}
                onChange={(e) => setStartPercent(Number(e.target.value))}
              />
            </Field>
            <Field label={m.stations.chargeTo}>
              <Input
                type="number"
                min={20}
                max={100}
                value={targetPercent}
                onChange={(e) => setTargetPercent(Number(e.target.value))}
              />
            </Field>
          </div>
          <p className="text-[12.5px] leading-relaxed text-faint">
            {m.stations.targetAdvice}
          </p>
        </div>
      </Modal>
    </Page>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-r border-b border-line px-4 py-3.5 last:border-r-0">
      <div className="text-[11.5px] text-faint">{label}</div>
      <div className="mt-1 font-display text-[15px] font-semibold text-ink">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1.5 last:border-0">
      <dt className="text-faint">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
