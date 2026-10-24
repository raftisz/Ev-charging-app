"use client";

import { useState } from "react";
import clsx from "clsx";
import { Page } from "@/components/layout/Page";
import { api } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { AreaChart, BarChart } from "@/components/ui/Stat";
import { EmptyState, ErrorState, ListSkeleton, StatSkeleton } from "@/components/ui/States";
import { useI18n } from "@/i18n/I18nProvider";
import type { AnalyticsDTO, AnalyticsTotals } from "@/lib/types";

const PERIODS = [7, 30, 90] as const;

export default function AdminAnalyticsPage() {
  const { m, f } = useI18n();
  const t = m.analytics;
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const { data, loading, error, reload } = useAsync(() => api.analytics(days), [days]);

  return (
    <Page
      variant="admin"
      title={t.title}
      subtitle={data ? t.subtitle(f.dayMonth(data.from), f.dayMonth(data.to)) : undefined}
    >
      <div
        role="group"
        aria-label={t.periodLabel}
        className="mb-4 flex w-fit gap-1 rounded-full bg-surface-alt p-1"
      >
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setDays(p)}
            aria-pressed={days === p}
            className={clsx(
              "rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors",
              days === p
                ? "bg-brand text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.9)]"
                : "text-muted hover:text-ink",
            )}
          >
            {t.periods[String(p) as "7" | "30" | "90"]}
          </button>
        ))}
      </div>

      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? (
        <div className="space-y-4">
          <StatSkeleton count={6} />
          <ListSkeleton count={4} />
        </div>
      ) : null}

      {data && data.totals.sessions === 0 ? <EmptyState icon="▤" title={t.empty} /> : null}
      {data && data.totals.sessions > 0 ? (
        <div className={clsx("space-y-4 transition-opacity", loading && "opacity-60")}>
          <Kpis data={data} />

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="vg-card p-4">
              <Heading title={t.revenuePerDay} note={f.thb(data.totals.revenue)} />
              <AreaChart
                data={data.daily.map((d) => d.revenue)}
                height={130}
                ariaLabel={t.revenueAria}
                labels={[f.dayMonth(data.daily[0].date), f.dayMonth(data.daily.at(-1)!.date)]}
              />
            </section>
            <section className="vg-card p-4">
              <Heading title={t.energyPerDay} note={f.kwh(data.totals.energyKwh, 0)} />
              <BarChart
                data={data.daily.map((d) => d.energyKwh)}
                height={130}
                ariaLabel={t.energyAria}
                format={(v) => f.kwh(v, 0)}
                labels={[f.dayMonth(data.daily[0].date), f.dayMonth(data.daily.at(-1)!.date)]}
              />
            </section>
          </div>

          <Heatmap grid={data.heatmap} />

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            <StationTable data={data} />
            <div className="space-y-4">
              <section className="vg-card p-4">
                <Heading title={t.powerTitle} note={t.powerNote} />
                <ShareBars
                  rows={data.powerClasses.map((c) => ({
                    key: c.key,
                    label: t.powerClass[c.key],
                    value: c.energyKwh,
                    shown: f.kwh(c.energyKwh, 0),
                    detail: t.sessionsCount(c.sessions),
                  }))}
                />
              </section>
              <section className="vg-card p-4">
                <Heading title={t.methodsTitle} note={t.methodsNote} />
                <ShareBars
                  rows={data.paymentMethods.map((p) => ({
                    key: p.method,
                    label: m.status.paymentMethod[p.method],
                    value: p.amount,
                    shown: f.thb(p.amount),
                    detail: t.paymentsCount(p.count),
                  }))}
                />
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}

function Heading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <h2 className="font-display text-[16px] font-semibold text-ink">{title}</h2>
      {note ? <span className="text-[12.5px] text-faint">{note}</span> : null}
    </div>
  );
}

