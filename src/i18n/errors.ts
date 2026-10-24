import { z } from "zod";
import type { Locale } from "@/i18n/config";

/**
 * Error messages are written in English where they are thrown, which keeps
 * the server code readable and the logs consistent. Before an error reaches
 * a Thai-speaking visitor, `translateError` swaps it for its Thai version:
 * exact messages through a table, messages with values in them through
 * patterns. Anything not listed is returned unchanged, so a new English
 * message still reaches the visitor, just untranslated.
 */

const EXACT_TH: Record<string, string> = {
  // Generic
  "You need to sign in first": "กรุณาเข้าสู่ระบบก่อน",
  "You do not have access to this resource": "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้",
  "Not found": "ไม่พบข้อมูล",
  "Not allowed": "ไม่ได้รับอนุญาต",
  "Admin access only": "เฉพาะแอดมินเท่านั้น",
  "Please check the highlighted fields": "กรุณาตรวจสอบช่องที่ไฮไลต์ไว้",
  "Something went wrong on our side. Please try again.": "ระบบขัดข้อง กรุณาลองอีกครั้ง",
  // Sign-in and accounts
  "Email or password is incorrect": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "This account has been disabled": "บัญชีนี้ถูกปิดใช้งาน",
  "That email is already registered. Try signing in.": "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน",
  "Demo sign-in is turned off": "ปิดการเข้าสู่ระบบแบบเดโมอยู่",
  "Demo mode is turned off": "ปิดโหมดเดโมอยู่",
  "The demo data is being reset. Try again in a minute.": "กำลังรีเซ็ตข้อมูลเดโม ลองใหม่ในอีกสักครู่",
  "This demo account is unavailable right now": "บัญชีเดโมนี้ใช้งานไม่ได้ในขณะนี้",
  "The demo account's password cannot be changed": "เปลี่ยนรหัสผ่านของบัญชีเดโมไม่ได้",
  "Demo accounts cannot be deleted": "ลบบัญชีเดโมไม่ได้",
  "Demo accounts keep their role and stay active so everyone can try them":
    "บัญชีเดโมต้องคงบทบาทและเปิดใช้งานไว้ เพื่อให้ทุกคนลองใช้ได้",
  "Only an admin can change roles": "เฉพาะแอดมินเท่านั้นที่เปลี่ยนบทบาทได้",
  "Only an admin can edit staff accounts": "เฉพาะแอดมินเท่านั้นที่แก้ไขบัญชีเจ้าหน้าที่ได้",
  "Only an admin can delete staff accounts": "เฉพาะแอดมินเท่านั้นที่ลบบัญชีเจ้าหน้าที่ได้",
  "You cannot disable your own account": "ปิดใช้งานบัญชีของตัวเองไม่ได้",
  "You cannot remove your own admin role": "ถอดสิทธิ์แอดมินของตัวเองไม่ได้",
  "You cannot delete your own account": "ลบบัญชีของตัวเองไม่ได้",
  "This driver has a session running. Stop it first.": "ผู้ขับขี่รายนี้กำลังชาร์จอยู่ กรุณาหยุดการชาร์จก่อน",
  "This account has payment history. Disable it instead so the records are kept.":
    "บัญชีนี้มีประวัติการชำระเงิน ให้ปิดใช้งานแทนการลบ เพื่อเก็บประวัติไว้",
  "That user does not exist": "ไม่พบผู้ใช้นี้",
  // Stations and chargers
  "That station does not exist": "ไม่พบสถานีนี้",
  "That charger does not exist": "ไม่พบหัวชาร์จนี้",
  "That charger does not belong to the selected station": "หัวชาร์จนี้ไม่ได้อยู่ในสถานีที่เลือก",
  "That charger is already in use": "หัวชาร์จนี้กำลังถูกใช้งาน",
  "That charger is out of service right now": "หัวชาร์จนี้ปิดให้บริการอยู่",
  "That charger is reserved for another driver right now": "หัวชาร์จนี้ถูกจองไว้ให้ผู้ขับขี่คนอื่นในช่วงเวลานี้",
  "This charger has a session running. Stop it first.": "หัวชาร์จนี้กำลังชาร์จอยู่ กรุณาหยุดการชาร์จก่อน",
  "Stop the active charging sessions at this station first": "กรุณาหยุดการชาร์จที่กำลังทำงานในสถานีนี้ก่อน",
  // Sessions
  "You already have a charging session running": "คุณมีการชาร์จที่กำลังทำงานอยู่แล้ว",
  "Target charge must be above the current battery level": "เป้าหมายต้องสูงกว่าระดับแบตเตอรี่ปัจจุบัน",
  "That charging session does not exist": "ไม่พบรายการชาร์จนี้",
  "That session belongs to another driver": "รายการชาร์จนี้เป็นของผู้ขับขี่คนอื่น",
  "That session has already finished": "การชาร์จนี้สิ้นสุดแล้ว",
  "Stop the session before paying": "กรุณาหยุดชาร์จก่อนชำระเงิน",
  "This session is already paid": "รายการนี้ชำระเงินแล้ว",
  "This session was refunded": "รายการนี้คืนเงินแล้ว",
  "Unknown action. Use 'stop' or 'pay'.": "ไม่รู้จักคำสั่งนี้ ใช้ 'stop' หรือ 'pay'",
  // Reservations
  "Invalid start time": "เวลาเริ่มไม่ถูกต้อง",
  "Pick a time in the future": "กรุณาเลือกเวลาในอนาคต",
  "That slot was just taken. Pick another time.": "ช่วงเวลานี้เพิ่งถูกจองไป กรุณาเลือกเวลาอื่น",
  "That reservation does not exist": "ไม่พบการจองนี้",
  "That reservation belongs to another driver": "การจองนี้เป็นของผู้ขับขี่คนอื่น",
  "That reservation can no longer be used": "การจองนี้ใช้งานไม่ได้แล้ว",
  "That reservation has already been completed": "การจองนี้เสร็จสิ้นแล้ว",
  "That reservation is already cancelled": "การจองนี้ถูกยกเลิกแล้ว",
  "That reservation is for a different charger": "การจองนี้เป็นของหัวชาร์จอื่น",
  "You can only cancel your own reservation": "คุณยกเลิกได้เฉพาะการจองของตัวเอง",
  "Your reservation is not open yet. You can start 15 minutes before it.":
    "ยังไม่ถึงเวลาที่จอง เริ่มชาร์จได้ก่อนเวลาจอง 15 นาที",
  "Use date=YYYY-MM-DD": "ใช้รูปแบบวันที่ date=YYYY-MM-DD",
  // Payments
  "Not enough wallet balance. Top up or use another method.": "ยอดเงินในกระเป๋าไม่พอ เติมเงินหรือใช้วิธีอื่น",
  "That payment does not exist": "ไม่พบรายการชำระเงินนี้",
  "That receipt does not exist": "ไม่พบใบเสร็จนี้",
  "This payment is no longer pending": "รายการนี้ไม่ได้รอชำระแล้ว",
  "Only PromptPay payments are confirmed this way": "ยืนยันด้วยวิธีนี้ได้เฉพาะพร้อมเพย์",
  "Only an admin can issue refunds": "เฉพาะแอดมินเท่านั้นที่คืนเงินได้",
  "Only charging payments can be refunded": "คืนเงินได้เฉพาะรายการค่าชาร์จ",
  "That notification does not exist": "ไม่พบการแจ้งเตือนนี้",
  // Form validation written in the schemas
  "Please enter your full name": "กรุณากรอกชื่อ-นามสกุล",
  "Enter a valid email address": "กรุณากรอกอีเมลให้ถูกต้อง",
  "Enter a valid phone number": "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง",
  "Use at least 8 characters": "ใช้อย่างน้อย 8 ตัวอักษร",
  "Enter your password": "กรุณากรอกรหัสผ่าน",
  "Pick a start time": "กรุณาเลือกเวลาเริ่ม",
  "Station needs a name": "กรุณาตั้งชื่อสถานี",
  "Station needs an address": "กรุณากรอกที่อยู่สถานี",
  "Charger needs a code": "กรุณากรอกรหัสหัวชาร์จ",
};

