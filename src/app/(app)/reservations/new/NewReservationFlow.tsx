"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { EmptyState, ErrorState, FormError, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { StationDetailDTO } from "@/lib/types";
import { StationPhoto } from "@/components/stations/StationPhoto";
import { addDays, bangkokDate, bangkokDay, bangkokTime } from "@/lib/timezone";
import { useI18n } from "@/i18n/I18nProvider";
import type { Format } from "@/i18n/format";

const DURATIONS = [30, 45, 60, 90];

/** The next seven booking days, counted in Bangkok so "Today" matches the stations. */
function dayOptions(today: string, labels: { today: string; tomorrow: string }, format: Format) {
  return Array.from({ length: 7 }, (_, i) => {
    const value = addDays(today, i);
    return {
      value,
      label:
        i === 0
          ? labels.today
          : i === 1
            ? labels.tomorrow
            : format.weekdayDayMonth(bangkokDate(value, "12:00")),
    };
  });
}

export function NewReservationFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { m, f } = useI18n();
  const t = m.reservations;

  const [stationId, setStationId] = useState<number | null>(
    params.get("station") ? Number(params.get("station")) : null,
  );
  const [day, setDay] = useState(() => bangkokDay());
  const [durationMinutes, setDuration] = useState(45);
  const [chargerId, setChargerId] = useState<number | null>(null);
  const [slotIso, setSlotIso] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(
    () => dayOptions(bangkokDay(), { today: t.today, tomorrow: t.tomorrow }, f),
    [t, f],
  );

  const stationsQuery = useAsync(() => api.stations({ sort: "distance" }), []);
  const stations = stationsQuery.data?.stations ?? [];

  const detailQuery = useAsync(
    () => (stationId ? api.station(stationId) : Promise.resolve({ station: null as unknown as StationDetailDTO })),
    [stationId],
  );
  const station = stationId ? detailQuery.data?.station ?? null : null;

  const availability = useAsync(
    () =>
      stationId
        ? api.availability(stationId, day, durationMinutes)
        : Promise.resolve(null),
    [stationId, day, durationMinutes],
  );

  const chargers = useMemo(() => availability.data?.chargers ?? [], [availability.data]);
  const selectedCharger = chargers.find((c) => c.id === chargerId) ?? null;

  // Slots run 08:00–20:30, so late in the evening "Today" has nothing left.
  const dayIsFull =
    chargers.length > 0 &&
    chargers.every((c) => !c.bookable || c.slots.every((slot) => !slot.available));
  const nextDay = days.find((d) => d.value > day)?.value ?? null;

  const estimate = useMemo(() => {
    if (!station || !selectedCharger) return null;
    const energy = ((durationMinutes / 60) * Math.min(selectedCharger.powerKw, 60)) * 0.62;
    const fee = 20;
    return {
      energy,
      energyCost: energy * station.pricePerKwh,
      fee,
      total: energy * station.pricePerKwh + fee,
    };
  }, [station, selectedCharger, durationMinutes]);

  async function submit() {
    if (!stationId || !chargerId || !slotIso) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.createReservation({
        stationId,
        chargerId,
        startTime: slotIso,
        durationMinutes,
      });
      toast.push(t.confirmed);
      router.push("/reservations");
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : t.createFailed,
      );
      setSubmitting(false);
    }
  }

  const steps = t.steps;
  const stepIndex = !stationId ? 0 : !chargerId ? 1 : !slotIso ? 2 : 3;

  return (
    <Page title={t.newTitle} subtitle={station?.name ?? t.pickStation}>
      <ol className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {steps.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={clsx(
                "flex h-7 w-7 items-center justify-center rounded-full font-display text-[11.5px] font-bold",
                i === stepIndex
                  ? "bg-brand text-white"
                  : i < stepIndex
                    ? "bg-grid-green-tint text-grid-green"
                    : "bg-canvas text-faint",
              )}
            >
              {i < stepIndex ? "✓" : i + 1}
            </span>
            <span
              className={clsx(
                "text-[12.5px]",
                i === stepIndex ? "font-semibold text-ink" : "text-faint",
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 ? (
              <span aria-hidden className="text-line-strong">
                ›
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <section className="vg-card p-4">
            <h2 className="mb-3 font-display text-[15px] font-semibold text-ink">
              {t.stepStation}
            </h2>
            {stationsQuery.loading && !stationsQuery.data ? (
              <div className="vg-skeleton h-11 rounded-xl" />
            ) : (
              <Select
                value={stationId ?? ""}
                onChange={(e) => {
                  setStationId(e.target.value ? Number(e.target.value) : null);
                  setChargerId(null);
                  setSlotIso(null);
                }}
                aria-label={t.chooseStation}
              >
                <option value="">{t.chooseStationOption}</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t.stationOption(s.name, f.thb(s.pricePerKwh), s.availableCount, s.chargerCount)}
                  </option>
                ))}
              </Select>
            )}
          </section>

          {stationId ? (
            <section className="vg-card p-4">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 className="flex-1 font-display text-[15px] font-semibold text-ink">
                  {t.stepDay}
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  value={day}
                  onChange={(e) => {
                    setDay(e.target.value);
                    setSlotIso(null);
                  }}
                  aria-label={t.chooseDay}
                >
                  {days.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
                <div className="flex gap-2">
                  {DURATIONS.map((minutes) => (
                    <button
                      key={minutes}
                      onClick={() => {
                        setDuration(minutes);
                        setSlotIso(null);
                      }}
                      aria-pressed={durationMinutes === minutes}
                      className={clsx(
                        "flex-1 rounded-full py-2.5 text-[12.5px] font-semibold transition-all",
                        durationMinutes === minutes
                          ? "bg-brand text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)]"
                          : "bg-white text-muted shadow-[0_4px_12px_-9px_rgba(30,58,138,0.6)] hover:text-ink",
                      )}
                    >
                      {t.minutesShort(minutes)}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {stationId ? (
            <section className="vg-card p-4">
              <h2 className="mb-3 font-display text-[15px] font-semibold text-ink">
                {t.stepTime}
              </h2>

              {availability.error ? (
                <ErrorState message={availability.error} onRetry={() => void availability.reload()} />
              ) : null}
              {availability.loading && !availability.data ? <ListSkeleton count={2} /> : null}

              {dayIsFull ? (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[16px] bg-surface px-4 py-3.5">
                  <span className="flex-1 text-[13px] leading-relaxed text-muted">
                    {t.dayFull}
                  </span>
                  {nextDay ? (
                    <Button
                      size="sm"
                      variant="tint"
                      onClick={() => {
                        setDay(nextDay);
                        setSlotIso(null);
                      }}
                    >
                      {t.tryDay(days.find((d) => d.value === nextDay)?.label ?? "")}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {chargers.length === 0 && availability.data ? (
                <EmptyState title={t.noChargers} />
              ) : null}

              <div className="space-y-4">
                {chargers.map((charger) => {
                  const free = charger.slots.filter((s) => s.available).length;
                  return (
                    <div key={charger.id}>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={clsx(
                            "flex h-8 w-8 items-center justify-center rounded-[10px] font-display text-[12px] font-bold",
                            charger.bookable
                              ? "bg-brand-tint text-brand"
                              : "bg-surface-alt text-faint",
                          )}
                        >
                          {charger.chargerCode}
                        </span>
                        <span className="text-[13.5px] font-semibold text-ink">
                          {f.kw(charger.powerKw)}
                        </span>
                        <span className="text-[12.5px] text-faint">
                          {charger.bookable ? t.slotsFree(free) : t.outOfService}
                        </span>
                      </div>

                      {charger.bookable && free === 0 ? (
                        <p className="mb-2 text-[12.5px] text-faint">
                          {t.fullyBooked}
                        </p>
                      ) : null}

                      {charger.bookable ? (
                        <div className="flex flex-wrap gap-2">
                          {charger.slots.map((slot) => {
                            const active = slotIso === slot.iso && chargerId === charger.id;
                            return (
                              <button
                                key={slot.iso}
                                disabled={!slot.available}
                                onClick={() => {
                                  setChargerId(charger.id);
                                  setSlotIso(slot.iso);
                                  setError(null);
                                }}
                                title={
                                  slot.reason === "booked"
                                    ? t.alreadyBooked
                                    : slot.reason === "past"
                                      ? t.passed
                                      : undefined
                                }
                                className={clsx(
                                  "min-w-[66px] rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-all",
                                  active
                                    ? "bg-brand text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)]"
                                    : slot.available
                                      ? "bg-white text-ink shadow-[0_4px_12px_-9px_rgba(30,58,138,0.6)] hover:text-brand"
                                      : "cursor-not-allowed bg-surface-alt text-faint line-through",
                                )}
                              >
                                {slot.time}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <div className="min-w-0 lg:sticky lg:top-[92px]">
          <div className="vg-card overflow-hidden">
            {station ? (
              <StationPhoto station={station} sizes="320px" scrim className="h-32">
                <div className="absolute right-3 bottom-2.5 left-3 font-display text-[14px] font-semibold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
                  {station.name}
                </div>
              </StationPhoto>
            ) : null}
            <div className="p-4">
              <h2 className="font-display text-[15px] font-semibold text-ink">{t.summary}</h2>
              {station ? (
                <dl className="mt-3 space-y-2 text-[13px]">
                  <SummaryRow label={t.station} value={station.name} />
                  <SummaryRow
                    label={t.charger}
                    value={
                      selectedCharger
                        ? `${selectedCharger.chargerCode} · ${f.kw(selectedCharger.powerKw)}`
                        : t.notSelected
                    }
                  />
                  <SummaryRow
                    label={t.when}
                    value={
                      slotIso
                        ? `${days.find((d) => d.value === day)?.label} · ${bangkokTime(new Date(slotIso))}`
                        : t.notSelected
                    }
                  />
                  <SummaryRow label={t.duration} value={t.minutes(durationMinutes)} />
                  {estimate ? (
                    <>
                      <SummaryRow label={t.estimatedEnergy} value={f.kwh(estimate.energy)} />
                      <SummaryRow
                        label={t.energyAt(f.thb(station.pricePerKwh))}
                        value={f.thb(estimate.energyCost)}
                      />
                      <SummaryRow label={t.fee} value={f.thb(estimate.fee)} />
                      <div className="flex justify-between border-t border-line pt-2.5">
                        <span className="text-[13.5px] font-semibold text-ink">
                          {t.estimatedTotal}
                        </span>
                        <span className="font-display text-[16px] font-bold text-ink">
                          {f.thb(estimate.total)}
                        </span>
                      </div>
                    </>
                  ) : null}
                </dl>
              ) : (
                <p className="mt-2 text-[13px] leading-relaxed text-faint">
                  {t.summaryHint}
                </p>
              )}

              {error ? (
                <div className="mt-3">
                  <FormError message={error} />
                </div>
              ) : null}

              <Button
                fullWidth
                size="lg"
                className="mt-4"
                disabled={!stationId || !chargerId || !slotIso}
                loading={submitting}
                onClick={submit}
              >
                {t.confirm}
              </Button>
              <p className="mt-2.5 text-center text-[12px] text-faint">
                {t.freeCancel}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
