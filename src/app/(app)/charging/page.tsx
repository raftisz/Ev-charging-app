"use client";

import { useEffect, useState } from "react";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { useLive } from "@/lib/use-live";
import { PowerChart } from "@/components/charging/PowerChart";
import { LiveBadge } from "@/components/charging/LiveBadge";
import { useSession } from "@/components/layout/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/Stat";
import { EmptyState, ErrorState, FormError } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { PendingPromptPay, SessionDTO } from "@/lib/types";
import type { PaymentMethod } from "@/lib/payments";
import { useI18n } from "@/i18n/I18nProvider";
import { PaymentMethodPicker } from "@/components/payments/PaymentMethodPicker";
import { PromptPayDialog } from "@/components/payments/PromptPayDialog";

export default function ChargingPage() {
  const toast = useToast();
  const { user, refreshUser } = useSession();
  const { m, f } = useI18n();
  const t = m.charging;
  const [stopping, setStopping] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [payFor, setPayFor] = useState<SessionDTO | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("WALLET");
  const [promptPay, setPromptPay] = useState<PendingPromptPay | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    const [active, recent] = await Promise.all([
      api.sessions({ status: "ACTIVE" }),
      api.sessions({ limit: 6 }),
    ]);
    return {
      active: active.sessions[0] ?? null,
      unpaid: recent.sessions.filter(
        (s) => s.status !== "ACTIVE" && s.paymentStatus !== "PAID",
      ),
    };
  });

  // Live figures stream in over /api/live; the page load gives the first frame.
  const live = useLive("driver");
  const [ended, setEnded] = useState<number | null>(null);
  const streamed = live.data ? live.data.session : undefined;
  const candidate = streamed === undefined ? (data?.active ?? null) : streamed;
  const session = candidate && candidate.id !== ended ? candidate : null;

  // The session ended somewhere else (an admin stopped it, the target was
  // reached): refresh the list so it shows up under "waiting for payment".
  const activeId = data?.active?.id ?? null;
  useEffect(() => {
    if (activeId !== null && streamed === null) void reload(true);
  }, [activeId, streamed, reload]);
  const targetReached = session
    ? session.currentPercent >= session.targetPercent
    : false;

  async function stop() {
    if (!session) return;
    setStopping(true);
    try {
      const { session: finished } = await api.stopSession(session.id);
      setEnded(finished.id);
      toast.push(t.stopped(f.kwh(finished.energyKwh)));
      setConfirmStop(false);
      setPayFor(finished);
      void reload(true);
    } catch (err) {
      toast.push(
        err instanceof ApiRequestError ? err.message : t.stopFailed,
        "error",
      );
    } finally {
      setStopping(false);
    }
  }

  async function pay() {
    if (!payFor) return;
    setPayError(null);
    setPaying(true);
    try {
      const res = await api.paySession(payFor.id, method);
      setPayFor(null);
      if (res.payment && res.promptpay) {
        setPromptPay({ payment: res.payment, promptpay: res.promptpay });
        return;
      }
      toast.push(m.payments.paidWith(f.thb(payFor.cost), m.status.paymentMethod[method]));
      await refreshUser();
      void reload(true);
    } catch (err) {
      setPayError(err instanceof ApiRequestError ? err.message : m.payments.failed);
    } finally {
      setPaying(false);
    }
  }

  return (
    <Page
      title={t.title}
      subtitle={
        session ? t.subtitleLive(targetReached, f.time(session.startTime)) : t.subtitleNone
      }
    >
      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <div className="vg-skeleton h-72 rounded-[22px]" /> : null}

      {data && !session ? (
        <div className="space-y-4">
          <EmptyState
            icon="⚡"
            title={t.emptyTitle}
            description={t.emptyBody}
            action={{ label: t.findCharger, href: "/stations" }}
          />
          {data.unpaid.length ? (
            <section>
              <h2 className="mb-3 font-display text-[16px] font-semibold text-ink">
                {t.waiting}
              </h2>
              <ul className="space-y-3">
                {data.unpaid.map((s) => (
                  <li key={s.id} className="vg-card flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[14.5px] font-semibold text-ink">
                        {s.station.name}
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-faint">
                        {t.unpaidLine(f.time(s.startTime), f.kwh(s.energyKwh), s.charger.chargerCode)}
                      </div>
                    </div>
                    <span className="font-display text-[16px] font-bold text-ink">
                      {f.thb(s.cost)}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        setPayFor(s);
                        setPayError(null);
                      }}
                    >
                      {m.payments.payNow}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {session ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="min-w-0 space-y-4">
            <div className="rounded-[26px] bg-grid-green p-5 text-white shadow-[0_18px_44px_-20px_rgba(5,150,105,0.85)] lg:p-7">
              <div className="mb-4 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="vg-pulse absolute inset-0 rounded-full bg-grid-green-pale" />
                  <span className="relative h-2 w-2 rounded-full bg-grid-green-pale" />
                </span>
                <span className="text-[11.5px] font-semibold tracking-[0.08em] text-grid-green-pale uppercase">
                  {targetReached ? t.targetReached : t.chargingNow}
                </span>
                <LiveBadge mode={live.mode} tone="onColor" />
                <div className="flex-1" />
                <span className="text-[12.5px] text-grid-green-pale">
                  {f.kw(session.powerKw)} · {m.payments.perKwh(f.thb(session.pricePerKwh))}
                </span>
              </div>

              <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
                <ProgressRing
                  percent={(session.currentPercent / session.targetPercent) * 100}
                  size={148}
                  stroke={13}
                >
                  <span className="font-display text-[34px] leading-none font-bold">
                    {session.currentPercent}
                    <span className="text-[16px]">%</span>
                  </span>
                  <span className="mt-1 text-[11px] font-medium text-grid-green-pale">
                    {t.target(session.targetPercent)}
                  </span>
                </ProgressRing>

                <div className="w-full flex-1">
                  <div className="text-center font-display text-[20px] font-bold sm:text-left sm:text-[24px]">
                    {session.station.name}
                  </div>
                  <div className="mt-1 mb-4 text-center text-[13px] text-grid-green-pale sm:text-left">
                    {t.startedAt(session.charger.chargerCode, f.time(session.startTime))}
                  </div>
                  {session.ocpp ? (
                    <div className="-mt-2 mb-4 flex justify-center sm:justify-start">
                      <span
                        title={m.live.ocppBadgeHint(String(session.ocpp.transactionId ?? "–"))}
                        data-ocpp-state={session.ocpp.state}
                        className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white"
                      >
                        {m.live.ocppBadge}
                      </span>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Metric
                      label={targetReached ? t.status : t.timeToTarget}
                      value={targetReached ? t.ready : f.duration(session.minutesToTarget)}
                    />
                    <Metric label={t.energyDelivered} value={f.kwh(session.energyKwh)} />
                    <Metric label={t.speed} value={f.kw(session.currentKw)} />
                    <Metric label={t.costSoFar} value={f.thb(session.cost)} />
                  </div>
                </div>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-grid-green-soft transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (session.currentPercent / session.targetPercent) * 100)}%`,
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11.5px] text-grid-green-pale">
                <span>{t.atStart(session.startPercent)}</span>
                <span>{t.targetPct(session.targetPercent)}</span>
              </div>

              {session.ocpp?.state === "waiting" ? (
                <div className="mt-4 rounded-xl bg-white/15 px-3.5 py-3 text-[12.5px] leading-relaxed text-white">
                  <div className="font-semibold">{m.live.ocppWaitingTitle}</div>
                  <div className="mt-0.5 text-grid-green-pale">{m.live.ocppWaitingBody}</div>
                </div>
              ) : null}

              {targetReached ? (
                <div className="mt-4 rounded-xl bg-white/15 px-3.5 py-3 text-[12.5px] leading-relaxed font-medium text-white">
                  {t.reachedNote(session.targetPercent)}
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                <Button
                  variant="secondary"
                  fullWidth
                  className="border-transparent bg-white text-grid-green-dark hover:bg-white/90"
                  href={`/stations/${session.station.id}`}
                >
                  {t.stationDetails}
                </Button>
                <Button
                  fullWidth
                  className={
                    targetReached
                      ? "order-first bg-white text-grid-green-dark hover:bg-white/90 sm:order-last"
                      : "border border-white/35 bg-white/10 text-white hover:bg-white/20"
                  }
                  onClick={() => setConfirmStop(true)}
                >
                  {t.stop}
                </Button>
              </div>
            </div>

            <div className="vg-card p-4">
              <PowerChart session={session} />
            </div>

            <div className="vg-card p-4">
              <h2 className="mb-3 font-display text-[15px] font-semibold text-ink">
                {t.detail}
              </h2>
              <dl className="grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
                <Row label={t.session} value={`#${session.id}`} />
                <Row label={t.started} value={f.time(session.startTime)} />
                <Row label={t.elapsed} value={f.duration(session.minutesElapsed)} />
                <Row
                  label={t.vehicle}
                  value={
                    user.vehicleMake
                      ? `${user.vehicleMake} ${user.vehicleModel ?? ""}`.trim()
                      : t.notSet
                  }
                />
                <Row
                  label={t.connector}
                  value={t.connectorValue(session.charger.chargerCode, f.kw(session.charger.powerKw))}
                />
                <Row label={t.rate} value={t.perKwh(f.thb(session.pricePerKwh))} />
              </dl>
            </div>
          </div>

          <div className="min-w-0 space-y-3.5">
            <div className="vg-card p-4">
              <div className="font-display text-[15px] font-semibold text-ink">{t.payment}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-faint">
                {t.paymentNote}{" "}
                <span className="font-semibold text-ink">{f.thb(user.walletBalance)}</span>
              </p>
              <div className="mt-3 rounded-[14px] bg-brand-pale px-3.5 py-2.5 text-[12px] leading-[1.45] font-medium text-brand-dark">
                {t.slowNote}
              </div>
            </div>

            {data?.unpaid.length ? (
              <div className="vg-card p-4">
                <div className="mb-2 font-display text-[15px] font-semibold text-ink">
                  {t.waiting}
                </div>
                <ul className="space-y-2.5">
                  {data.unpaid.map((s) => (
                    <li key={s.id} className="flex items-center gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-ink">
                          {s.station.name}
                        </div>
                        <div className="text-[12px] text-faint">{f.kwh(s.energyKwh)}</div>
                      </div>
                      <Badge tone="amber">{f.thb(s.cost)}</Badge>
                      <Button size="sm" variant="tint" onClick={() => setPayFor(s)}>
                        {m.payments.pay}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <Modal
        open={confirmStop}
        onClose={() => setConfirmStop(false)}
        title={t.stopTitle}
        description={session ? t.stopBody(f.kwh(session.energyKwh), f.thb(session.cost)) : undefined}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setConfirmStop(false)}>
              {t.keepCharging}
            </Button>
            <Button variant="danger" fullWidth loading={stopping} onClick={stop}>
              {t.stop}
            </Button>
          </>
        }
      />

      <Modal
        open={Boolean(payFor)}
        onClose={() => setPayFor(null)}
        title={m.payments.payTitle}
        description={
          payFor
            ? m.payments.payDescription(
                payFor.station.name,
                f.kwh(payFor.energyKwh),
                f.thb(payFor.pricePerKwh),
              )
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setPayFor(null)}>
              {m.payments.later}
            </Button>
            <Button variant="green" fullWidth loading={paying} onClick={pay}>
              {m.payments.payAmount(payFor ? f.thb(payFor.cost) : "")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {payError ? <FormError message={payError} /> : null}
          <PaymentMethodPicker
            value={method}
            onChange={setMethod}
            walletBalance={user.walletBalance}
            amount={payFor?.cost ?? 0}
          />
          {payFor ? (
            <dl className="rounded-[16px] bg-surface p-4 text-[13px]">
              <Row label={m.payments.energy} value={f.kwh(payFor.energyKwh)} />
              <Row label={m.payments.rate} value={m.payments.perKwh(f.thb(payFor.pricePerKwh))} />
              <div className="mt-2 flex justify-between border-t border-line pt-2">
                <span className="font-semibold text-ink">{m.payments.total}</span>
                <span className="font-display text-[16px] font-bold text-ink">
                  {f.thb(payFor.cost)}
                </span>
              </div>
            </dl>
          ) : null}
        </div>
      </Modal>

      <PromptPayDialog
        pending={promptPay}
        onClose={() => setPromptPay(null)}
        onConfirmed={(payment) => {
          setPromptPay(null);
          toast.push(m.payments.paidWith(f.thb(payment.amount), m.status.paymentMethod.PROMPTPAY));
          void refreshUser();
          void reload(true);
        }}
      />
    </Page>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[11.5px] text-grid-green-pale">{label}</div>
      <div className="font-display text-[18px] font-bold">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1.5 last:border-0">
      <dt className="text-faint">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
