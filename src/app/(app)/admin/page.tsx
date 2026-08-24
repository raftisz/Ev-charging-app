"use client";

import Link from "next/link";
import clsx from "clsx";
import { Page } from "@/components/layout/Page";
import { api } from "@/lib/api-client";
import { useAsync, usePolling } from "@/lib/use-async";
import { dateTime, duration, fullDate, kwh, relative, thb, time } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { AreaChart, StatTile } from "@/components/ui/Stat";
import { EmptyState, ErrorState, ListSkeleton, StatSkeleton } from "@/components/ui/States";

const STATION_TONE: Record<string, string> = {
  AVAILABLE: "#12A150",
  BUSY: "#E8871A",
  OFFLINE: "#DC2626",
  MAINTENANCE: "#8A94A6",
};

export default function AdminOverviewPage() {
  const { data, loading, error, reload } = useAsync(() => api.adminStats());
  usePolling(() => void reload(true), 20_000, true);

  const stats = data?.stats;

  return (
    <Page
      variant="admin"
      title="Overview"
      subtitle={`${fullDate(new Date())} · live network figures`}
    >
      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? (
        <div className="space-y-4">
          <StatSkeleton />
          <StatSkeleton />
          <ListSkeleton count={5} />
        </div>
      ) : null}

      {stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Total stations" value={String(stats.totalStations)} hint={`${stats.totalChargers} chargers`} />
            <StatTile label="Available chargers" value={String(stats.availableChargers)} tone="green" hint={`${stats.utilization}% utilisation`} />
            <StatTile label="Active sessions" value={String(stats.activeSessions)} tone="brand" />
            <StatTile label="Total energy" value={kwh(stats.totalEnergyKwh, 0)} />
            <StatTile label="Revenue (all time)" value={thb(stats.revenue)} />
            <StatTile label="Revenue (30 days)" value={thb(stats.revenue30d)} tone="green" />
            <StatTile label="Reservations" value={String(stats.reservations)} hint={`${stats.upcomingReservations} upcoming`} />
            <StatTile label="Users" value={String(stats.totalUsers)} hint={`${stats.activeUsers} active`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
            <div className="min-w-0 space-y-4">
              <section className="vg-card p-4">
                <div className="mb-3 flex items-baseline gap-2.5">
                  <h2 className="font-display text-[16px] font-semibold text-ink">
                    Revenue, last 30 days
                  </h2>
                  <span className="text-[12.5px] text-faint">
                    {thb(stats.revenue30d)} across {stats.revenueByDay.filter((d) => d.revenue > 0).length} active days
                  </span>
                </div>
                <AreaChart
                  data={stats.revenueByDay.map((d) => d.revenue)}
                  height={130}
                  ariaLabel="Revenue over the last 30 days"
                  labels={[
                    stats.revenueByDay[0]
                      ? new Date(stats.revenueByDay[0].date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })
                      : "30 days ago",
                    "Today",
                  ]}
                />
              </section>

              <section className="vg-card overflow-hidden">
                <div className="flex items-center border-b border-line px-4 py-3.5">
                  <h2 className="flex-1 font-display text-[16px] font-semibold text-ink">
                    Live charging sessions
                  </h2>
                  <Link href="/admin/sessions" className="text-[12.5px] font-semibold text-brand">
                    All sessions
                  </Link>
                </div>
                {data.activeSessions.length ? (
                  <ul>
                    {data.activeSessions.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0"
                      >
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="vg-pulse absolute inset-0 rounded-full bg-grid-green-bright" />
                          <span className="relative h-2 w-2 rounded-full bg-grid-green-bright" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium text-ink">
                            {s.station.name} · {s.charger.chargerCode}
                          </div>
                          <div className="text-[12px] text-faint">
                            {s.user?.fullName} · started {time(s.startTime)} ·{" "}
                            {duration(s.minutesElapsed)}
                          </div>
                        </div>
                        <Badge tone="brand">{s.currentPercent}%</Badge>
                        <span className="text-[12.5px] text-muted">{kwh(s.energyKwh)}</span>
                        <span className="font-display text-[13.5px] font-semibold text-ink">
                          {thb(s.cost)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-8">
                    <EmptyState icon="⚡" title="No sessions running right now" />
                  </div>
                )}
              </section>

              <section className="vg-card overflow-hidden">
                <div className="border-b border-line px-4 py-3.5">
                  <h2 className="font-display text-[16px] font-semibold text-ink">
                    Recent activity
                  </h2>
                </div>
                <ul>
                  {data.recentSessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-grid-green-tint font-display text-[12px] font-bold text-grid-green">
                        ⚡
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium text-ink">
                          {s.station.name}
                        </div>
                        <div className="text-[12px] text-faint">
                          {s.user?.fullName} · {relative(s.startTime)}
                        </div>
                      </div>
                      <span className="hidden text-[12.5px] text-muted sm:inline">
                        {kwh(s.energyKwh)}
                      </span>
                      <span className="font-display text-[13.5px] font-semibold text-ink">
                        {thb(s.cost)}
                      </span>
                      <Badge tone={s.paymentStatus === "PAID" ? "green" : "amber"}>
                        {s.paymentStatus === "PAID" ? "Paid" : "Unpaid"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="min-w-0 space-y-3.5">
              <div className="vg-card p-4">
                <h2 className="mb-3 font-display text-[15px] font-semibold text-ink">
                  Station status
                </h2>
                {stats.statusBreakdown.map((row) => (
                  <div key={row.status} className="flex items-center gap-2.5 py-1.5">
                    <span
                      className="h-[7px] w-[7px] rounded-full"
                      style={{ background: STATION_TONE[row.status] }}
                    />
                    <span className="flex-1 text-[13px] text-muted">
                      {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                    </span>
                    <span className="font-display text-[13px] font-semibold text-ink">
                      {row.count}
                    </span>
                  </div>
                ))}
                <div className="mt-3 border-t border-surface-alt pt-3">
                  <h3 className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-faint uppercase">
                    Chargers
                  </h3>
                  {stats.chargerBreakdown.map((row) => (
                    <div key={row.status} className="flex items-center gap-2.5 py-1">
                      <span className="flex-1 text-[13px] text-muted">
                        {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                      </span>
                      <span className="font-display text-[13px] font-semibold text-ink">
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="vg-card p-4">
                <h2 className="mb-3 font-display text-[15px] font-semibold text-ink">
                  Top stations by revenue
                </h2>
                <ol className="space-y-2.5">
                  {stats.topStations.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-2.5">
                      <span
                        className={clsx(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-[11.5px] font-bold",
                          i === 0 ? "bg-brand text-white" : "bg-surface-alt text-muted",
                        )}
                      >
                        {i + 1}
                      </span>
                      <Link
                        href={`/stations/${s.id}`}
                        className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink hover:text-brand"
                      >
                        {s.name}
                      </Link>
                      <span className="text-[11.5px] text-faint">{s.sessions}×</span>
                      <span className="font-display text-[13px] font-semibold text-ink">
                        {thb(s.revenue)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="vg-card p-4">
                <h2 className="mb-3 font-display text-[15px] font-semibold text-ink">
                  Upcoming reservations
                </h2>
                {data.upcomingReservations.length ? (
                  <ul className="space-y-2.5">
                    {data.upcomingReservations.map((r) => (
                      <li key={r.id} className="flex items-start gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint font-display text-[11px] font-bold text-brand">
                          {r.charger.chargerCode}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-ink">
                            {r.station.name}
                          </div>
                          <div className="text-[11.5px] text-faint">
                            {dateTime(r.startTime)} · {r.user?.fullName}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-faint">No upcoming reservations.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
