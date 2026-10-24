import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "@/i18n/config";
import { makeFormat } from "@/i18n/format";
import { MESSAGES } from "@/i18n/messages";

/** The visitor's language: their saved choice, else their browser's. */
export async function getLocale(): Promise<Locale> {
  const [store, list] = await Promise.all([cookies(), headers()]);
  return resolveLocale(store.get(LOCALE_COOKIE)?.value, list.get("accept-language"));
}

/** Messages and formatters for server components and route handlers. */
export async function getI18n() {
  const locale = await getLocale();
  return { locale, m: MESSAGES[locale], f: makeFormat(locale) };
}
