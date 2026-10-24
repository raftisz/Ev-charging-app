"use client";

import { useState } from "react";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { ReservationDTO, ReservationStatus } from "@/lib/types";
import { useI18n } from "@/i18n/I18nProvider";

const TONE: Record<ReservationStatus, "green" | "brand" | "amber" | "danger" | "neutral"> = {
  CONFIRMED: "brand",
  PENDING: "amber",
  ACTIVE: "green",
  COMPLETED: "neutral",
  CANCELLED: "danger",
  EXPIRED: "neutral",
};

export default function AdminReservationsPage() {
  const toast = useToast();
  const { m, f } = useI18n();
  const t = m.admin;
  const [status, setStatus] = useState("");
  const [cancelling, setCancelling] = useState<ReservationDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => api.reservations({ all: true, status: status || undefined }),
    [status],
  );
  const reservations = data?.reservations ?? [];

  async function updateStatus(reservation: ReservationDTO, next: ReservationStatus) {
    try {
      await api.updateReservation(reservation.id, next);
      toast.push(t.reservationMoved(reservation.id, m.status.reservation[next].toLowerCase()));
      void reload(true);
    } catch (err) {
      toast.push(
        err instanceof ApiRequestError ? err.message : t.reservationUpdateFailed,
        "error",
      );
    }
  }

  async function confirmCancel() {
    if (!cancelling) return;
    setBusy(true);
    await updateStatus(cancelling, "CANCELLED");
    setCancelling(null);
    setBusy(false);
  }

  return (
    <Page
      variant="admin"
      title={t.reservations}
      subtitle={t.reservationsSubtitle(reservations.length)}
    >
      <div className="mb-4 max-w-xs">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t.filterByStatus}
        >
          <option value="">{t.allStatuses}</option>
          {(Object.keys(TONE) as ReservationStatus[]).map((s) => (
            <option key={s} value={s}>
              {m.status.reservation[s]}
            </option>
          ))}
        </Select>
      </div>

      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <ListSkeleton count={6} /> : null}
      {data && reservations.length === 0 ? (
        <EmptyState icon="▦" title={t.noReservations} />
      ) : null}

      {reservations.length ? (
        <div className="vg-card overflow-hidden">
          <div className="hidden grid-cols-[0.5fr_1.6fr_1.4fr_1fr_0.9fr_1fr_auto] gap-3 border-b border-line bg-surface px-4 py-2.5 lg:grid">
            {t.reservationColumns.map((c, i) => (
              <span key={i} className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
                {c}
              </span>
            ))}
          </div>
          <ul>
            {reservations.map((r) => {
              const cancellable = r.status === "CONFIRMED" || r.status === "PENDING";
              return (
                <li
                  key={r.id}
                  className="grid gap-2 border-b border-line px-4 py-3.5 last:border-0 lg:grid-cols-[0.5fr_1.6fr_1.4fr_1fr_0.9fr_1fr_auto] lg:items-center lg:gap-3"
                >
                  <span className="text-[12.5px] text-faint">#{r.id}</span>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-ink">
                      {r.station.name}
                    </div>
                    <div className="text-[12px] text-faint">{t.chargerLabel(r.charger.chargerCode)}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-ink">{r.user?.fullName}</div>
                    <div className="truncate text-[12px] text-faint">{r.user?.email}</div>
                  </div>
                  <span className="text-[13px] text-muted">{f.dateTime(r.startTime)}</span>
                  <span className="text-[12.5px] text-muted">
                    {f.kwh(r.estimatedKwh)} · {f.thb(r.estimatedCost)}
                  </span>
                  <span>
                    <Badge tone={TONE[r.status]}>
                      {m.status.reservation[r.status]}
                    </Badge>
                  </span>
                  <div className="flex gap-2">
                    {cancellable ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateStatus(r, "COMPLETED")}
                        >
                          {t.complete}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger hover:bg-danger-tint"
                          onClick={() => setCancelling(r)}
                        >
                          {t.cancel}
                        </Button>
                      </>
                    ) : (
                      <span className="text-[12px] text-faint">—</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title={t.cancelReservationTitle}
        description={
          cancelling
            ? t.cancelReservationBody(
                cancelling.id,
                cancelling.station.name,
                cancelling.user?.fullName ?? "",
              )
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setCancelling(null)}>
              {t.keepIt}
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
