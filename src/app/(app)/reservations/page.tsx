"use client";

import { useState } from "react";
import clsx from "clsx";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { dateTime, dayOfMonth, kwh, monthShort, thb, time } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { ReservationDTO, ReservationStatus } from "@/lib/types";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

const STATUS_TONE: Record<ReservationStatus, "green" | "brand" | "amber" | "danger" | "neutral"> = {
  CONFIRMED: "brand",
  PENDING: "amber",
  ACTIVE: "green",
  COMPLETED: "neutral",
  CANCELLED: "danger",
  EXPIRED: "neutral",
};

export default function ReservationsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("upcoming");
  const [cancelling, setCancelling] = useState<ReservationDTO | null>(null);
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => api.reservations({ scope: tab === "all" ? undefined : tab }),
    [tab],
  );

  const reservations = data?.reservations ?? [];

  async function confirmCancel() {
    if (!cancelling) return;
    setBusy(true);
    try {
      await api.updateReservation(cancelling.id, "CANCELLED");
      toast.push("Reservation cancelled");
      setCancelling(null);
      void reload(true);
    } catch (err) {
      toast.push(
        err instanceof ApiRequestError ? err.message : "Could not cancel the reservation",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Reservations"
      subtitle="Charger slots you have booked across the network"
      action={
        <Button href="/reservations/new" size="sm" className="max-sm:hidden">
          New reservation
        </Button>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="flex gap-1 rounded-full bg-surface-alt p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={clsx(
                "rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors",
                tab === t.key
                  ? "bg-brand text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.9)]"
                  : "text-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Button href="/reservations/new" size="sm" className="sm:hidden">
          New
        </Button>
      </div>

      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <ListSkeleton count={4} /> : null}

      {data && reservations.length === 0 ? (
        <EmptyState
          icon="▦"
          title={tab === "upcoming" ? "Nothing booked yet" : "No reservations here"}
          description={
            tab === "upcoming"
              ? "Reserve a charger so it is held for you when you arrive."
              : "Reservations you complete or cancel will be listed here."
          }
          action={{ label: "Reserve a slot", href: "/reservations/new" }}
        />
      ) : null}

      {reservations.length ? (
        <ul className="space-y-3">
          {reservations.map((r) => {
            const upcoming =
              new Date(r.startTime).getTime() > now &&
              (r.status === "CONFIRMED" || r.status === "PENDING");
            return (
              <li key={r.id} className="vg-card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[16px] bg-brand-tint">
                    <span className="font-display text-[17px] leading-none font-bold text-brand">
                      {dayOfMonth(r.startTime)}
                    </span>
                    <span className="text-[10px] font-semibold text-brand uppercase">
                      {monthShort(r.startTime)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[15px] font-semibold text-ink">
                      {r.station.name}
                    </div>
                    <div className="mt-1 text-[13px] text-muted">
                      {time(r.startTime)} – {time(r.endTime)} · Charger {r.charger.chargerCode} ·{" "}
                      {Math.round(r.charger.powerKw)} kW
                    </div>
                    <div className="mt-1 text-[12.5px] text-faint">
                      Est. {kwh(r.estimatedKwh)} · {thb(r.estimatedCost)} including{" "}
                      {thb(r.reservationFee)} fee
                    </div>
                  </div>

                  <Badge tone={STATUS_TONE[r.status]}>
                    {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                  </Badge>
                </div>

                {upcoming ? (
                  <div className="mt-3.5 flex gap-2.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      href={`/stations/${r.station.id}`}
                      className="flex-1 sm:flex-none"
                    >
                      Station details
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-danger hover:bg-danger-tint sm:flex-none"
                      onClick={() => setCancelling(r)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel this reservation?"
        description={
          cancelling
            ? `${cancelling.station.name} · charger ${cancelling.charger.chargerCode} on ${dateTime(cancelling.startTime)}. The charger is released for other drivers.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setCancelling(null)}>
              Keep it
            </Button>
            <Button variant="danger" fullWidth loading={busy} onClick={confirmCancel}>
              Cancel reservation
            </Button>
          </>
        }
      />
    </Page>
  );
}
