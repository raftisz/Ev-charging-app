/**
 * Volt Grid speaks English and Thai. The language lives in a cookie rather
 * than in the URL, so every existing link and route keeps working; a first
 * visit picks it from the browser's Accept-Language header.
 *
 * Dependency-free so the proxy, server code and client code can all use it.
 */

export const LOCALES = ["en", "th"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "vg_locale";

/** Names shown in the language switcher, each in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  th: "ไทย",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * The saved choice if there is one, otherwise the first supported language
 * in Accept-Language ("th-TH,th;q=0.9,en;q=0.8" → "th"), otherwise English.
 */
export function resolveLocale(saved: string | undefined | null, acceptLanguage: string | null) {
  if (isLocale(saved)) return saved;
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { base: tag.split("-")[0], q: q ? Number(q.trim().slice(2)) || 0 : 1, index };
    })
    .filter((x) => x.base && x.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return ranked.map((x) => x.base).find(isLocale) ?? DEFAULT_LOCALE;
}