type Rule = [RegExp, (...groups: string[]) => string];

const ID_LABEL_TH: Record<string, string> = {
  id: "รหัส",
  "user id": "รหัสผู้ใช้",
  "station id": "รหัสสถานี",
  "charger id": "รหัสหัวชาร์จ",
  "reservation id": "รหัสการจอง",
  "session id": "รหัสรายการชาร์จ",
  "payment id": "รหัสการชำระเงิน",
  "notification id": "รหัสการแจ้งเตือน",
};

const PATTERNS_TH: Rule[] = [
  [/^A wallet can hold at most (\S+)$/, (max) => `กระเป๋าเงินเก็บได้สูงสุด ${max}`],
  [/^Top up at least (\S+)$/, (min) => `เติมเงินขั้นต่ำ ${min}`],
  [/^Top up at most (\S+) at a time$/, (max) => `เติมเงินได้สูงสุดครั้งละ ${max}`],
  [/^Charger (\S+) already exists here$/, (code) => `มีหัวชาร์จ ${code} ในสถานีนี้แล้ว`],
  [/^Invalid (.+)$/, (what) => `${ID_LABEL_TH[what] ?? what} ไม่ถูกต้อง`],
  [/^(\S+) must be one of: (.+)$/, (name, list) => `${name} ต้องเป็นค่าใดค่าหนึ่งต่อไปนี้: ${list}`],
  [
    /^(\S+) must be a whole number from (-?\d+) to (-?\d+)$/,
    (name, min, max) => `${name} ต้องเป็นจำนวนเต็มตั้งแต่ ${min} ถึง ${max}`,
  ],
  [
    /^Too many sign-in attempts\. Try again in (\d+) minute\(s\)\.$/,
    (mins) => `ลองเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณาลองใหม่ใน ${mins} นาที`,
  ],
  [
    /^The server is not configured correctly: ([\s\S]*)$/,
    (detail) => `เซิร์ฟเวอร์ตั้งค่าไม่ถูกต้อง: ${detail}`,
  ],
];

export function translateError(locale: Locale, message: string): string {
  if (locale === "en") return message;
  const exact = EXACT_TH[message];
  if (exact) return exact;
  for (const [pattern, render] of PATTERNS_TH) {
    const match = message.match(pattern);
    if (match) return render(...match.slice(1));
  }
  return message;
}

const zodEn = z.locales.en().localeError;
const zodTh = z.locales.th().localeError;

/**
 * A validation issue's message in the visitor's language. Messages we wrote
 * go through the table above; Zod's own defaults ("Too small: …") come from
 * Zod's Thai locale.
 */
export function translateIssue(locale: Locale, issue: z.core.$ZodIssue): string {
  if (locale === "en") return issue.message;
  const ours = translateError(locale, issue.message);
  if (ours !== issue.message) return ours;
  const raw = issue as unknown as Parameters<typeof zodEn>[0];
  const asEnglish = zodEn(raw);
  const english = typeof asEnglish === "string" ? asEnglish : asEnglish?.message;
  if (english !== issue.message) return issue.message;
  const thai = zodTh(raw);
  return (typeof thai === "string" ? thai : thai?.message) ?? issue.message;
}
