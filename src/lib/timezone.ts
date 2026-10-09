/**
 * Every station is in Thailand, so booking days, slot times and displayed
 * times are Bangkok wall-clock time, whatever zone the server or browser is
 * in. Vercel runs in UTC, which is why this cannot rely on the local zone.
 *
 * Asia/Bangkok has no daylight saving, so a fixed +07:00 offset is exact.
 */
export const APP_TIME_ZONE = "Asia/Bangkok";
const OFFSET = "+07:00";

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const HOUR_MINUTE = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The Bangkok calendar day (YYYY-MM-DD) that `date` falls on. */
export function bangkokDay(date: Date = new Date()) {
  return DAY_KEY.format(date);
}

/** "HH:MM" in Bangkok time. */
export function bangkokTime(date: Date) {
  return HOUR_MINUTE.format(date);
}

/** The instant a Bangkok wall-clock day and "HH:MM" refer to. */
export function bangkokDate(day: string, time = "00:00") {
  return new Date(`${day}T${time}:00${OFFSET}`);
}

/** Calendar arithmetic on a YYYY-MM-DD key, independent of any zone. */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Midnight in Bangkok `n` days before the Bangkok day `now` falls on. */
export function bangkokDaysAgo(n: number, now: Date = new Date()) {
  return bangkokDate(addDays(bangkokDay(now), -n));
}

/** Midnight in Bangkok on the first of the current Bangkok month. */
export function startOfBangkokMonth(now: Date = new Date()) {
  return bangkokDate(`${bangkokDay(now).slice(0, 8)}01`);
}

/** The last `count` Bangkok days as YYYY-MM-DD keys, oldest first, ending today. */
export function lastBangkokDays(count: number, now: Date = new Date()) {
  const today = bangkokDay(now);
  return Array.from({ length: count }, (_, i) => addDays(today, i - count + 1));
}
