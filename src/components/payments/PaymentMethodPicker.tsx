"use client";

import Link from "next/link";
import clsx from "clsx";
import { thb } from "@/lib/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/payments";

const HINT: Record<PaymentMethod, string> = {
  WALLET: "Instant, no fees",
  CREDIT_CARD: "Visa · Mastercard",
  PROMPTPAY: "Scan to pay",
};

/** Radio list of payment methods; the wallet row shows the balance. */
export function PaymentMethodPicker({
  value,
  onChange,
  walletBalance,
  amount,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  walletBalance: number;
  amount: number;
}) {
  const short = walletBalance < amount;
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Payment method">
      {PAYMENT_METHODS.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={clsx(
            "flex w-full items-center gap-3 rounded-[16px] px-4 py-3.5 text-left transition-colors",
            value === m ? "bg-brand-tint ring-2 ring-brand" : "bg-surface hover:bg-surface-alt",
          )}
        >
          <span
            className={clsx(
              "flex h-4 w-4 items-center justify-center rounded-full border-2",
              value === m ? "border-brand" : "border-line-strong",
            )}
          >
            {value === m ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
          </span>
          <span className="flex-1">
            <span className="block text-[13.5px] font-semibold text-ink">
              {PAYMENT_METHOD_LABEL[m]}
            </span>
            <span className={clsx("block text-[12px]", m === "WALLET" && short ? "text-danger" : "text-faint")}>
              {m === "WALLET"
                ? `Balance ${thb(walletBalance)}${short ? " · not enough" : ""}`
                : HINT[m]}
            </span>
          </span>
        </button>
      ))}
      {value === "WALLET" && short ? (
        <Link href="/wallet" className="block text-right text-[12.5px] font-semibold text-brand">
          Top up your wallet →
        </Link>
      ) : null}
    </div>
  );
}
