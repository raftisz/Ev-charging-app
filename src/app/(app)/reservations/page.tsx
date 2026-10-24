"use client";

import { useState } from "react";
import clsx from "clsx";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { ReservationDTO, ReservationStatus } from "@/lib/types";
import { useI18n } from "@/i18n/I18nProvider";

const TABS = ["upcoming", "past", "all"] as const;

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
  const { m, f } = useI18n();
  const t = m.reservations;
  const [tab, setTab] = useState<(typeof TABS)[number]>("upcoming");
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
      toast.push(t.cancelled);
      setCancelling(null);
      void reload(true);
    } catch (err) {
      toast.push(
        err instanceof ApiRequestError ? err.message : t.cancelFailed,
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title={t.title}
      subtitle={t.subtitle}
      action={
        <Button href="/reservations/new" size="sm" className="max-sm:hidden">
          {t.newReservation}
        </Button>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="flex gap-1 rounded-full bg-surface-alt p-1">
          {TABS.map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={clsx(
                "rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors",
                tab === key
                  ? "bg-brand text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.9)]"
                  : "text-muted hover:text-ink",
              )}
            >
              {t.tabs[key]}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Button href="/reservations/new" size="sm" className="sm:hidden">
          {t.new}
        </Button>
      </div>

      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <ListSkeleton count={4} /> : null}

      {data && reservations.length === 0 ? (
        <EmptyState
          icon="▦"
          title={tab === "upcoming" ? t.emptyUpcomingTitle : t.emptyOtherTitle}
          description={tab === "upcoming" ? t.emptyUpcomingBody : t.emptyOtherBody}
          action={{ label: t.reserveSlot, href: "/reservations/new" }}
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
                      {f.dayOfMonth(r.startTime)}
                    </span>
                    <span className="text-[10px] font-semibold text-brand uppercase">
                      {f.monthShort(r.startTime)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[15px] font-semibold text-ink">
                      {r.station.name}
                    </div>
                    <div className="mt-1 text-[13px] text-muted">
                      {t.line(
                        f.time(r.startTime),
                        f.time(r.endTime),
                        r.charger.chargerCode,
                        Math.round(r.charger.powerKw),
                      )}
                    </div>
                    <div className="mt-1 text-[12.5px] text-faint">
                      {t.estimate(
                        f.kwh(r.estimatedKwh),
                        f.thb(r.estimatedCost),
                        f.thb(r.reservationFee),
                      )}
                    </div>
                  </div>

                  <Badge tone={STATUS_TONE[r.status]}>
                    {m.status.reservation[r.status]}
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
                      {t.stationDetails}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-danger hover:bg-danger-tint sm:flex-none"
                      onClick={() => setCancelling(r)}
                    >
                      {t.cancel}
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
        title={t.cancelTitle}
        description={
          cancelling
            ? t.cancelBody(
                cancelling.station.name,
                cancelling.charger.chargerCode,
                f.dateTime(cancelling.startTime),
              )
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setCancelling(null)}>
              {t.keep}
            </Button>
            <Button variant="danger" fullWidth loading={busy} onClick={confirmCancel}>
              {t.cancelReservation}
            </Button>
          </>
        }
      />
    </Page>
  );
}
