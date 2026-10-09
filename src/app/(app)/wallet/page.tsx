"use client";

import { useState } from "react";
import clsx from "clsx";
import { Page } from "@/components/layout/Page";
import { useSession } from "@/components/layout/SessionProvider";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { dateTime, thb } from "@/lib/format";
import { TOP_UP_MAX, TOP_UP_MIN } from "@/lib/validation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { EmptyState, ErrorState, FormError, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { PaymentDTO, PaymentStatus } from "@/lib/types";

const PRESETS = [100, 300, 500, 1000];

const TOP_UP_METHODS = [
  { value: "CREDIT_CARD", label: "Credit card", glyph: "▭" },
  { value: "PROMPTPAY", label: "PromptPay QR", glyph: "▦" },
] as const;

const STATUS_TONE: Record<PaymentStatus, "green" | "amber" | "danger" | "neutral"> = {
  PAID: "green",
  PENDING: "amber",
  FAILED: "danger",
  REFUNDED: "neutral",
};

/** Money into the wallet is positive, money out of it negative. */
function signedAmount(p: PaymentDTO) {
  if (p.type === "TOPUP" || p.type === "REFUND") return p.amount;
  return p.method === "WALLET" ? -p.amount : 0;
}

function describe(p: PaymentDTO) {
  if (p.type === "TOPUP") return "Wallet top-up";
  if (p.type === "REFUND") return `Refund · session #${p.sessionId ?? "—"}`;
  return p.stationName ?? `Charging session #${p.sessionId ?? "—"}`;
}

export default function WalletPage() {
  const { user, refreshUser } = useSession();
  const toast = useToast();
  const [amount, setAmount] = useState("300");
  const [method, setMethod] = useState<(typeof TOP_UP_METHODS)[number]["value"]>("CREDIT_CARD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, error: loadError, reload } = useAsync(() => api.wallet());
  const balance = data?.balance ?? user.walletBalance;

  async function topUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value < TOP_UP_MIN || value > TOP_UP_MAX) {
      setError(`Enter an amount between ${thb(TOP_UP_MIN)} and ${thb(TOP_UP_MAX)}`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.topUp(value, method);
      toast.push(`Added ${thb(value)}. Balance ${thb(res.balance)}`);
      await refreshUser();
      void reload(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Top-up failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page title="Wallet" subtitle="Top up and see every payment">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-3.5">
          <div className="rounded-[18px] bg-grid-green p-4 text-white">
            <div className="text-[12px] text-grid-green-pale">Wallet balance</div>
            <div className="font-display text-[28px] font-bold" data-testid="wallet-balance">
              {thb(balance)}
            </div>
          </div>

          <form onSubmit={topUp} className="vg-card space-y-4 p-4">
            <h2 className="font-display text-[15px] font-semibold text-ink">Top up</h2>

            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  aria-pressed={Number(amount) === p}
                  className={clsx(
                    "rounded-xl border py-2 text-[13px] font-semibold transition-colors",
                    Number(amount) === p
                      ? "border-brand bg-brand-tint text-brand"
                      : "border-line text-muted hover:text-ink",
                  )}
                >
                  {thb(p)}
                </button>
              ))}
            </div>

            <Field label="Amount (฿)" hint={`${thb(TOP_UP_MIN)} – ${thb(TOP_UP_MAX)}`}>
              <Input
                type="number"
                inputMode="decimal"
                min={TOP_UP_MIN}
                max={TOP_UP_MAX}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>

            <fieldset>
              <legend className="vg-label">Pay with</legend>
              <div className="grid grid-cols-2 gap-2">
                {TOP_UP_METHODS.map((m) => (
                  <label
                    key={m.value}
                    className={clsx(
                      "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium",
                      method === m.value ? "border-brand bg-brand-tint text-brand" : "border-line text-muted",
                    )}
                  >
                    <input
                      type="radio"
                      name="topup-method"
                      value={m.value}
                      checked={method === m.value}
                      onChange={() => setMethod(m.value)}
                      className="sr-only"
                    />
                    <span aria-hidden>{m.glyph}</span>
                    {m.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <FormError message={error} />
            <Button type="submit" variant="green" fullWidth loading={submitting}>
              Top up {Number(amount) > 0 ? thb(Number(amount)) : ""}
            </Button>
            <p className="text-[11.5px] text-faint">
              Demo mode: top-ups are approved immediately, no real money is charged.
            </p>
          </form>
        </div>

        <div className="min-w-0">
          <h2 className="mb-3 font-display text-[15px] font-semibold text-ink">Transactions</h2>
          {loadError && !data ? <ErrorState message={loadError} onRetry={() => void reload()} /> : null}
          {loading && !data ? <ListSkeleton count={6} /> : null}
          {data && data.transactions.length === 0 ? (
            <EmptyState
              icon="฿"
              title="No transactions yet"
              description="Top-ups and charging payments will show up here."
            />
          ) : null}
          {data && data.transactions.length > 0 ? (
            <ul className="vg-card divide-y divide-line">
              {data.transactions.map((p) => {
                const signed = signedAmount(p);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-ink">{describe(p)}</div>
                      <div className="mt-0.5 text-[12px] text-faint">
                        {dateTime(p.createdAt)} · {p.methodLabel}
                      </div>
                    </div>
                    <Badge tone={STATUS_TONE[p.status]}>
                      {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                    </Badge>
                    <span
                      className={clsx(
                        "w-[88px] text-right font-display text-[14px] font-semibold",
                        signed > 0 ? "text-grid-green" : "text-ink",
                      )}
                    >
                      {signed > 0 ? "+" : signed < 0 ? "−" : ""}
                      {thb(p.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
