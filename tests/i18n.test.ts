// English and Thai stay in step: every message, error and notification the
// app can show has a Thai version, and dates format the same everywhere.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { MESSAGES } from "../src/i18n/messages";
import { resolveLocale } from "../src/i18n/config";
import { makeFormat } from "../src/i18n/format";
import { translateError, translateIssue } from "../src/i18n/errors";
import { translateNotification } from "../src/i18n/notifications";

let pass = 0, fail = 0;
function check(name: string, ok: boolean, extra = "") {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}
const THAI = /[฀-๿]/;

console.log("\n=== Message parity ===");
const problems: string[] = [];
function walk(en: unknown, th: unknown, at: string) {
  if (typeof en === "function") {
    if (typeof th !== "function") return problems.push(`${at}: Thai is not a function`);
    if (en.length !== (th as (...a: unknown[]) => unknown).length) problems.push(`${at}: different arity`);
    return;
  }
  if (typeof en === "string") {
    // An empty English string (a blank table header) stays blank in Thai.
    if (typeof th !== "string" || (en !== "" && th.trim() === "")) problems.push(`${at}: Thai missing`);
    return;
  }
  if (Array.isArray(en)) {
    if (!Array.isArray(th) || th.length !== en.length) return problems.push(`${at}: array length differs`);
    en.forEach((v, i) => walk(v, th[i], `${at}[${i}]`));
    return;
  }
  const thObj = th as Record<string, unknown>;
  for (const key of Object.keys(en as object)) {
    if (!(key in (thObj ?? {}))) problems.push(`${at}.${key}: missing in Thai`);
    else walk((en as Record<string, unknown>)[key], thObj[key], `${at}.${key}`);
  }
  for (const key of Object.keys(thObj ?? {})) {
    if (!(key in (en as object))) problems.push(`${at}.${key}: only in Thai`);
  }
}
walk(MESSAGES.en, MESSAGES.th, "m");
check("every English message has a Thai one, and nothing extra", problems.length === 0, problems.slice(0, 5).join("; "));

let thaiStrings = 0;
const sameAsEnglish: string[] = [];
function count(en: unknown, th: unknown, at: string) {
  if (typeof en === "string" && typeof th === "string") {
    if (THAI.test(th)) thaiStrings++;
    else if (en === th && /[a-z]{3,} [a-z]{3,}/.test(en)) sameAsEnglish.push(`${at}: ${en}`);
  } else if (en && typeof en === "object") {
    for (const k of Object.keys(en)) count((en as never)[k], (th as never)?.[k], `${at}.${k}`);
  }
}
count(MESSAGES.en, MESSAGES.th, "m");
check("Thai messages are actually in Thai", thaiStrings > 400, `${thaiStrings} Thai strings`);
check("no English sentence was copied into Thai", sameAsEnglish.length === 0, sameAsEnglish.slice(0, 5).join("; "));

console.log("\n=== Choosing a language ===");
check("saved choice wins", resolveLocale("th", "en-US,en;q=0.9") === "th");
check("Thai browser → Thai", resolveLocale(undefined, "th-TH,th;q=0.9,en;q=0.8") === "th");
check("English browser → English", resolveLocale(undefined, "en-GB,en;q=0.9") === "en");
check("quality order is respected", resolveLocale(undefined, "en;q=0.4,th;q=0.8") === "th");
check("unsupported languages fall back to English", resolveLocale(undefined, "fr-FR,de;q=0.9") === "en");
check("a junk cookie is ignored", resolveLocale("xx", "th") === "th");
check("nothing at all → English", resolveLocale(null, null) === "en");

console.log("\n=== Dates and units ===");
// 03:00 UTC on Sun 25 Oct 2026 is 10:00 in Bangkok.
const when = "2026-10-25T03:00:00.000Z";
const en = makeFormat("en"), th = makeFormat("th");
check("English short day", en.weekdayDayMonth(when) === "Sun 25 Oct", en.weekdayDayMonth(when));
check("Thai short day", th.weekdayDayMonth(when) === "อา. 25 ต.ค.", th.weekdayDayMonth(when));
check("English full date", en.fullDate(when) === "Sunday 25 October", en.fullDate(when));
check("Thai full date", th.fullDate(when) === "วันอาทิตย์ที่ 25 ตุลาคม", th.fullDate(when));
check("Thai long date uses the Buddhist year", th.longDate(when) === "25 ตุลาคม 2569", th.longDate(when));
check("English long date", en.longDate(when) === "25 October 2026", en.longDate(when));
check("time is Bangkok time in both", en.time(when) === "10:00" && th.time(when) === "10:00");
check("midnight is 00:00", en.time("2026-10-24T17:00:00.000Z") === "00:00", en.time("2026-10-24T17:00:00.000Z"));
check("day before midnight Bangkok", en.dayMonth("2026-10-24T16:59:00.000Z") === "24 Oct");
check("Thai duration", th.duration(95) === "1 ชม. 35 นาที", th.duration(95));
check("English duration", en.duration(95) === "1 h 35 min", en.duration(95));
check("baht is the same in both", en.thb(1249.5) === "฿1,249.50" && th.thb(1249.5) === "฿1,249.50");
check("Thai kilometres", th.km(3.24) === "3.2 กม.", th.km(3.24));

