"use client";

import { useState } from "react";
import { Page } from "@/components/layout/Page";
import { useSession } from "@/components/layout/SessionProvider";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { fullDate, thb } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SearchIcon } from "@/components/ui/Icons";
import { EmptyState, ErrorState, FormError, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { UserDTO } from "@/lib/types";

type Row = UserDTO & { sessionCount: number; reservationCount: number };

export default function AdminUsersPage() {
  const toast = useToast();
  const { user: me } = useSession();
  const [query, setQuery] = useState("");
  const { data, loading, error, reload } = useAsync(
    () => api.users(query.trim() || undefined),
    [query],
  );

  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ fullName: "", role: "USER", walletBalance: "0", isActive: true });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const users = (data?.users ?? []) as Row[];

  function openEdit(user: Row) {
    setForm({
      fullName: user.fullName,
      role: user.role,
      walletBalance: String(user.walletBalance),
      isActive: user.isActive,
    });
    setFormError(null);
    setEditing(user);
  }

  async function save() {
    if (!editing) return;
    setFormError(null);
    if (form.fullName.trim().length < 2) return setFormError("Please enter a full name");
    setSaving(true);
    try {
      await api.updateUser(editing.id, {
        fullName: form.fullName,
        role: form.role,
        walletBalance: Number(form.walletBalance),
        isActive: form.isActive,
      });
      toast.push("User updated");
      setEditing(null);
      void reload(true);
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : "Could not save the user");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteUser(deleting.id);
      toast.push("User deleted");
      setDeleting(null);
      void reload(true);
    } catch (err) {
      toast.push(
        err instanceof ApiRequestError ? err.message : "Could not delete the user",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page variant="admin" title="Users" subtitle={`${users.length} accounts`}>
      <div className="relative mb-4">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint">
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          aria-label="Search users"
          className="vg-input pl-10"
        />
      </div>

      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <ListSkeleton count={6} /> : null}
      {data && users.length === 0 ? <EmptyState icon="◍" title="No users match that search" /> : null}

      {users.length ? (
        <div className="vg-card overflow-hidden">
          <div className="hidden grid-cols-[2fr_1fr_0.8fr_0.9fr_1fr_auto] gap-3 border-b border-line bg-surface px-4 py-2.5 lg:grid">
            {["User", "Role", "Sessions", "Wallet", "Joined", ""].map((c) => (
              <span key={c} className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
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
                        <span className="ml-1.5 text-[11.5px] text-faint">(you)</span>
                      ) : null}
                    </div>
                    <div className="truncate text-[12px] text-faint">{u.email}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={u.role === "ADMIN" ? "green" : u.role === "OPERATOR" ? "amber" : "brand"}>
                    {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                  </Badge>
                  {!u.isActive ? <Badge tone="danger">Disabled</Badge> : null}
                </div>
                <span className="text-[13px] text-muted">
                  {u.sessionCount} · {u.reservationCount} res.
                </span>
                <span className="font-display text-[13.5px] font-semibold text-ink">
                  {thb(u.walletBalance)}
                </span>
                <span className="text-[12.5px] text-faint">{fullDate(u.createdAt)}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(u)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-tint"
                    disabled={u.id === me.id}
                    onClick={() => setDeleting(u)}
                  >
                    Delete
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
        title={editing ? `Edit ${editing.fullName}` : ""}
        description={editing?.email}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button fullWidth loading={saving} onClick={save}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <FormError message={formError} />
          <Field label="Full name">
            <Input
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <Select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              >
                <option value="USER">Driver</option>
                <option value="OPERATOR">Operator</option>
                <option value="ADMIN">Admin</option>
              </Select>
            </Field>
            <Field label="Wallet balance (฿)">
              <Input
                value={form.walletBalance}
                inputMode="decimal"
                onChange={(e) => setForm((p) => ({ ...p, walletBalance: e.target.value }))}
              />
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
              <span className="block text-[13.5px] font-semibold text-ink">Account active</span>
              <span className="block text-[12px] text-faint">
                Disabled accounts cannot sign in.
              </span>
            </span>
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this account?"
        description={
          deleting
            ? `${deleting.fullName} (${deleting.email}) and all of their reservations, sessions and notifications will be removed.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" fullWidth loading={busy} onClick={confirmDelete}>
              Delete account
            </Button>
          </>
        }
      />
    </Page>
  );
}
