import { CONNECTOR_LABEL, makeFormat } from "@/i18n/format";

/**
 * English formatters for code that is not tied to a visitor's language:
 * notification text written by the server, receipts' fallback, tests.
 * Screens use the locale-aware versions from `useI18n().f` instead.
 */
const en = makeFormat("en");

export const {
  thb,
  kwh,
  kw,
  km,
  duration,
  time,
  dayMonth,
  fullDate,
  dayOfMonth,
  monthShort,
  dateTime,
  relative,
} = en;

export { CONNECTOR_LABEL };

export const asDate = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

export function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
