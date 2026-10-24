import { APP_TIME_ZONE } from "@/lib/timezone";
import type { Locale } from "@/i18n/config";

/**
 * Numbers, units and dates for each language.
 *
 * Dates are assembled from numeric parts and our own month and weekday names
 * instead of Intl's formatted strings. Different ICU versions (Node on the
 * server, the visitor's browser) disagree on small details such as commas
 * and abbreviations, and any difference between the server-rendered text and
 * the browser's breaks hydration. Numbers and digits never differ, so only
 * those come from Intl. Everything is shown in Bangkok time.
 */

const BAHT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

type Parts = {
  year: number;
  month: number; // 1–12
  day: number;
  weekday: number; // 0 = Sunday
  hour: string;
  minute: string;
};

function parts(date: Date): Parts {
  const out: Record<string, string> = {};
  for (const p of PARTS.formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    weekday: WEEKDAY_INDEX[out.weekday] ?? 0,
    hour: out.hour === "24" ? "00" : out.hour,
    minute: out.minute,
  };
}

const NAMES = {
  en: {
    monthShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    monthLong: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
    weekdayShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    weekdayLong: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
  th: {
    monthShort: [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
    ],
    monthLong: [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
    ],
    weekdayShort: ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."],
    weekdayLong: ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"],
  },
} satisfies Record<Locale, Record<string, string[]>>;

const asDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

export const CONNECTOR_LABEL: Record<string, string> = {
  CCS2: "CCS2",
  TYPE2: "Type 2",
  CHADEMO: "CHAdeMO",
};

export function makeFormat(locale: Locale) {
  const n = NAMES[locale];
  const th = locale === "th";

  const time = (value: string | Date) => {
    const p = parts(asDate(value));
    return `${p.hour}:${p.minute}`;
  };
  /** "25 Oct" · "25 ต.ค." */
  const dayMonth = (value: string | Date) => {
    const p = parts(asDate(value));
    return `${p.day} ${n.monthShort[p.month - 1]}`;
  };
  /** "Sat 25 Oct" · "ส. 25 ต.ค." */
  const weekdayDayMonth = (value: string | Date) => {
    const p = parts(asDate(value));
    return `${n.weekdayShort[p.weekday]} ${p.day} ${n.monthShort[p.month - 1]}`;
  };
  /** "Saturday 25 October" · "วันเสาร์ที่ 25 ตุลาคม" */
  const fullDate = (value: string | Date) => {
    const p = parts(asDate(value));
    return th
      ? `วัน${n.weekdayLong[p.weekday]}ที่ ${p.day} ${n.monthLong[p.month - 1]}`
      : `${n.weekdayLong[p.weekday]} ${p.day} ${n.monthLong[p.month - 1]}`;
  };
  /** "25 October 2026" · "25 ตุลาคม 2569" (Thai dates use the Buddhist year). */
  const longDate = (value: string | Date) => {
    const p = parts(asDate(value));
    return `${p.day} ${n.monthLong[p.month - 1]} ${th ? p.year + 543 : p.year}`;
  };
  const dayOfMonth = (value: string | Date) => String(parts(asDate(value)).day);
  const monthShort = (value: string | Date) => n.monthShort[parts(asDate(value)).month - 1];
  const monthLong = (value: string | Date) => n.monthLong[parts(asDate(value)).month - 1];
  const dateTime = (value: string | Date) => `${dayMonth(value)} · ${time(value)}`;

  const minutesLabel = (m: number) => (th ? `${m} นาที` : `${m} min`);
  const duration = (minutes: number) => {
    const m = Math.max(0, Math.round(minutes));
    if (m < 60) return minutesLabel(m);
    const h = Math.floor(m / 60);
    const rest = m % 60;
    if (th) return rest ? `${h} ชม. ${rest} นาที` : `${h} ชม.`;
    return rest ? `${h} h ${rest} min` : `${h} h`;
  };

  /** "2 h ago", "Yesterday", "25 Oct" — for activity feeds. */
  const relative = (value: string | Date) => {
    const d = asDate(value);
    const mins = Math.round((Date.now() - d.getTime()) / 60_000);
    if (mins < 1) return th ? "เมื่อสักครู่" : "Just now";
    if (mins < 60) return th ? `${mins} นาทีที่แล้ว` : `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return th ? `${hours} ชม. ที่แล้ว` : `${hours} h ago`;
    const days = Math.round(hours / 24);
    if (days === 1) return th ? "เมื่อวาน" : "Yesterday";
    if (days < 7) return th ? `${days} วันที่แล้ว` : `${days} days ago`;
    return dayMonth(d);
  };

  return {
    locale,
    /** Baht, always to the satang: ฿64.47, ฿1,249.00, ฿0.00. */
    thb: (value: number) => `฿${BAHT.format(value + 0 || 0)}`,
    kwh: (value: number, decimals = 1) => `${value.toFixed(decimals)} kWh`,
    kw: (value: number) => `${Math.round(value)} kW`,
    km: (value: number) => (th ? `${value.toFixed(1)} กม.` : `${value.toFixed(1)} km`),
    duration,
    time,
    dayMonth,
    weekdayDayMonth,
    fullDate,
    longDate,
    dayOfMonth,
    monthShort,
    monthLong,
    dateTime,
    relative,
    connector: (type: string) => CONNECTOR_LABEL[type] ?? type,
  };
}

export type Format = ReturnType<typeof makeFormat>;
