"use client";

import { useState } from "react";
import { Page } from "@/components/layout/Page";
import { useSession } from "@/components/layout/SessionProvider";
import { api, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FormError } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

export default function SettingsPage() {
  const { user } = useSession();
  const toast = useToast();

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
      setError("Use at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({ password });
      setPassword("");
      setConfirm("");
      toast.push("Password updated");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not update the password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title="Settings" subtitle="Account, charging and app preferences">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <form onSubmit={changePassword} className="vg-card space-y-4 p-5" noValidate>
          <div>
            <h2 className="font-display text-[16px] font-semibold text-ink">Password</h2>
            <p className="mt-1 text-[13px] text-faint">
              Signed in as {user.email}. Changing this signs you in with the new password next
              time.
            </p>
          </div>
          <FormError message={error} />
          <Field label="New password" hint="At least 8 characters">
            <Input
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={saving}>
            Update password
          </Button>
        </form>

        <div className="vg-card p-5">
          <h2 className="font-display text-[16px] font-semibold text-ink">Notifications</h2>
          <p className="mt-1 mb-3 text-[13px] text-faint">
            Choose what Volt Grid tells you about. Stored on this device for the demo.
          </p>
          <ul className="divide-y divide-surface-alt">
            {(
              [
                ["reservationReminders", "Reservation reminders", "30 minutes before your slot"],
                ["sessionAlerts", "Session alerts", "When charging starts, targets, and faults"],
                ["receipts", "Payment receipts", "A receipt after every completed session"],
                ["marketing", "New stations & offers", "Occasional network news"],
              ] as const
            ).map(([key, label, hint]) => (
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
            ))}
          </ul>
        </div>
      </div>
    </Page>
  );
}
