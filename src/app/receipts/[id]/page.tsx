import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { HttpError } from "@/server/http";
import { getReceipt } from "@/server/payments";
import { getI18n } from "@/i18n/server";
import type { ReceiptDTO } from "@/lib/types";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.meta.page(m.receipt.pageTitle((await params).id)) };
}

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
  const { m, f } = await getI18n();
  const t = m.receipt;
  const back = user.role === "ADMIN" && customer.id !== user.id ? "/admin/sessions" : "/wallet";

  return (
    <main className="min-h-dvh bg-canvas px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-[640px]">
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <Link href={back} className="text-[13px] font-semibold text-brand">
            {t.back}
          </Link>
          <PrintButton />
        </div>

        <article
          className="vg-card p-6 print:rounded-none print:p-0 print:shadow-none print:ring-0"
          data-testid="receipt"
        >
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <div className="font-display text-[18px] font-bold text-brand">{m.common.appName}</div>
              <div className="text-[12px] text-faint">{t.tagline}</div>
            </div>
            <div className="text-right">
              <h1 className="font-display text-[17px] font-semibold text-ink">{t.title[payment.type]}</h1>
              <div className="text-[12.5px] text-muted" data-testid="receipt-no">
                {receipt.receiptNo}
              </div>
              <div className="text-[12.5px] text-muted">
                {f.longDate(payment.createdAt)} · {f.time(payment.createdAt)}
              </div>
            </div>
          </header>

          {payment.status !== "PAID" ? (
            <p className="mt-4 rounded-[12px] bg-amber-tint px-3 py-2 text-[12.5px] font-semibold text-amber-dark">
              {t.status(m.status.payment[payment.status])}
            </p>
          ) : null}

          <dl className="mt-4 space-y-2 text-[13.5px]">
            <Row label={t.billedTo} value={`${customer.fullName} · ${customer.email}`} />
            {session ? (
              <>
                <Row label={t.station} value={session.stationName} />
                <Row label={t.address} value={session.stationAddress} />
                <Row label={t.charger} value={session.chargerCode} />
                <Row
                  label={t.session}
                  value={`#${session.id} · ${f.dateTime(session.startTime)}${session.endTime ? ` – ${f.time(session.endTime)}` : ""}`}
                />
                <Row label={t.energy} value={f.kwh(session.energyKwh, 2)} />
                <Row label={t.rate} value={m.payments.perKwh(f.thb(session.pricePerKwh))} />
              </>
            ) : (
              <Row label={t.item} value={t.topUp} />
            )}
            <Row label={t.method} value={m.status.paymentMethod[payment.method]} />
            {payment.providerRef ? <Row label={t.reference} value={payment.providerRef} /> : null}
          </dl>

          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-[14px] font-semibold text-ink">
              {payment.type === "REFUND" ? t.refunded : t.total}
            </span>
            <span className="font-display text-[22px] font-bold text-ink" data-testid="receipt-total">
              {f.thb(payment.amount)}
            </span>
          </div>
          <p className="mt-6 text-[11.5px] text-faint">
            {t.footnote}
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
