import "server-only";
import { ConfigError } from "@/server/http";
import {
  maskPromptPayId,
  parsePromptPayId,
  promptPayPayload,
  type PromptPayTarget,
} from "@/lib/promptpay";

/**
 * Used when PROMPTPAY_ID is not set. 000-000-0000 is not a number any bank
 * will accept, so a QR built from it can be scanned in a demo but cannot
 * move real money.
 */
const DEMO_ID = "0000000000";

function recipient(): { target: PromptPayTarget; isDemo: boolean } {
  const raw = process.env.PROMPTPAY_ID?.trim();
  if (!raw) return { target: parsePromptPayId(DEMO_ID)!, isDemo: true };
  const target = parsePromptPayId(raw);
  if (!target) {
    throw new ConfigError(
      "PROMPTPAY_ID must be a 10-digit phone number, a 13-digit national/tax ID or a 15-digit e-wallet ID",
    );
  }
  return { target, isDemo: false };
}

export type PromptPayQr = {
  payload: string;
  amount: number;
  recipient: string;
  isDemoRecipient: boolean;
};

export function promptPayQr(amount: number): PromptPayQr {
  const { target, isDemo } = recipient();
  return {
    payload: promptPayPayload(target, amount),
    amount,
    recipient: maskPromptPayId(target),
    isDemoRecipient: isDemo,
  };
}
