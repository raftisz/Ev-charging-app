"use client";

import { useState } from "react";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync, usePolling } from "@/lib/use-async";
import { useSession } from "@/components/layout/SessionProvider";
import { duration, kw, kwh, thb, time } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/Stat";
import { EmptyState, ErrorState, FormError } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { SessionDTO } from "@/lib/types";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/payments";
import { PaymentMethodPicker } from "@/components/payments/PaymentMethodPicker";

export default function ChargingPage() {
  const toast = useToast();
  const { user, refreshUser } = useSession();
  const [stopping, setStopping] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [payFor, setPayFor] = useState<SessionDTO | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("WALLET");
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

  usePolling(() => void reload(true), 10_000, Boolean(data?.active));

  const session = data?.active ?? null;
  const targetReached = session
    ? session.currentPercent >= session.targetPercent
    : false;

  async function stop() {
    if (!session) return;
    setStopping(true);
    try {
      const { session: finished } = await api.stopSession(session.id);
      toast.push(`Session complete · ${kwh(finished.energyKwh)} delivered`);
      setConfirmStop(false);
      setPayFor(finished);
      void reload(true);
    } catch (err) {
      toast.push(
        err instanceof ApiRequestError ? err.message : "Could not stop the session",
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
      await api.paySession(payFor.id, method);
      toast.push(`Paid ${thb(payFor.cost)} with ${PAYMENT_METHOD_LABEL[method]}`);
      setPayFor(null);
      await refreshUser();
      void reload(true);
    } catch (err) {
      setPayError(err instanceof ApiRequestError ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  return (
    <Page
      title="Charging session"
      subtitle={
        session
          ? `${targetReached ? "Target reached" : "Live"} · started ${time(session.startTime)}`
          : "No session running"
      }
    >
      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <div className="vg-skeleton h-72 rounded-[22px]" /> : null}

      {data && !session ? (
        <div className="space-y-4">
          <EmptyState
            icon="⚡"
            title="Nothing charging right now"
            description="Pick an available charger at any station and start a session. Energy, cost and time to target update live on this page."
            action={{ label: "Find a charger", href: "/stations" }}
          />
          {data.unpaid.length ? (
            <section>
              <h2 className="mb-3 font-display text-[16px] font-semibold text-ink">
                Waiting for payment
              </h2>
              <ul className="space-y-3">
                {data.unpaid.map((s) => (
                  <li key={s.id} className="vg-card flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[14.5px] font-semibold text-ink">
                        {s.station.name}
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-faint">
                        {time(s.startTime)} · {kwh(s.energyKwh)} · charger{" "}
                        {s.charger.chargerCode}
                      </div>
                    </div>
                    <span className="font-display text-[16px] font-bold text-ink">
                      {thb(s.cost)}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        setPayFor(s);
                        setPayError(null);
                      }}
                    >
                      Pay now
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
                  {targetReached ? "Target reached" : "Charging now"}
                </span>
                <div className="flex-1" />
                <span className="text-[12.5px] text-grid-green-pale">
                  {kw(session.powerKw)} · {thb(session.pricePerKwh)}/kWh
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
                    target {session.targetPercent}%
                  </span>
                </ProgressRing>

                <div className="w-full flex-1">
                  <div className="text-center font-display text-[20px] font-bold sm:text-left sm:text-[24px]">
                    {session.station.name}
                  </div>
                  <div className="mt-1 mb-4 text-center text-[13px] text-grid-green-pale sm:text-left">
                    Charger {session.charger.chargerCode} · started {time(session.startTime)}
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Metric
                      label={targetReached ? "Status" : "Time to target"}
                      value={targetReached ? "Ready" : duration(session.minutesToTarget)}
                    />
                    <Metric label="Energy delivered" value={kwh(session.energyKwh)} />
                    <Metric label="Charging speed" value={kw(session.powerKw)} />
                    <Metric label="Cost so far" value={thb(session.cost)} />
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
                <span>{session.startPercent}% at start</span>
                <span>{session.targetPercent}% target</span>
              </div>

              {targetReached ? (
                <div className="mt-4 rounded-xl bg-white/15 px-3.5 py-3 text-[12.5px] leading-relaxed font-medium text-white">
                  Your battery has reached the {session.targetPercent}% target. Stop the session
                  to release the charger and settle the bill.
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                <Button
                  variant="secondary"
                  fullWidth
                  className="border-transparent bg-white text-grid-green-dark hover:bg-white/90"
                  href={`/stations/${session.station.id}`}
                >
                  Station details
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
                  Stop charging
                </Button>
              </div>
            </div>

            <div className="vg-card p-4">
              <h2 className="mb-3 font-display text-[15px] font-semibold text-ink">
                Session detail
              </h2>
              <dl className="grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
                <Row label="Session" value={`#${session.id}`} />
                <Row label="Started" value={time(session.startTime)} />
                <Row label="Elapsed" value={duration(session.minutesElapsed)} />
                <Row
                  label="Vehicle"
                  value={
                    user.vehicleMake
                      ? `${user.vehicleMake} ${user.vehicleModel ?? ""}`.trim()
                      : "Not set"
                  }
                />
                <Row
                  label="Connector"
                  value={`Charger ${session.charger.chargerCode} · ${kw(session.charger.powerKw)}`}
                />
                <Row label="Rate" value={`${thb(session.pricePerKwh)} per kWh`} />
              </dl>
            </div>
          </div>

          <div className="min-w-0 space-y-3.5">
            <div className="vg-card p-4">
              <div className="font-display text-[15px] font-semibold text-ink">Payment</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-faint">
                You will be asked to pay once the session stops. Wallet balance right now is{" "}
                <span className="font-semibold text-ink">{thb(user.walletBalance)}</span>.
              </p>
              <div className="mt-3 rounded-[14px] bg-brand-pale px-3.5 py-2.5 text-[12px] leading-[1.45] font-medium text-brand-dark">
                Charging slows down sharply above 80%. Stopping at the target keeps the cost per
                kWh sensible.
              </div>
            </div>

            {data?.unpaid.length ? (
              <div className="vg-card p-4">
                <div className="mb-2 font-display text-[15px] font-semibold text-ink">
                  Waiting for payment
                </div>
                <ul className="space-y-2.5">
                  {data.unpaid.map((s) => (
                    <li key={s.id} className="flex items-center gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-ink">
                          {s.station.name}
                        </div>
                        <div className="text-[12px] text-faint">{kwh(s.energyKwh)}</div>
                      </div>
                      <Badge tone="amber">{thb(s.cost)}</Badge>
                      <Button size="sm" variant="tint" onClick={() => setPayFor(s)}>
                        Pay
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
        title="Stop this charging session?"
        description={
          session
            ? `${kwh(session.energyKwh)} delivered so far, costing ${thb(session.cost)}. The charger is released immediately and you can pay right after.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setConfirmStop(false)}>
              Keep charging
            </Button>
            <Button variant="danger" fullWidth loading={stopping} onClick={stop}>
              Stop charging
            </Button>
          </>
        }
      />

      <Modal
        open={Boolean(payFor)}
        onClose={() => setPayFor(null)}
        title="Pay for this session"
        description={
          payFor
            ? `${payFor.station.name} · ${kwh(payFor.energyKwh)} at ${thb(payFor.pricePerKwh)}/kWh.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setPayFor(null)}>
              Later
            </Button>
            <Button variant="green" fullWidth loading={paying} onClick={pay}>
              Pay {payFor ? thb(payFor.cost) : ""}
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
              <Row label="Energy" value={kwh(payFor.energyKwh)} />
              <Row label={`Rate`} value={`${thb(payFor.pricePerKwh)}/kWh`} />
              <div className="mt-2 flex justify-between border-t border-line pt-2">
                <span className="font-semibold text-ink">Total</span>
                <span className="font-display text-[16px] font-bold text-ink">
                  {thb(payFor.cost)}
                </span>
              </div>
            </dl>
          ) : null}
        </div>
      </Modal>
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
