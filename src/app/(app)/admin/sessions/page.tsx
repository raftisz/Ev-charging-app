"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync, usePolling } from "@/lib/use-async";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/Stat";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, ListSkeleton, StatSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/components/layout/SessionProvider";
import type { SessionDTO } from "@/lib/types";
import { useI18n } from "@/i18n/I18nProvider";

const FILTERS = ["all", "active", "completed", "unpaid"] as const;

const isUnpaid = (s: SessionDTO) => s.paymentStatus === "PENDING" || s.paymentStatus === "FAILED";

export default function AdminSessionsPage() {
  const toast = useToast();
  const { m, f } = useI18n();
  const t = m.admin;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [stopping, setStopping] = useState<SessionDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [refunding, setRefunding] = useState<SessionDTO | null>(null);
  const { user } = useSession();
  // Operators can see sessions but only admins move money back.
  const isAdmin = user.role === "ADMIN";

  const { data, loading, error, reload } = useAsync(() => api.sessions({ all: true, limit: 200 }));
  usePolling(() => void reload(true), 20_000, true);

  const sessions = useMemo(() => data?.sessions ?? [], [data]);

  const filtered = useMemo(() => {
    if (filter === "active") return sessions.filter((s) => s.status === "ACTIVE");
    if (filter === "completed") return sessions.filter((s) => s.status !== "ACTIVE");
    if (filter === "unpaid")
      return sessions.filter((s) => s.status !== "ACTIVE" && isUnpaid(s));
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
        .filter((s) => s.status !== "ACTIVE" && isUnpaid(s))
        .reduce((sum, s) => sum + s.cost, 0),
    }),
    [sessions],
  );

  async function refund() {
    if (!refunding?.receiptId) return;
    setBusy(true);
    try {
      const res = await api.refundPayment(refunding.receiptId);
      toast.push(t.refunded(f.thb(res.refund.amount), refunding.user?.fullName ?? t.theDriver));
      setRefunding(null);
      void reload(true);
    } catch (err) {
      toast.push(err instanceof ApiRequestError ? err.message : t.refundFailed, "error");
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!stopping) return;
    setBusy(true);
    try {
      await api.stopSession(stopping.id);
      toast.push(t.sessionStopped(stopping.id));
      setStopping(null);
      void reload(true);
    } catch (err) {
      toast.push(
        err instanceof ApiRequestError ? err.message : t.stopFailed,
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      variant="admin"
      title={t.sessionsTitle}
      subtitle={t.sessionsSubtitle(sessions.length, totals.active)}
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
            <StatTile label={t.runningNow} value={String(totals.active)} tone="brand" />
            <StatTile label={t.energyDelivered} value={f.kwh(totals.energy, 0)} />
            <StatTile label={t.revenueCollected} value={f.thb(totals.revenue)} tone="green" />
            <StatTile label={t.outstanding} value={f.thb(totals.outstanding)} />
          </div>

          <div className="mt-4 mb-3 flex gap-1 rounded-full bg-surface-alt p-1 lg:w-fit">
            {FILTERS.map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={clsx(
                  "flex-1 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors lg:flex-none",
                  filter === key
                    ? "bg-brand text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.9)]"
                    : "text-muted hover:text-ink",
                )}
              >
                {t.sessionFilters[key]}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="⚡" title={t.noSessions[filter]} />
          ) : (
            <div className="vg-card overflow-hidden">
              <div className="hidden grid-cols-[0.5fr_1.5fr_1.3fr_1fr_0.8fr_0.8fr_1fr_auto] gap-3 border-b border-line bg-surface px-4 py-2.5 lg:grid">
                {t.sessionColumns.map((c, i) => (
                  <span
                    key={i}
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
                        {s.charger.chargerCode} · {f.kw(s.powerKw)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-ink">{s.user?.fullName}</div>
                      <div className="truncate text-[12px] text-faint">{s.user?.email}</div>
                    </div>
                    <span className="text-[13px] text-muted">{f.dateTime(s.startTime)}</span>
                    <span className="text-[13px] text-muted">{f.kwh(s.energyKwh)}</span>
                    <span className="font-display text-[13.5px] font-semibold text-ink">
                      {f.thb(s.cost)}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {s.status === "ACTIVE" ? (
                        <Badge tone="brand">
                          {s.currentPercent}% · {f.duration(s.minutesElapsed)}
                        </Badge>
                      ) : (
                        <Badge
                          tone={
                            s.paymentStatus === "PAID"
                              ? "green"
                              : s.paymentStatus === "REFUNDED"
                                ? "neutral"
                                : "amber"
                          }
                        >
                          {s.paymentStatus === "PAID" || s.paymentStatus === "REFUNDED"
                            ? m.status.payment[s.paymentStatus]
                            : t.unpaid}
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
                          {t.stop}
                        </Button>
                      ) : (
                        <span className="flex items-center gap-2">
                          {s.receiptId ? (
                            <Link href={`/receipts/${s.receiptId}`} className="text-[12px] font-semibold text-brand">
                              {t.receipt}
                            </Link>
                          ) : null}
                          {isAdmin && s.paymentStatus === "PAID" && s.receiptId ? (
                            <Button size="sm" variant="ghost" onClick={() => setRefunding(s)}>
                              {t.refund}
                            </Button>
                          ) : null}
                          {!s.receiptId && !(isAdmin && s.paymentStatus === "PAID") ? (
                            <span className="text-[12px] text-faint">—</span>
                          ) : null}
                        </span>
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
        title={t.stopTitle}
        description={
          stopping
            ? t.stopBody(
                stopping.id,
                stopping.station.name,
                stopping.user?.fullName ?? t.theDriver,
                f.thb(stopping.cost),
              )
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setStopping(null)}>
              {t.leaveRunning}
            </Button>
            <Button variant="danger" fullWidth loading={busy} onClick={stop}>
              {t.stopSession}
            </Button>
          </>
        }
      />

      <Modal
        open={Boolean(refunding)}
        onClose={() => setRefunding(null)}
        title={t.refundTitle}
        description={
          refunding
            ? t.refundBody(
                f.thb(refunding.cost),
                refunding.user?.fullName ?? t.theDriver,
                refunding.id,
                refunding.station.name,
              )
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setRefunding(null)}>
              {t.cancel}
            </Button>
            <Button variant="danger" fullWidth loading={busy} onClick={refund}>
              {t.refundAmount(refunding ? f.thb(refunding.cost) : "")}
            </Button>
          </>
        }
      />
    </Page>
  );
}
