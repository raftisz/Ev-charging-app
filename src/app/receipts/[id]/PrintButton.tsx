"use client";

import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nProvider";

export function PrintButton() {
  const { m } = useI18n();
  return <Button onClick={() => window.print()}>{m.receipt.print}</Button>;
}
