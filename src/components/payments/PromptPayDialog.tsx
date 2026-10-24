"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/States";
import type { PaymentDTO, PendingPromptPay } from "@/lib/types";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Shows the PromptPay QR for a pending payment and lets the payer confirm
 * it. There is no bank feed behind this, so confirming is a simulation.
 */
export function PromptPayDialog({
  pending,
  onClose,
  onConfirmed,
}: {
  pending: PendingPromptPay | null;
  onClose: () => void;
  onConfirmed: (payment: PaymentDTO) => void;
}) {
  const { m, f } = useI18n();
  const qrFailed = m.payments.qrFailed;
  const [svg, setSvg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payload = pending?.promptpay.payload;

  useEffect(() => {
    if (!payload) return;
    let live = true;
    QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then((markup) => live && setSvg(markup))
      .catch(() => live && setError(qrFailed));
    return () => {
      live = false;
      setSvg(null);
      setError(null);
    };
  }, [payload, qrFailed]);

  async function confirm() {
    if (!pending) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await api.confirmPayment(pending.payment.id);
      onConfirmed(res.payment);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : m.payments.confirmFailed);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Modal
      open={Boolean(pending)}
      onClose={onClose}
      title={m.payments.qrTitle}
      description={pending ? m.payments.amount(f.thb(pending.promptpay.amount)) : undefined}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {m.payments.later}
          </Button>
          <Button variant="green" fullWidth loading={confirming} onClick={confirm}>
            {m.payments.confirm}
          </Button>
        </>
      }
    >
      {pending ? (
        <div className="space-y-3 text-center">
          <div
            className="mx-auto aspect-square w-[220px] rounded-[16px] bg-white p-2 ring-1 ring-line [&>svg]:h-full [&>svg]:w-full"
            role="img"
            aria-label={m.payments.qrAlt(f.thb(pending.promptpay.amount))}
            data-testid="promptpay-qr"
            data-payload={pending.promptpay.payload}
            // SVG markup generated locally by the qrcode library from our own payload.
            dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
          />
          <div className="font-display text-[22px] font-bold text-ink">
            {f.thb(pending.promptpay.amount)}
          </div>
          <div className="text-[12.5px] text-faint">
            {m.payments.payTo(pending.promptpay.recipient)}
          </div>
          {pending.promptpay.isDemoRecipient ? (
            <p className="rounded-[12px] bg-amber-tint px-3 py-2 text-[12px] text-amber-dark">
              {m.payments.demoRecipient}
            </p>
          ) : null}
          <p className="text-[12px] text-faint">
            {m.payments.demoConfirm}
          </p>
          <FormError message={error} />
        </div>
      ) : null}
    </Modal>
  );
}
