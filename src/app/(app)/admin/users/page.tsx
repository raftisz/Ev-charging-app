"use client";

import { useState } from "react";
import { Page } from "@/components/layout/Page";
import { useSession } from "@/components/layout/SessionProvider";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SearchIcon } from "@/components/ui/Icons";
import { EmptyState, ErrorState, FormError, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { UserDTO } from "@/lib/types";
import { useI18n } from "@/i18n/I18nProvider";

type Row = UserDTO & { sessionCount: number; reservationCount: number };

export default function AdminUsersPage() {
  const toast = useToast();
  const { user: me } = useSession();
  const { m, f } = useI18n();
  const t = m.admin;
  const [query, setQuery] = useState("");
  const { data, loading, error, reload } = useAsync(
    () => api.users(query.trim() || undefined),
    [query],
  );

  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ fullName: "", role: "USER", isActive: true });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const users = (data?.users ?? []) as Row[];
  const isAdmin = me?.role === "ADMIN";

  function openEdit(user: Row) {
    setForm({
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
    });
    setFormError(null);
    setEditing(user);
  }

  async function save() {
    if (!editing) return;
    setFormError(null);
    if (form.fullName.trim().length < 2) return setFormError(t.nameRequired);
    setSaving(true);
    try {
      // Roles are an admin decision; operators only send what they may change.
      await api.updateUser(editing.id, {
        fullName: form.fullName,
        ...(isAdmin && form.role !== editing.role ? { role: form.role } : {}),
        ...(form.isActive !== editing.isActive ? { isActive: form.isActive } : {}),
      });
      toast.push(t.userUpdated);
      setEditing(null);
      void reload(true);
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : t.userSaveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteUser(deleting.id);
      toast.push(t.userDeleted);
      setDeleting(null);
      void reload(true);
    } catch (err) {
      toast.push(
        err instanceof ApiRequestError ? err.message : t.userDeleteFailed,
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page variant="admin" title={t.usersTitle} subtitle={t.accounts(users.length)}>
      <div className="relative mb-4">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint">
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchUsers}
          aria-label={t.searchUsersLabel}
          className="vg-input pl-10"
        />
      </div>

      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <ListSkeleton count={6} /> : null}
      {data && users.length === 0 ? <EmptyState icon="◍" title={t.noUsers} /> : null}

      {users.length ? (
        <div className="vg-card overflow-hidden">
          <div className="hidden grid-cols-[2fr_1fr_0.8fr_0.9fr_1fr_auto] gap-3 border-b border-line bg-surface px-4 py-2.5 lg:grid">
            {t.userColumns.map((c, i) => (
              <span key={i} className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
                {c}
              </span>
            ))}
          </div>
          <ul>
            {users.map((u) => (
              <li
                key={u.id}
                className="grid gap-2 border-b border-line px-4 py-3.5 last:border-0 lg:grid-cols-[2fr_1fr_0.8fr_0.9fr_1fr_auto] lg:items-center lg:gap-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint font-display text-[12px] font-semibold text-brand">
                    {u.avatarInit}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-ink">
                      {u.fullName}
                      {u.id === me.id ? (
                        <span className="ml-1.5 text-[11.5px] text-faint">{t.you}</span>
                      ) : null}
                    </div>
                    <div className="truncate text-[12px] text-faint">{u.email}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={u.role === "ADMIN" ? "green" : u.role === "OPERATOR" ? "amber" : "brand"}>
                    {m.status.role[u.role]}
                  </Badge>
                  {!u.isActive ? <Badge tone="danger">{t.disabled}</Badge> : null}
                </div>
                <span className="text-[13px] text-muted">
                  {t.sessionsRes(u.sessionCount, u.reservationCount)}
                </span>
                <span className="font-display text-[13.5px] font-semibold text-ink">
                  {f.thb(u.walletBalance)}
                </span>
                <span className="text-[12.5px] text-faint">{f.longDate(u.createdAt)}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(u)}>
                    {t.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-tint"
                    disabled={u.id === me.id}
                    onClick={() => setDeleting(u)}
                  >
                    {t.delete}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? t.editUser(editing.fullName) : ""}
        description={editing?.email}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setEditing(null)}>
              {t.cancel}
            </Button>
            <Button fullWidth loading={saving} onClick={save}>
              {t.save}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <FormError message={formError} />
          <Field label={t.fullName}>
            <Input
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.role}>
              <Select
                value={form.role}
                disabled={!isAdmin}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              >
                {(["USER", "OPERATOR", "ADMIN"] as const).map((r) => (
                  <option key={r} value={r}>
                    {m.status.role[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.walletBalance}>
              {/* Read-only: balances only change through payments and refunds. */}
              <Input value={editing ? f.thb(editing.walletBalance) : ""} readOnly disabled />
            </Field>
          </div>
          <label className="flex items-center gap-3 rounded-[16px] bg-surface px-4 py-3.5">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="h-4 w-4 accent-[#2563eb]"
            />
            <span className="flex-1">
              <span className="block text-[13.5px] font-semibold text-ink">{t.accountActive}</span>
              <span className="block text-[12px] text-faint">
                {t.accountActiveHint}
              </span>
            </span>
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t.deleteUserTitle}
        description={deleting ? t.deleteUserBody(deleting.fullName, deleting.email) : undefined}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setDeleting(null)}>
              {t.keepIt}
            </Button>
            <Button variant="danger" fullWidth loading={busy} onClick={confirmDelete}>
              {t.deleteAccount}
            </Button>
          </>
        }
      />
    </Page>
  );
}
