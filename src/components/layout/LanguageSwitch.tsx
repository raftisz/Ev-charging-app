"use client";

import clsx from "clsx";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";

/** EN | ไทย pill. Saves the choice in a cookie and re-renders the page. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale, switching, m } = useI18n();
  return (
    <div
      role="group"
      aria-label={m.common.language}
      className={clsx(
        "inline-flex rounded-full bg-white p-0.5 shadow-[0_4px_14px_-8px_rgba(30,58,138,0.4)]",
        switching && "opacity-70",
        className,
      )}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
          className={clsx(
            "min-h-8 rounded-full px-3 text-[12px] font-semibold transition-colors",
            locale === code ? "bg-brand text-white" : "text-muted hover:text-ink",
          )}
        >
          {code === "en" ? "EN" : LOCALE_NAMES[code]}
        </button>
      ))}
    </div>
  );
}