console.log("\n=== API errors ===");
check("exact message", translateError("th", "Email or password is incorrect") === "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
check("message with a value", translateError("th", "A wallet can hold at most ฿20,000.00") === "กระเป๋าเงินเก็บได้สูงสุด ฿20,000.00");
check("id label", translateError("th", "Invalid payment id") === "รหัสการชำระเงิน ไม่ถูกต้อง");
check("English is untouched", translateError("en", "Email or password is incorrect") === "Email or password is incorrect");
check("unknown messages pass through", translateError("th", "Brand new error") === "Brand new error");

// Every message the server can throw, read straight from the source, has a
// Thai version. A new English error without one fails here.
const SOURCES = ["src/app/api", "src/server", "src/lib/validation.ts"];
function files(p: string): string[] {
  const full = path.resolve(p);
  if (fs.statSync(full).isFile()) return [full];
  return fs.readdirSync(full).flatMap((n) => files(path.join(p, n)));
}
const thrown = new Set<string>();
const THROW = /(?:\b(?:badRequest|conflict|forbidden|notFound|unauthorized)\(|HttpError\(\d+,|\.(?:min|max)\([^,)]+,|\.email\()\s*"([^"]+)"/g;
for (const file of SOURCES.flatMap(files).filter((f) => f.endsWith(".ts"))) {
  for (const match of fs.readFileSync(file, "utf8").matchAll(THROW)) thrown.add(match[1]);
}
const untranslated = [...thrown].filter((msg) => translateError("th", msg) === msg);
check(`all ${thrown.size} static server messages are translated`, thrown.size > 50 && untranslated.length === 0, untranslated.join(" | "));

const issue = z.object({ n: z.number().min(15) }).safeParse({ n: 3 }).error!.issues[0];
check("Zod's own messages use Zod's Thai locale", THAI.test(translateIssue("th", issue)), translateIssue("th", issue));
const custom = z.object({ e: z.string().email("Enter a valid email address") }).safeParse({ e: "x" }).error!.issues[0];
check("our schema messages use our Thai", translateIssue("th", custom) === "กรุณากรอกอีเมลให้ถูกต้อง", translateIssue("th", custom));

console.log("\n=== Notifications ===");
const samples = [
  ["Welcome to Volt Grid", "Find a station, reserve a charger and track every session in one place."],
  ["Payment received", "฿284.00 charged to your Volt Grid wallet for session #1042."],
  ["Payment received", "฿31.20 paid with PromptPay QR for session #12."],
  ["Session complete", "Asoke Intersection Hub · 33.4 kWh delivered in 41 minutes."],
  ["Charging started", "Rama IX Power Station · charger A1 is delivering 118 kW."],
  ["Reservation confirmed", "Siam Green Station · charger A1 is held for your slot."],
  ["Reservation cancelled", "Siam Green Station · charger A1 has been released."],
  ["Wallet topped up", "฿250.00 added with Credit card. New balance ฿1,250.00."],
  ["Refund issued", "฿64.47 refunded to your wallet for session #7. New balance ฿100.00."],
  ["Refund issued", "฿64.47 refunded to your wallet. New balance ฿100.00."],
  ["New station nearby", "Suvarnabhumi Airport Hub now has three 180 kW chargers."],
] as const;
for (const [title, body] of samples) {
  const out = translateNotification("th", { title, body });
  check(`"${title}" → Thai`, THAI.test(out.title) && THAI.test(out.body) && !/\b(delivered|added|charged|refunded|held|released|paid)\b/.test(out.body), `${out.title} / ${out.body}`);
}
check("English notifications are unchanged", translateNotification("en", { title: "Refund issued", body: "x" }).title === "Refund issued");
check("amounts survive translation", translateNotification("th", { title: "Wallet topped up", body: samples[7][1] }).body.includes("฿1,250.00"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
