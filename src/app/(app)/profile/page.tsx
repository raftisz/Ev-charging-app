"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Page } from "@/components/layout/Page";
import { useSession } from "@/components/layout/SessionProvider";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { Avatar } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FormError, StatSkeleton } from "@/components/ui/States";
import { StatTile } from "@/components/ui/Stat";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/i18n/I18nProvider";

export default function ProfilePage() {
  const { user, setUser } = useSession();
  const toast = useToast();
  const router = useRouter();
  const { m, f } = useI18n();
  const t = m.account;

  const [form, setForm] = useState({
    fullName: user.fullName,
    phone: user.phone ?? "",
    vehicleMake: user.vehicleMake ?? "",
    vehicleModel: user.vehicleModel ?? "",
    vehiclePlate: user.vehiclePlate ?? "",
    batteryKwh: user.batteryKwh ? String(user.batteryKwh) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const stats = useAsync(() => api.sessions({}));
  const summary = stats.data
    ? {
        sessions: stats.data.sessions.length,
        energy: stats.data.sessions.reduce((s, x) => s + x.energyKwh, 0),
        spend: stats.data.sessions
          .filter((x) => x.paymentStatus === "PAID")
          .reduce((s, x) => s + x.cost, 0),
      }
    : null;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.fullName.trim().length < 2) {
      setError(t.nameRequired);
      return;
    }
    setSaving(true);
    try {
      const { user: updated } = await api.updateProfile({
        ...form,
        batteryKwh: form.batteryKwh ? Number(form.batteryKwh) : undefined,
      });
      setUser(updated);
      toast.push(t.saved);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await api.logout();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.push(t.signOutFailed, "error");
      setSigningOut(false);
    }
  }

  return (
    <Page title={t.profileTitle} subtitle={user.email}>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <div className="vg-card flex flex-wrap items-center gap-4 p-5">
            <Avatar user={user} size={58} />
            <div className="min-w-0 flex-1">
              <div className="font-display text-[19px] font-bold text-ink">{user.fullName}</div>
              <div className="mt-0.5 text-[13px] text-faint">{user.email}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={user.role === "USER" ? "brand" : "green"}>
                  {m.status.role[user.role]}
                </Badge>
                <Badge>{t.memberSince(f.longDate(user.createdAt))}</Badge>
              </div>
            </div>
          </div>

          <form onSubmit={save} className="vg-card space-y-4 p-5" noValidate>
            <h2 className="font-display text-[16px] font-semibold text-ink">{t.yourDetails}</h2>
            <FormError message={error} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.fullName}>
                <Input value={form.fullName} onChange={set("fullName")} autoComplete="name" />
              </Field>
              <Field label={t.phone}>
                <Input value={form.phone} onChange={set("phone")} autoComplete="tel" />
              </Field>
            </div>

            <h3 className="pt-1 font-display text-[14.5px] font-semibold text-ink">{t.vehicle}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.make}>
                <Input value={form.vehicleMake} onChange={set("vehicleMake")} placeholder="Tesla" />
              </Field>
              <Field label={t.model}>
                <Input value={form.vehicleModel} onChange={set("vehicleModel")} placeholder="Model 3" />
              </Field>
              <Field label={t.plate}>
                <Input value={form.vehiclePlate} onChange={set("vehiclePlate")} placeholder="กก 1234" />
              </Field>
              <Field
                label={t.battery}
                hint={t.batteryHint}
              >
                <Input
                  type="number"
                  min={10}
                  max={250}
                  value={form.batteryKwh}
                  onChange={set("batteryKwh")}
                  placeholder="64"
                />
              </Field>
            </div>

            <Button type="submit" loading={saving}>
              {m.common.save}
            </Button>
          </form>
        </div>

        <div className="min-w-0 space-y-3.5">
          <div className="rounded-[18px] bg-grid-green p-4 text-white">
            <div className="text-[12px] text-grid-green-pale">{t.walletBalance}</div>
            <div className="font-display text-[26px] font-bold">{f.thb(user.walletBalance)}</div>
            <Link href="/wallet" className="mt-2 inline-block text-[12.5px] font-semibold text-grid-green-pale">
              {t.topUpLink}
            </Link>
          </div>

          {stats.loading && !stats.data ? (
            <StatSkeleton count={2} />
          ) : summary ? (
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={t.sessions} value={String(summary.sessions)} />
              <StatTile label={t.energy} value={f.kwh(summary.energy, 0)} />
            </div>
          ) : null}

          <div className="vg-card divide-y divide-line">
            <NavRow href="/favorites" label={t.favourites} glyph="♥" />
            <NavRow href="/reservations" label={t.reservations} glyph="▦" />
            <NavRow href="/notifications" label={t.notifications} glyph="◉" />
            <NavRow href="/settings" label={t.settings} glyph="⚙" />
          </div>

          <Button variant="secondary" fullWidth loading={signingOut} onClick={signOut}>
            {t.signOut}
          </Button>
        </div>
      </div>
    </Page>
  );
}

function NavRow({ href, label, glyph }: { href: string; label: string; glyph: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface">
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-surface-alt font-display text-[13px] text-muted">
        {glyph}
      </span>
      <span className="flex-1 text-[13.5px] font-medium text-ink">{label}</span>
      <span aria-hidden className="text-faint">
        ›
      </span>
    </Link>
  );
}
