/**
 * PromptPay QR payloads, per the EMVCo merchant-presented QR spec as Thai
 * banks implement it. Pure functions with no environment access, so the
 * same code is used by the API and checked by the tests.
 */

const PROMPTPAY_AID = "A000000677010111";

/** Tag-length-value field: two-digit tag, two-digit length, value. */
function tlv(tag: string, value: string) {
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as uppercase hex. */
export function crc16(data: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(data)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type PromptPayTarget =
  | { kind: "phone"; value: string } // 10 digits starting with 0
  | { kind: "nationalId"; value: string } // 13 digits
  | { kind: "eWallet"; value: string }; // 15 digits

/** Reads a phone number, national/tax ID or e-wallet ID; null if it is none of them. */
export function parsePromptPayId(raw: string): PromptPayTarget | null {
  const digits = raw.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 10 && digits.startsWith("0")) return { kind: "phone", value: digits };
  if (digits.length === 13) return { kind: "nationalId", value: digits };
  if (digits.length === 15) return { kind: "eWallet", value: digits };
  return null;
}

function accountField(target: PromptPayTarget) {
  switch (target.kind) {
    // 0AAAAAAAAA → 0066AAAAAAAAA: country code, leading zero dropped, 13 digits.
    case "phone":
      return tlv("01", `0066${target.value.slice(1)}`);
    case "nationalId":
      return tlv("02", target.value);
    case "eWallet":
      return tlv("03", target.value);
  }
}

/** A single-use ("dynamic") PromptPay payload for an exact amount in baht. */
export function promptPayPayload(target: PromptPayTarget, amount: number) {
  const body = [
    tlv("00", "01"), // payload format indicator
    tlv("01", "12"), // point of initiation: dynamic, one amount
    tlv("29", tlv("00", PROMPTPAY_AID) + accountField(target)),
    tlv("53", "764"), // currency: THB
    tlv("54", amount.toFixed(2)),
    tlv("58", "TH"),
  ].join("");
  const withCrcTag = `${body}6304`;
  return withCrcTag + crc16(withCrcTag);
}

/** Splits a payload into its top-level fields, for display checks and tests. */
export function parsePayload(payload: string) {
  const fields = new Map<string, string>();
  let i = 0;
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    fields.set(tag, payload.slice(i + 4, i + 4 + len));
    i += 4 + len;
  }
  return fields;
}

/** "xxx-xxx-5678": enough to recognise the payee, not enough to copy. */
export function maskPromptPayId(target: PromptPayTarget) {
  return `${"x".repeat(target.value.length - 4)}${target.value.slice(-4)}`;
}
