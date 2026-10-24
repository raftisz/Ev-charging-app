import type { Locale } from "@/i18n/config";

/**
 * Notifications are stored as the English text the server wrote when the
 * event happened. They are translated at display time by matching that text
 * against the templates the server uses, so old notifications follow the
 * visitor's language too. Anything unrecognised is shown as stored.
 */

const METHOD_TH: Record<string, string> = {
  "Volt Grid wallet": "กระเป๋าเงิน Volt Grid",
  "Credit card": "บัตรเครดิต",
  "PromptPay QR": "พร้อมเพย์ QR",
};
const method = (label: string) => METHOD_TH[label] ?? label;

const TITLES_TH: Record<string, string> = {
  "Welcome to Volt Grid": "ยินดีต้อนรับสู่ Volt Grid",
  "Payment received": "ได้รับการชำระเงินแล้ว",
  "Session complete": "ชาร์จเสร็จแล้ว",
  "Charging started": "เริ่มชาร์จแล้ว",
  "Reservation cancelled": "ยกเลิกการจองแล้ว",
  "Reservation confirmed": "ยืนยันการจองแล้ว",
  "Wallet topped up": "เติมเงินเข้ากระเป๋าแล้ว",
  "Refund issued": "คืนเงินแล้ว",
  "New station nearby": "มีสถานีใหม่ใกล้คุณ",
};

type Rule = [RegExp, (...groups: string[]) => string];

const BODIES_TH: Rule[] = [
  [
    /^Find a station, reserve a charger and track every session in one place\.$/,
    () => "ค้นหาสถานี จองหัวชาร์จ และติดตามทุกการชาร์จได้ในที่เดียว",
  ],
  [
    /^(\S+) paid with (.+) for session #(\d+)\.$/,
    (amount, via, id) => `ชำระ ${amount} ด้วย${method(via)} สำหรับรายการชาร์จ #${id} แล้ว`,
  ],
  [
    /^(\S+) charged to your Volt Grid wallet for session #(\d+)\.$/,
    (amount, id) => `ตัดเงิน ${amount} จากกระเป๋าเงิน Volt Grid สำหรับรายการชาร์จ #${id}`,
  ],
  [
    /^(.+) · ([\d.]+) kWh delivered in (\d+) minutes\.$/,
    (station, kwh, mins) => `${station} · ชาร์จได้ ${kwh} kWh ใน ${mins} นาที`,
  ],
  [
    /^(.+) · charger (\S+) is delivering (\d+) kW\.$/,
    (station, code, kw) => `${station} · หัวชาร์จ ${code} กำลังจ่ายไฟ ${kw} kW`,
  ],
  [
    /^(.+) · charger (\S+) has been released\.$/,
    (station, code) => `${station} · ปล่อยหัวชาร์จ ${code} ให้ผู้อื่นใช้แล้ว`,
  ],
  [
    /^(.+) · charger (\S+) is held for your slot\.$/,
    (station, code) => `${station} · กันหัวชาร์จ ${code} ไว้ให้ในช่วงเวลาที่คุณจองแล้ว`,
  ],
  [
    /^(\S+) added with (.+)\. New balance (\S+)\.$/,
    (amount, via, balance) => `เติมเงิน ${amount} ด้วย${method(via)}แล้ว ยอดคงเหลือ ${balance}`,
  ],
  [
    /^(\S+) refunded to your wallet(?: for session #(\d+))?\. New balance (\S+)\.$/,
    (amount, id, balance) =>
      `คืนเงิน ${amount} เข้ากระเป๋าแล้ว${id ? ` สำหรับรายการชาร์จ #${id}` : ""} ยอดคงเหลือ ${balance}`,
  ],
  [
    /^(.+) now has three (\d+) kW chargers\.$/,
    (station, kw) => `${station} มีหัวชาร์จ ${kw} kW เพิ่มเป็น 3 หัวแล้ว`,
  ],
];

export function translateNotification(
  locale: Locale,
  note: { title: string; body: string },
): { title: string; body: string } {
  if (locale === "en") return note;
  const title = TITLES_TH[note.title] ?? note.title;
  for (const [pattern, render] of BODIES_TH) {
    const match = note.body.match(pattern);
    if (match) return { title, body: render(...match.slice(1)) };
  }
  return { title, body: note.body };
}
