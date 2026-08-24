"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync, usePolling } from "@/lib/use-async";
import { dateTime, duration, kw, kwh, thb } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/Stat";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, ListSkeleton, StatSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { SessionDTO } from "@/lib/types";

const FILTERS = ["All", "Active", "Completed", "Unpaid"] as const;

export default function AdminSessionsPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [stopping, setStopping] = useState<SessionDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(() => api.sessions({ all: true, limit: 200 }));
  usePolling(() => void reload(true), 20_000, true);

  const sessions = useMemo(() => data?.sessions ?? [], [data]);

  const filtered = useMemo(() => {
    if (filter === "Active") return sessions.filter((s) => s.status === "ACTIVE");
    if (filter === "Completed") return sessions.filter((s) => s.status !== "ACTIVE");
    if (filter === "Unpaid")
      return sessions.filter((s) => s.status !== "ACTIVE" && s.paymentStatus !== "PAID");
    return sessions;
  }, [sessions, filter]);

  const totals = useMemo(
    () => ({
      active: sessions.filter((s) => s.status === "ACTIVE").length,
      energy: sessions.reduce((sum, s) => sum + s.energyKwh, 0),
      revenue: sessions
        .filter((s) => s.paymentStatus === "PAID")
        .reduce((sum, s) => sum + s.cost, 0),
      outstanding: sessions
        .filter((s) => s.status !== "ACTIVE" && s.paymentStatus !== "PAID")
        .reduce((sum, s) => sum + s.cost, 0),
    }),
    [sessions],
  );

  async function stop() {
    if (!stopping) return;
    setBusy(true);
    try {
      await api.stopSession(stopping.id);
      toast.push(`Session #${stopping.id} stopped`);
      setStopping(null);
      void reload(true);
    } catch (err) {
      toast.push(
        err instanceof ApiRequestError ? err.message : "Could not stop the session",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      variant="admin"
      title="Charging sessions"
      subtitle={`${sessions.length} sessions · ${totals.active} running now`}
    >
      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? (
        <div className="space-y-4">
          <StatSkeleton />
          <ListSkeleton count={6} />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Running now" value={String(totals.active)} tone="brand" />
            <StatTile label="Energy delivered" value={kwh(totals.energy, 0)} />
            <StatTile label="Revenue collected" value={thb(totals.revenue)} tone="green" />
            <StatTile label="Outstanding" value={thb(totals.outstanding)} />
          </div>

          <div className="mt-4 mb-3 flex gap-1 rounded-full bg-surface-alt p-1 lg:w-fit">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={clsx(
                  "flex-1 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors lg:flex-none",
                  filter === f
                    ? "bg-brand text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.9)]"
                    : "text-muted hover:text-ink",
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="⚡" title={`No ${filter.toLowerCase()} sessions`} />
          ) : (
            <div className="vg-card overflow-hidden">
              <div className="hidden grid-cols-[0.5fr_1.5fr_1.3fr_1fr_0.8fr_0.8fr_1fr_auto] gap-3 border-b border-line bg-surface px-4 py-2.5 lg:grid">
                {["#", "Station", "Driver", "Started", "Energy", "Cost", "Status", ""].map((c) => (
                  <span
                    key={c}
                    className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase"
                  >
                    {c}
                  </span>
                ))}
              </div>
              <ul>
                {filtered.map((s) => (
                  <li
                    key={s.id}
                    className="grid gap-2 border-b border-line px-4 py-3.5 last:border-0 lg:grid-cols-[0.5fr_1.5fr_1.3fr_1fr_0.8fr_0.8fr_1fr_auto] lg:items-center lg:gap-3"
                  >
                    <span className="text-[12.5px] text-faint">#{s.id}</span>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium text-ink">
                        {s.station.name}
                      </div>
                      <div className="text-[12px] text-faint">
                        {s.charger.chargerCode} · {kw(s.powerKw)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-ink">{s.user?.fullName}</div>
                      <div className="truncate text-[12px] text-faint">{s.user?.email}</div>
                    </div>
                    <span className="text-[13px] text-muted">{dateTime(s.startTime)}</span>
                    <span className="text-[13px] text-muted">{kwh(s.energyKwh)}</span>
                    <span className="font-display text-[13.5px] font-semibold text-ink">
                      {thb(s.cost)}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {s.status === "ACTIVE" ? (
                        <Badge tone="brand">{s.currentPercent}% · {duration(s.minutesElapsed)}</Badge>
                      ) : (
                        <Badge tone={s.paymentStatus === "PAID" ? "green" : "amber"}>
                          {s.paymentStatus === "PAID" ? "Paid" : "Unpaid"}
                        </Badge>
                      )}
                    </span>
                    <div>
                      {s.status === "ACTIVE" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger hover:bg-danger-tint"
                          onClick={() => setStopping(s)}
                        >
                          Stop
                        </Button>
                      ) : (
                        <span className="text-[12px] text-faint">—</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}

      <Modal
        open={Boolean(stopping)}
        onClose={() => setStopping(null)}
        title="Stop this session?"
        description={
          stopping
            ? `#${stopping.id} at ${stopping.station.name} for ${stopping.user?.fullName}. The charger is released and the driver is billed ${thb(stopping.cost)}.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setStopping(null)}>
              Leave it running
            </Button>
            <Button variant="danger" fullWidth loading={busy} onClick={stop}>
              Stop session
            </Button>
          </>
        }
      />
    </Page>
  );
}
