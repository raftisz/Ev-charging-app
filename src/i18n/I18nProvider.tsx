"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useTransition, type ReactNode } from "react";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { makeFormat, type Format } from "@/i18n/format";
import { MESSAGES, type Messages } from "@/i18n/messages";

type I18nValue = {
  locale: Locale;
  m: Messages;
  f: Format;
  setLocale: (next: Locale) => void;
  switching: boolean;
};

const I18nContext = createContext<I18nValue | null>(null);

const ONE_YEAR = 60 * 60 * 24 * 365;

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const [switching, startTransition] = useTransition();

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
      // Server components (the layout, the landing page) render with the
      // cookie, so re-render them; client components follow the new locale.
      startTransition(() => router.refresh());
    },
    [locale, router],
  );

  const value = useMemo(
    () => ({ locale, m: MESSAGES[locale], f: makeFormat(locale), setLocale, switching }),
    [locale, setLocale, switching],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Messages (`m`), formatters (`f`) and the current language. */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
