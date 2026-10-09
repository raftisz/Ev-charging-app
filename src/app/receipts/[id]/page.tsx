import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { HttpError } from "@/server/http";
import { getReceipt } from "@/server/payments";
import { dateTime, fullDate, kwh, thb, time } from "@/lib/format";
import type { ReceiptDTO } from "@/lib/types";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: `Receipt ${(await params).id} · Volt Grid` };
}

const TITLE: Record<ReceiptDTO["payment"]["type"], string> = {
  CHARGE: "Charging receipt",
  TOPUP: "Wallet top-up receipt",
  REFUND: "Refund receipt",
};

/** One payment as a printable receipt. Its owner or an admin only; else 404. */
export default async function ReceiptPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/session-expired");

  let receipt: ReceiptDTO;
  try {
    receipt = await getReceipt(Number((await params).id), user);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const { payment, session, customer } = receipt;
  const back = user.role === "ADMIN" && customer.id !== user.id ? "/admin/sessions" : "/wallet";

  return (
    <main className="min-h-dvh bg-canvas px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-[640px]">
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <Link href={back} className="text-[13px] font-semibold text-brand">
            ← Back
          </Link>
          <PrintButton />
        </div>

        <article
          className="vg-card p-6 print:rounded-none print:p-0 print:shadow-none print:ring-0"
          data-testid="receipt"
        >
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <div className="font-display text-[18px] font-bold text-brand">Volt Grid</div>
              <div className="text-[12px] text-faint">EV charging network · Bangkok</div>
            </div>
            <div className="text-right">
              <h1 className="font-display text-[17px] font-semibold text-ink">{TITLE[payment.type]}</h1>
              <div className="text-[12.5px] text-muted" data-testid="receipt-no">
                {receipt.receiptNo}
              </div>
              <div className="text-[12.5px] text-muted">
                {fullDate(payment.createdAt)} · {time(payment.createdAt)}
              </div>
            </div>
          </header>

          {payment.status !== "PAID" ? (
            <p className="mt-4 rounded-[12px] bg-amber-tint px-3 py-2 text-[12.5px] font-semibold text-amber-dark">
              Status: {payment.status.charAt(0) + payment.status.slice(1).toLowerCase()}
            </p>
          ) : null}

          <dl className="mt-4 space-y-2 text-[13.5px]">
            <Row label="Billed to" value={`${customer.fullName} · ${customer.email}`} />
            {session ? (
              <>
                <Row label="Station" value={session.stationName} />
                <Row label="Address" value={session.stationAddress} />
                <Row label="Charger" value={session.chargerCode} />
                <Row
                  label="Session"
                  value={`#${session.id} · ${dateTime(session.startTime)}${session.endTime ? ` – ${time(session.endTime)}` : ""}`}
                />
                <Row label="Energy" value={kwh(session.energyKwh, 2)} />
                <Row label="Rate" value={`${thb(session.pricePerKwh)}/kWh`} />
              </>
            ) : (
              <Row label="Item" value="Wallet top-up" />
            )}
            <Row label="Payment method" value={payment.methodLabel} />
            {payment.providerRef ? <Row label="Reference" value={payment.providerRef} /> : null}
          </dl>

          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-[14px] font-semibold text-ink">
              {payment.type === "REFUND" ? "Refunded to wallet" : "Total"}
            </span>
            <span className="font-display text-[22px] font-bold text-ink" data-testid="receipt-total">
              {thb(payment.amount)}
            </span>
          </div>
          <p className="mt-6 text-[11.5px] text-faint">
            Amounts in Thai baht. Times are Bangkok time (UTC+7).
          </p>
        </article>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-faint">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
