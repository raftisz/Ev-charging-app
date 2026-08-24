"use client";

import { useState } from "react";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { dateTime, kwh, thb } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { ReservationDTO, ReservationStatus } from "@/lib/types";

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
  const [status, setStatus] = useState("");
  const [cancelling, setCancelling] = useState<ReservationDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => api.reservations({ all: true, status: status || undefined }),
    [status],
  );
  const reservations = data?.reservations ?? [];

  async function updateStatus(reservation: ReservationDTO, next: string) {
    try {
      await api.updateReservation(reservation.id, next);
      toast.push(`Reservation #${reservation.id} → ${next.toLowerCase()}`);
      void reload(true);
    } catch (err) {
      toast.push(
        err instanceof ApiRequestError ? err.message : "Could not update the reservation",
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
      title="Reservations"
      subtitle={`${reservations.length} reservations across the network`}
    >
      <div className="mb-4 max-w-xs">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {Object.keys(TONE).map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </div>

      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <ListSkeleton count={6} /> : null}
      {data && reservations.length === 0 ? (
        <EmptyState icon="▦" title="No reservations match that filter" />
      ) : null}

      {reservations.length ? (
        <div className="vg-card overflow-hidden">
          <div className="hidden grid-cols-[0.5fr_1.6fr_1.4fr_1fr_0.9fr_1fr_auto] gap-3 border-b border-surface-alt bg-[#FAFBFC] px-4 py-2.5 lg:grid">
            {["#", "Station", "Driver", "When", "Est.", "Status", ""].map((c) => (
              <span key={c} className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
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
                  className="grid gap-2 border-b border-[#F5F7F9] px-4 py-3.5 last:border-0 lg:grid-cols-[0.5fr_1.6fr_1.4fr_1fr_0.9fr_1fr_auto] lg:items-center lg:gap-3"
                >
                  <span className="text-[12.5px] text-faint">#{r.id}</span>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-ink">
                      {r.station.name}
                    </div>
                    <div className="text-[12px] text-faint">Charger {r.charger.chargerCode}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-ink">{r.user?.fullName}</div>
                    <div className="truncate text-[12px] text-faint">{r.user?.email}</div>
                  </div>
                  <span className="text-[13px] text-muted">{dateTime(r.startTime)}</span>
                  <span className="text-[12.5px] text-muted">
                    {kwh(r.estimatedKwh)} · {thb(r.estimatedCost)}
                  </span>
                  <span>
                    <Badge tone={TONE[r.status]}>
                      {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
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
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger hover:bg-danger-tint"
                          onClick={() => setCancelling(r)}
                        >
                          Cancel
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
        title="Cancel this reservation?"
        description={
          cancelling
            ? `#${cancelling.id} · ${cancelling.station.name} for ${cancelling.user?.fullName}. The charger is released immediately.`
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
