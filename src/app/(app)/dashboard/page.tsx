"use client";

import Link from "next/link";
import { Page } from "@/components/layout/Page";
import { useSession } from "@/components/layout/SessionProvider";
import { api } from "@/lib/api-client";
import { useAsync, usePolling } from "@/lib/use-async";
import { dayMonth, duration, fullDate, kwh, relative, thb, time } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { BarChart, ProgressRing } from "@/components/ui/Stat";
import { EmptyState, ErrorState, ListSkeleton, StatSkeleton } from "@/components/ui/States";
import { StationHeroCard } from "@/components/stations/StationCard";
import { Badge } from "@/components/ui/Badge";

export default function DashboardPage() {
  const { user } = useSession();
  const { data, loading, error, reload } = useAsync(() => api.dashboard());

  // The live session keeps advancing, so refresh it while one is running.
  usePolling(() => void reload(true), 15_000, Boolean(data?.activeSession));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <Page
      title="Dashboard"
      subtitle={`${fullDate(new Date())} · Bangkok network`}
      action={
        <Button href="/stations" size="sm" variant="tint" className="max-sm:hidden">
          Find a station
        </Button>
      }
    >
      <div className="mb-4 flex items-center gap-3 lg:hidden">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-tint font-display text-[14px] font-semibold text-brand">
          {user.avatarInit}
        </span>
        <div>
          <div className="text-[13px] text-faint">{greeting}</div>
          <div className="font-display text-[17px] font-semibold text-ink">
            {user.fullName.split(" ")[0]} {user.fullName.split(" ")[1]?.[0]}.
          </div>
        </div>
      </div>

      {error && !data ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : null}

      {loading && !data ? (
        <div className="space-y-4">
          <div className="vg-skeleton h-44 rounded-[20px]" />
          <StatSkeleton />
          <ListSkeleton count={3} />
        </div>
      ) : null}

      {data ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="min-w-0 space-y-4">
            {data.activeSession ? (
              <LiveSessionCard session={data.activeSession} />
            ) : (
              <NoSessionCard />
            )}

            <section>
              <div className="mb-3 flex items-baseline gap-2.5">
                <h2 className="font-display text-[16px] font-semibold text-ink">
                  Suggested for your next charge
                </h2>
                <span className="hidden text-[12.5px] text-faint sm:inline">
                  ranked by distance, price and live availability
                </span>
              </div>
              {data.recommended.length ? (
                <div className="vg-scroll-x -mx-4 flex gap-3 px-4 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">
                  {data.recommended.map((station) => (
                    <StationHeroCard key={station.id} station={station} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No stations free right now"
                  description="Every charger in the network is in use or offline. Try again shortly."
                  action={{ label: "Open the map", href: "/map" }}
                />
              )}
            </section>

            <section className="vg-card overflow-hidden">
              <div className="flex items-center border-b border-surface-alt px-4 py-3.5">
                <h2 className="flex-1 font-display text-[16px] font-semibold text-ink">
                  Recent activity
                </h2>
                <Link href="/history" className="text-[12.5px] font-semibold text-brand">
                  View all
                </Link>
              </div>
              {data.recentSessions.length ? (
                <ul>
                  {data.recentSessions.map((session) => (
                    <li
                      key={session.id}
                      className="flex items-center gap-3 border-b border-[#F5F7F9] px-4 py-3 last:border-0"
                    >
                      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-grid-green-tint font-display text-[12px] font-bold text-grid-green">
                        ⚡
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium text-ink">
                          {session.station.name}
                        </div>
                        <div className="text-[12px] text-faint">
                          {relative(session.startTime)} · {kwh(session.energyKwh)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-[13.5px] font-semibold text-ink">
                          {thb(session.cost)}
                        </div>
                        <Badge
                          tone={
                            session.paymentStatus === "PAID"
                              ? "green"
                              : session.paymentStatus === "FAILED"
                                ? "danger"
                                : "amber"
                          }
                          className="mt-0.5"
                        >
                          {session.paymentStatus === "PAID"
                            ? "Paid"
                            : session.paymentStatus === "FAILED"
                              ? "Failed"
                              : "Unpaid"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-8">
                  <EmptyState
                    icon="⚡"
                    title="No charging sessions yet"
                    description="Start a session at any available charger and it will show up here."
                    action={{ label: "Find a station", href: "/stations" }}
                  />
                </div>
              )}
            </section>
          </div>

          <div className="min-w-0 space-y-3.5">
            <div className="grid grid-cols-2 gap-2.5">
              <QuickAction href="/map" glyph="◎" label="Find" tint="bg-brand-tint" fg="text-brand" />
              <QuickAction href="/reservations/new" glyph="▦" label="Reserve" tint="bg-brand-tint" fg="text-brand" />
              <QuickAction href="/charging" glyph="⬒" label="Scan" tint="bg-grid-green-tint" fg="text-grid-green" />
              <QuickAction href="/history" glyph="฿" label="Wallet" tint="bg-surface-alt" fg="text-muted" />
            </div>

            <div className="vg-card p-4">
              <div className="font-display text-[15px] font-semibold text-ink">
                Next reservation
              </div>
              {data.nextReservation ? (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[13px] bg-brand-tint">
                      <span className="font-display text-[16px] leading-none font-bold text-brand">
                        {new Date(data.nextReservation.startTime).getDate()}
                      </span>
                      <span className="text-[9.5px] font-semibold text-brand uppercase">
                        {dayMonth(data.nextReservation.startTime).split(" ")[1]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-display text-[14px] font-semibold text-ink">
                        {data.nextReservation.station.name}
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-muted">
                        {time(data.nextReservation.startTime)} –{" "}
                        {time(data.nextReservation.endTime)} · Charger{" "}
                        {data.nextReservation.charger.chargerCode}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[10px] bg-brand-tint px-3 py-2.5 text-[12px] leading-[1.45] font-medium text-brand-dark">
                    The charger is held for 15 minutes past your slot start.
                  </div>
                  <Button href="/reservations" variant="secondary" size="sm" fullWidth className="mt-3">
                    Manage reservations
                  </Button>
                </>
              ) : (
                <div className="mt-3">
                  <p className="text-[13px] leading-relaxed text-faint">
                    Nothing booked. Hold a charger so it is waiting when you arrive.
                  </p>
                  <Button href="/reservations/new" variant="tint" size="sm" fullWidth className="mt-3">
                    Reserve a slot
                  </Button>
                </div>
              )}
            </div>

            <div className="vg-card p-4">
              <div className="mb-3 flex items-baseline">
                <div className="flex-1 font-display text-[15px] font-semibold text-ink">
                  This month
                </div>
                <span className="text-[12px] text-faint">
                  {new Intl.DateTimeFormat("en-GB", { month: "long" }).format(new Date())}
                </span>
              </div>
              <div className="mb-3.5 grid grid-cols-2 gap-x-2.5 gap-y-3">
                <MiniStat value={kwh(data.stats.monthEnergyKwh, 0)} label="Energy charged" />
                <MiniStat value={thb(data.stats.monthSpend)} label="Spent" />
                <MiniStat value={String(data.stats.monthSessions)} label="Sessions" />
                <MiniStat value={`${data.stats.co2SavedKg} kg`} label="CO₂ avoided" />
              </div>
              <BarChart
                data={data.stats.dailyEnergy.map((d) => d.kwh)}
                labels={[
                  dayMonth(data.stats.dailyEnergy[0]?.date ?? new Date()),
                  dayMonth(
                    data.stats.dailyEnergy[data.stats.dailyEnergy.length - 1]?.date ??
                      new Date(),
                  ),
                ]}
              />
            </div>

            <div className="vg-card p-4">
              <div className="mb-2.5 font-display text-[15px] font-semibold text-ink">
                Network status
              </div>
              <NetRow label="Chargers free now" value={String(data.stats.availableChargers)} dot="#12A150" />
              <NetRow
                label="Stations open"
                value={`${data.stats.openStations} of ${data.stats.totalStations}`}
                dot="#1A66F0"
              />
              <NetRow label="Sites with 100 kW+" value={String(data.stats.fastSites)} dot="#E8871A" />
              <NetRow label="Network utilisation" value={`${data.stats.utilization}%`} dot="#8A94A6" />
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}

function LiveSessionCard({
  session,
}: {
  session: NonNullable<Awaited<ReturnType<typeof api.dashboard>>["activeSession"]>;
}) {
  const reached = session.currentPercent >= session.targetPercent;

  return (
    <Link
      href="/charging"
      className="block rounded-[22px] bg-grid-green p-4 text-white shadow-[0_16px_34px_-22px_rgba(14,122,62,0.9)] lg:p-6"
    >
      <div className="mb-3.5 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="vg-pulse absolute inset-0 rounded-full bg-grid-green-pale" />
          <span className="relative h-2 w-2 rounded-full bg-grid-green-pale" />
        </span>
        <span className="text-[11.5px] font-semibold tracking-[0.08em] text-grid-green-pale uppercase">
          {reached ? "Target reached" : "Charging now"}
        </span>
        <div className="flex-1" />
        <span className="text-[12px] font-medium text-grid-green-pale">
          Fast · {Math.round(session.powerKw)} kW
        </span>
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        <ProgressRing percent={(session.currentPercent / session.targetPercent) * 100} size={86} stroke={9}>
          <span className="font-display text-[21px] font-bold">{session.currentPercent}</span>
          <span className="-mt-0.5 text-[10px] font-medium text-grid-green-pale">percent</span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[17px] font-semibold lg:text-[22px]">
            {session.station.name}
          </div>
          <div className="mt-1 mb-3 truncate text-[13px] text-grid-green-pale">
            Charger {session.charger.chargerCode} · started {time(session.startTime)}
          </div>
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-4">
            {reached ? (
              <LiveStat value="Ready" label={`at ${session.targetPercent}%`} />
            ) : (
              <LiveStat
                value={duration(session.minutesToTarget)}
                label={`to ${session.targetPercent}%`}
              />
            )}
            <LiveStat value={kwh(session.energyKwh)} label="delivered" />
            <LiveStat value={thb(session.cost)} label="so far" />
            <LiveStat
              value={duration(session.minutesElapsed)}
              label="elapsed"
              className="hidden lg:block"
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

function LiveStat({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="font-display text-[15px] font-bold lg:text-[19px]">{value}</div>
      <div className="text-[11.5px] text-grid-green-pale">{label}</div>
    </div>
  );
}

function NoSessionCard() {
  return (
    <div className="vg-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-tint font-display text-lg font-bold text-brand">
        ⚡
      </span>
      <div className="flex-1">
        <div className="font-display text-[16px] font-semibold text-ink">
          Nothing charging right now
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-faint">
          Pick an available charger and start a session. Progress, energy and cost update live.
        </p>
      </div>
      <Button href="/stations" size="md">
        Find a charger
      </Button>
    </div>
  );
}

function QuickAction({
  href,
  glyph,
  label,
  tint,
  fg,
}: {
  href: string;
  glyph: string;
  label: string;
  tint: string;
  fg: string;
}) {
  return (
    <Link
      href={href}
      className="vg-card flex min-h-[76px] flex-col gap-2 p-3.5 transition-colors hover:border-faint-soft"
    >
      <span
        className={`flex h-[30px] w-[30px] items-center justify-center rounded-[9px] font-display text-[13px] font-bold ${tint} ${fg}`}
        aria-hidden
      >
        {glyph}
      </span>
      <span className="text-[13px] font-semibold text-ink">{label}</span>
    </Link>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-[19px] font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-[11.5px] text-faint">{label}</div>
    </div>
  );
}

function NetRow({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: dot }} />
      <span className="flex-1 text-[13px] text-muted">{label}</span>
      <span className="font-display text-[13px] font-semibold text-ink">{value}</span>
    </div>
  );
}