function Kpis({ data }: { data: AnalyticsDTO }) {
  const { m, f } = useI18n();
  const t = m.analytics;
  const items: { key: keyof AnalyticsTotals; label: string; value: string }[] = [
    { key: "revenue", label: t.revenue, value: f.thb(data.totals.revenue) },
    { key: "energyKwh", label: t.energy, value: f.kwh(data.totals.energyKwh, 0) },
    { key: "sessions", label: t.sessions, value: String(data.totals.sessions) },
    { key: "avgKwh", label: t.avgKwh, value: f.kwh(data.totals.avgKwh) },
    { key: "avgMinutes", label: t.avgMinutes, value: f.duration(data.totals.avgMinutes) },
    { key: "drivers", label: t.drivers, value: String(data.totals.drivers) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => {
        const now = data.totals[item.key];
        const before = data.previous[item.key];
        const change = before ? ((now - before) / before) * 100 : null;
        const rounded = change === null ? null : Math.round(change);
        return (
          <div key={item.key} className="vg-card p-4">
            <div className="text-[12px] text-faint">{item.label}</div>
            <div className="mt-1 font-display text-[19px] font-bold text-ink tabular-nums">{item.value}</div>
            <div
              className={clsx(
                "mt-1 text-[11.5px] font-medium",
                rounded === null || rounded === 0
                  ? "text-faint"
                  : rounded > 0
                    ? "text-grid-green-dark"
                    : "text-danger-dark",
              )}
            >
              {rounded === null
                ? t.newVsNone
                : rounded === 0
                  ? t.noChange
                  : t.vsPrevious(`${rounded > 0 ? "▲" : "▼"} ${Math.abs(rounded)}%`)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Seven rows of 24 hours, one hue from pale to deep: darker means busier. */
function Heatmap({ grid }: { grid: number[][] }) {
  const { m } = useI18n();
  const t = m.analytics;
  const max = Math.max(1, ...grid.flat());
  const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const shade = (n: number) => (n === 0 ? 0 : 0.12 + (n / max) * 0.88);

  return (
    <section className="vg-card p-4">
      <Heading title={t.heatmapTitle} note={t.heatmapNote} />
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[34px_repeat(24,minmax(0,1fr))] gap-[3px]">
            {grid.map((row, d) => (
              <div key={d} className="contents">
                <div className="flex items-center text-[11px] text-faint">{t.weekdays[d]}</div>
                {row.map((n, h) => (
                  <div
                    key={h}
                    title={t.heatmapCell(t.weekdays[d], pad(h), n)}
                    aria-label={t.heatmapCell(t.weekdays[d], pad(h), n)}
                    role="img"
                    className="h-6 rounded-[4px] bg-surface-alt"
                    style={
                      n
                        ? { background: `color-mix(in srgb, var(--color-brand) ${Math.round(shade(n) * 100)}%, var(--color-surface-alt))` }
                        : undefined
                    }
                  />
                ))}
              </div>
            ))}
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="pt-1 text-center text-[10.5px] text-faint">
                {h % 6 === 0 ? pad(h) : ""}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-faint">
        {t.fewer}
        {[0.12, 0.35, 0.6, 0.85, 1].map((s) => (
          <span
            key={s}
            className="h-3 w-3 rounded-[3px]"
            style={{ background: `color-mix(in srgb, var(--color-brand) ${Math.round(s * 100)}%, var(--color-surface-alt))` }}
          />
        ))}
        {t.more}
      </div>
    </section>
  );
}

function StationTable({ data }: { data: AnalyticsDTO }) {
  const { m, f } = useI18n();
  const t = m.analytics;
  const top = Math.max(1, ...data.stations.map((s) => s.revenue));
  return (
    <section className="vg-card overflow-hidden">
      <div className="px-4 pt-4">
        <Heading title={t.stationsTitle} note={t.stationsNote} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[13px]">
          <thead>
            <tr className="border-y border-line bg-surface text-left">
              {t.columns.map((c, i) => (
                <th
                  key={c}
                  title={i === 4 ? t.busyHint : undefined}
                  className={clsx(
                    "px-4 py-2 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase",
                    i > 0 && "text-right",
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.stations.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-ink">{s.name}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-alt">
                    <div
                      className="h-1.5 rounded-full bg-brand"
                      style={{ width: `${(s.revenue / top) * 100}%` }}
                    />
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right text-muted tabular-nums">{s.sessions}</td>
                <td className="px-4 py-2.5 text-right text-muted tabular-nums">{f.kwh(s.energyKwh, 0)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-ink tabular-nums">{f.thb(s.revenue)}</td>
                <td className="px-4 py-2.5 text-right text-muted tabular-nums">{s.utilisation.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Horizontal bars of each row's share of the total. */
function ShareBars({
  rows,
}: {
  rows: { key: string; label: string; value: number; shown: string; detail: string }[];
}) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const share = Math.round((r.value / total) * 100);
        return (
          <li key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-ink">{r.label}</span>
              <span className="text-faint tabular-nums">{share}%</span>
            </div>
            <div className="h-2 rounded-full bg-surface-alt">
              <div className="h-2 rounded-full bg-brand" style={{ width: `${share}%` }} />
            </div>
            <div className="mt-1 text-[11.5px] text-faint tabular-nums">
              {r.shown} · {r.detail}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
