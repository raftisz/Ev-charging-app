import { APP_TIME_ZONE } from "@/lib/timezone";

const BAHT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function thb(value: number, decimals = 0) {
  if (decimals > 0) {
    return `฿${value.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
  return `฿${BAHT.format(Math.round(value))}`;
}

export function kwh(value: number, decimals = 1) {
  return `${value.toFixed(decimals)} kWh`;
}

export function kw(value: number) {
  return `${Math.round(value)} kW`;
}

export function km(value: number) {
  return `${value.toFixed(1)} km`;
}

export function duration(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

// Times are shown in Bangkok time whatever zone the browser or server is in.
const TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
});
const DAY_OF_MONTH = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, day: "numeric" });
const MONTH = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, month: "short" });
const FULL = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

export const asDate = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

export const time = (value: string | Date) => TIME.format(asDate(value));
export const dayMonth = (value: string | Date) => DAY.format(asDate(value));
export const fullDate = (value: string | Date) => FULL.format(asDate(value));
export const dayOfMonth = (value: string | Date) => DAY_OF_MONTH.format(asDate(value));
export const monthShort = (value: string | Date) => MONTH.format(asDate(value));

export function dateTime(value: string | Date) {
  const d = asDate(value);
  return `${DAY.format(d)} · ${TIME.format(d)}`;
}

/** "2 h ago", "Yesterday", "25 Aug" — for activity feeds. */
export function relative(value: string | Date) {
  const d = asDate(value);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return DAY.format(d);
}

export function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export const CONNECTOR_LABEL: Record<string, string> = {
  CCS2: "CCS2",
  TYPE2: "Type 2",
  CHADEMO: "CHAdeMO",
};
