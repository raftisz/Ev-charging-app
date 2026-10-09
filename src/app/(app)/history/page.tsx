"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { useSession } from "@/components/layout/SessionProvider";
import { dateTime, duration, kwh, thb } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/Stat";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, FormError, ListSkeleton, StatSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { PaymentStatus, PendingPromptPay, SessionDTO } from "@/lib/types";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/payments";
import { PaymentMethodPicker } from "@/components/payments/PaymentMethodPicker";
import { PromptPayDialog } from "@/components/payments/PromptPayDialog";

const PAYMENT_TONE: Record<PaymentStatus, "green" | "amber" | "danger" | "neutral"> = {
  PAID: "green",
  PENDING: "amber",
  FAILED: "danger",
  REFUNDED: "neutral",
};

const FILTERS = ["All", "Paid", "Unpaid"] as const;

export default function HistoryPage() {
  const { user, refreshUser } = useSession();
  const toast = useToast();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [payFor, setPayFor] = useState<SessionDTO | null>(null);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("WALLET");
  const [promptPay, setPromptPay] = useState<PendingPromptPay | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(() => api.sessions({}));
  const sessions = useMemo(() => data?.sessions ?? [], [data]);

  const filtered = useMemo(() => {
    if (filter === "Paid") return sessions.filter((s) => s.paymentStatus === "PAID");
    if (filter === "Unpaid")
      return sessions.filter((s) => s.status !== "ACTIVE" && s.paymentStatus !== "PAID");
    return sessions;
  }, [sessions, filter]);

  const totals = useMemo(() => {
    const done = sessions.filter((s) => s.status !== "ACTIVE");
    return {
      sessions: done.length,
      energy: done.reduce((sum, s) => sum + s.energyKwh, 0),
      spend: done.filter((s) => s.paymentStatus === "PAID").reduce((sum, s) => sum + s.cost, 0),
      outstanding: done
        .filter((s) => s.paymentStatus !== "PAID")
        .reduce((sum, s) => sum + s.cost, 0),
    };
  }, [sessions]);

  function openPay(session: SessionDTO) {
    setPayError(null);
    setMethod(user.walletBalance >= session.cost ? "WALLET" : "CREDIT_CARD");
    setPayFor(session);
  }

  async function pay() {
    if (!payFor) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await api.paySession(payFor.id, method);
      setPayFor(null);
      if (res.payment && res.promptpay) {
        setPromptPay({ payment: res.payment, promptpay: res.promptpay });
        return;
      }
      toast.push(`Paid ${thb(payFor.cost)} with ${PAYMENT_METHOD_LABEL[method]}`);
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
      title="History & payments"
      subtitle={`Wallet balance ${thb(user.walletBalance)}`}
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
            <StatTile label="Sessions" value={String(totals.sessions)} />
            <StatTile label="Energy charged" value={kwh(totals.energy, 0)} />
            <StatTile label="Paid" value={thb(totals.spend)} tone="green" />
            <StatTile
              label="Outstanding"
              value={thb(totals.outstanding)}
              tone={totals.outstanding > 0 ? "brand" : "default"}
            />
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
            <EmptyState
              icon="≡"
              title={filter === "All" ? "No sessions yet" : `No ${filter.toLowerCase()} sessions`}
              description="Charging sessions and their receipts appear here once you have charged."
              action={{ label: "Find a station", href: "/stations" }}
            />
          ) : (
            <>
              {/* Table on desktop, cards on mobile */}
              <div className="vg-card hidden overflow-hidden lg:block">
                <div className="grid grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.9fr] border-b border-line bg-surface px-4 py-2.5">
                  {["Station", "When", "Energy", "Amount", "Status"].map((c, i) => (
                    <span
                      key={c}
                      className={clsx(
                        "text-[11px] font-semibold tracking-[0.06em] text-faint uppercase",
                        i >= 2 && "text-right",
                      )}
                    >
                      {c}
                    </span>
                  ))}
                </div>
                {filtered.map((s) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.9fr] items-center border-b border-line px-4 py-3 last:border-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={clsx(
                          "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] font-display text-[12px] font-bold",
                          s.status === "ACTIVE"
                            ? "bg-brand-tint text-brand"
                            : "bg-grid-green-tint text-grid-green",
                        )}
                      >
                        ⚡
                      </span>
                      <span className="truncate text-[13.5px] font-medium text-ink">
                        {s.station.name}
                      </span>
                    </div>
                    <span className="text-[13px] text-muted">{dateTime(s.startTime)}</span>
                    <span className="text-right text-[13px] text-muted">{kwh(s.energyKwh)}</span>
                    <span className="text-right font-display text-[13.5px] font-semibold text-ink">
                      {thb(s.cost)}
                    </span>
                    <span className="flex justify-end">
                      {s.status === "ACTIVE" ? (
                        <Badge tone="brand">Charging</Badge>
                      ) : s.paymentStatus === "PAID" ? (
                        <Badge tone="green">Paid</Badge>
                      ) : (
                        <Button size="sm" variant="tint" onClick={() => openPay(s)}>
                          Pay {thb(s.cost)}
                        </Button>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <ul className="space-y-3 lg:hidden">
                {filtered.map((s) => (
                  <li key={s.id} className="vg-card p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-grid-green-tint font-display text-[13px] font-bold text-grid-green">
                        ⚡
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-[14.5px] font-semibold text-ink">
                          {s.station.name}
                        </div>
                        <div className="mt-0.5 text-[12.5px] text-faint">
                          {dateTime(s.startTime)} · {duration(s.minutesElapsed)}
                        </div>
                      </div>
                      <Badge tone={s.status === "ACTIVE" ? "brand" : PAYMENT_TONE[s.paymentStatus]}>
                        {s.status === "ACTIVE"
                          ? "Charging"
                          : s.paymentStatus.charAt(0) + s.paymentStatus.slice(1).toLowerCase()}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-3 border-t border-surface-alt pt-3">
                      <span className="text-[12.5px] text-muted">{kwh(s.energyKwh)}</span>
                      <span className="text-line-strong">·</span>
                      <span className="text-[12.5px] text-muted">
                        {thb(s.pricePerKwh)}/kWh
                      </span>
                      <div className="flex-1" />
                      <span className="font-display text-[15px] font-bold text-ink">
                        {thb(s.cost)}
                      </span>
                      {s.status !== "ACTIVE" && s.paymentStatus !== "PAID" ? (
                        <Button size="sm" onClick={() => openPay(s)}>
                          Pay
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : null}

      <Modal
        open={Boolean(payFor)}
        onClose={() => setPayFor(null)}
        title="Pay for this session"
        description={
          payFor ? `${payFor.station.name} · ${kwh(payFor.energyKwh)} · ${thb(payFor.cost)}` : undefined
        }
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setPayFor(null)}>
              Cancel
            </Button>
            <Button variant="green" fullWidth loading={paying} onClick={pay}>
              Pay {payFor ? thb(payFor.cost) : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormError message={payError} />
          <PaymentMethodPicker
            value={method}
            onChange={setMethod}
            walletBalance={user.walletBalance}
            amount={payFor?.cost ?? 0}
          />
        </div>
      </Modal>

      <PromptPayDialog
        pending={promptPay}
        onClose={() => setPromptPay(null)}
        onConfirmed={(payment) => {
          setPromptPay(null);
          toast.push(`Paid ${thb(payment.amount)} with PromptPay QR`);
          void refreshUser();
          void reload(true);
        }}
      />
    </Page>
  );
}
