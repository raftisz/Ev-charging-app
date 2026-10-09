// PromptPay QR payloads: EMVCo structure, amount and CRC. Only fictional
// all-zero IDs are used here; no real phone or ID number belongs in tests.
import { crc16, parsePayload, parsePromptPayId, promptPayPayload } from "../src/lib/promptpay";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

console.log("\n=== PromptPay payload ===");
check("CRC-16/CCITT-FALSE check value", crc16("123456789") === "29B1", crc16("123456789"));

const phone = parsePromptPayId("000-000-0000")!;
const payload = promptPayPayload(phone, 64.47);
const fields = parsePayload(payload);
check("format indicator 01", fields.get("00") === "01");
check("dynamic QR (one amount)", fields.get("01") === "12");
check("currency THB (764)", fields.get("53") === "764");
check("country TH", fields.get("58") === "TH");
check("amount is the requested amount", fields.get("54") === "64.47", fields.get("54"));
const account = parsePayload(fields.get("29")!);
check("PromptPay application id", account.get("00") === "A000000677010111");
check("phone as 0066 + 9 digits", account.get("01") === "0066000000000", account.get("01"));
check("CRC field is last", payload.slice(-8, -4) === "6304");
check("CRC matches the payload", crc16(payload.slice(0, -4)) === payload.slice(-4), payload);
check("whole baht keeps 2 decimals", parsePayload(promptPayPayload(phone, 249)).get("54") === "249.00");
check("tampered amount fails the CRC", crc16(payload.replace("64.47", "64.48").slice(0, -4)) !== payload.slice(-4));

const id = promptPayPayload(parsePromptPayId("0000000000000")!, 10);
check("13-digit ID uses sub-tag 02", parsePayload(parsePayload(id).get("29")!).get("02") === "0000000000000");
const wallet = promptPayPayload(parsePromptPayId("000000000000000")!, 10);
check("15-digit e-wallet uses sub-tag 03", parsePayload(parsePayload(wallet).get("29")!).get("03") === "000000000000000");
check("rejects a short number", parsePromptPayId("12345") === null);
check("rejects letters", parsePromptPayId("08x1234567") === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
