"use client";

import { useState } from "react";
import { Page } from "@/components/layout/Page";
import { useSession } from "@/components/layout/SessionProvider";
import { api, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FormError } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { useI18n } from "@/i18n/I18nProvider";

const PREFS = ["reservationReminders", "sessionAlerts", "receipts", "marketing"] as const;

export default function SettingsPage() {
  const { user } = useSession();
  const toast = useToast();
  const { m } = useI18n();
  const t = m.account;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [prefs, setPrefs] = useState({
    reservationReminders: true,
    sessionAlerts: true,
    receipts: true,
    marketing: false,
  });

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t.passwordShort);
      return;
    }
    if (password !== confirm) {
      setError(t.passwordMismatch);
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({ password });
      setPassword("");
      setConfirm("");
      toast.push(t.passwordUpdated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.passwordFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title={t.settingsTitle} subtitle={t.settingsSubtitle}>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="vg-card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[16px] font-semibold text-ink">{t.language}</h2>
              <p className="mt-1 text-[13px] text-faint">{t.languageBody}</p>
            </div>
            <LanguageSwitch />
          </div>
        </div>

        <form onSubmit={changePassword} className="vg-card space-y-4 p-5" noValidate>
          <div>
            <h2 className="font-display text-[16px] font-semibold text-ink">{t.password}</h2>
            <p className="mt-1 text-[13px] text-faint">
              {t.passwordBody(user.email)}
            </p>
          </div>
          <FormError message={error} />
          <Field label={t.newPassword} hint={t.passwordHint}>
            <Input
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label={t.confirmPassword}>
            <Input
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={saving}>
            {t.updatePassword}
          </Button>
        </form>

        <div className="vg-card p-5">
          <h2 className="font-display text-[16px] font-semibold text-ink">{t.notifications}</h2>
          <p className="mt-1 mb-3 text-[13px] text-faint">
            {t.notificationsBody}
          </p>
          <ul className="divide-y divide-line">
            {PREFS.map((key) => {
              const [label, hint] = t.prefs[key];
              return (
                <li key={key} className="flex items-center gap-3 py-3.5">
                  <div className="flex-1">
                    <div className="text-[13.5px] font-semibold text-ink">{label}</div>
                    <div className="text-[12.5px] text-faint">{hint}</div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={prefs[key]}
                    aria-label={label}
                    onClick={() => setPrefs((p) => ({ ...p, [key]: !p[key] }))}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      prefs[key] ? "bg-brand" : "bg-line-strong"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        prefs[key] ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Page>
  );
}
