"use client";

import { useState } from "react";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { kw } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { ChargerStatusBadge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PlusIcon } from "@/components/ui/Icons";
import { EmptyState, ErrorState, FormError, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { ChargerStatus } from "@/lib/types";

type Row = {
  id: number;
  chargerCode: string;
  status: string;
  powerKw: number;
  station: { id: number; name: string };
  connectors: { id: number; type: string; label: string; powerKw: number }[];
};

const BLANK = {
  stationId: "",
  chargerCode: "",
  powerKw: "120",
  connectorType: "CCS2",
  status: "AVAILABLE",
};

export default function AdminChargersPage() {
  const toast = useToast();
  const [stationFilter, setStationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const stationsQuery = useAsync(() => api.stations({ sort: "name" }), []);
  const { data, loading, error, reload } = useAsync(
    () =>
      api.chargers({
        stationId: stationFilter ? Number(stationFilter) : undefined,
        status: statusFilter || undefined,
      }),
    [stationFilter, statusFilter],
  );

  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const chargers = (data?.chargers ?? []) as Row[];
  const stations = stationsQuery.data?.stations ?? [];

  const set = (key: keyof typeof BLANK) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  function openCreate() {
    setForm({ ...BLANK, stationId: stationFilter || String(stations[0]?.id ?? "") });
    setFormError(null);
    setCreating(true);
  }

  function openEdit(row: Row) {
    setForm({
      stationId: String(row.station.id),
      chargerCode: row.chargerCode,
      powerKw: String(row.powerKw),
      connectorType: row.connectors[0]?.type ?? "CCS2",
      status: row.status,
    });
    setFormError(null);
    setEditing(row);
  }

  async function save() {
    setFormError(null);
    if (!form.stationId) return setFormError("Pick a station");
    if (!form.chargerCode.trim()) return setFormError("Charger needs a code, e.g. A1");
    if (Number(form.powerKw) <= 0) return setFormError("Power must be a positive number");

    setSaving(true);
    try {
      if (editing) {
        await api.updateCharger(editing.id, {
          chargerCode: form.chargerCode,
          powerKw: Number(form.powerKw),
          connectorType: form.connectorType,
          status: form.status,
        });
        toast.push("Charger updated");
      } else {
        await api.createCharger({
          stationId: Number(form.stationId),
          chargerCode: form.chargerCode,
          powerKw: Number(form.powerKw),
          connectorType: form.connectorType,
          status: form.status,
        });
        toast.push("Charger added");
      }
      setEditing(null);
      setCreating(false);
      void reload(true);
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : "Could not save the charger");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteCharger(deleting.id);
      toast.push("Charger removed");
      setDeleting(null);
      void reload(true);
    } catch (err) {
      toast.push(
        err instanceof ApiRequestError ? err.message : "Could not remove the charger",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      variant="admin"
      title="Chargers"
      subtitle={`${chargers.length} chargers`}
      action={
        <Button size="sm" icon={<PlusIcon />} onClick={openCreate}>
          <span className="hidden sm:inline">Add charger</span>
        </Button>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Select
          value={stationFilter}
          onChange={(e) => setStationFilter(e.target.value)}
          aria-label="Filter by station"
        >
          <option value="">All stations</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {["AVAILABLE", "CHARGING", "RESERVED", "OFFLINE", "MAINTENANCE"].map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </div>

      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <ListSkeleton count={6} /> : null}
      {data && chargers.length === 0 ? (
        <EmptyState
          icon="⚡"
          title="No chargers match"
          description="Change the filters, or add a charger to a station."
          action={{ label: "Add charger", onClick: openCreate }}
        />
      ) : null}

      {chargers.length ? (
        <div className="vg-card overflow-hidden">
          <div className="hidden grid-cols-[0.6fr_2fr_1fr_1fr_1fr_auto] gap-3 border-b border-surface-alt bg-[#FAFBFC] px-4 py-2.5 lg:grid">
            {["Code", "Station", "Connector", "Power", "Status", ""].map((c) => (
              <span key={c} className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
                {c}
              </span>
            ))}
          </div>
          <ul>
            {chargers.map((c) => (
              <li
                key={c.id}
                className="grid gap-3 border-b border-[#F5F7F9] px-4 py-3.5 last:border-0 lg:grid-cols-[0.6fr_2fr_1fr_1fr_1fr_auto] lg:items-center"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-surface-alt font-display text-[12px] font-bold text-ink">
                  {c.chargerCode}
                </span>
                <span className="text-[13.5px] font-medium text-ink">{c.station.name}</span>
                <span className="text-[13px] text-muted">
                  {c.connectors.map((x) => x.label).join(", ") || "—"}
                </span>
                <span className="text-[13px] text-muted">{kw(c.powerKw)}</span>
                <span>
                  <ChargerStatusBadge status={c.status as ChargerStatus} />
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-tint"
                    onClick={() => setDeleting(c)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit charger ${editing.chargerCode}` : "Add a charger"}
        footer={
          <>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button fullWidth loading={saving} onClick={save}>
              {editing ? "Save changes" : "Add charger"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <FormError message={formError} />
          <Field label="Station">
            <Select value={form.stationId} onChange={set("stationId")} disabled={Boolean(editing)}>
              <option value="">Choose a station…</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Charger code">
              <Input value={form.chargerCode} onChange={set("chargerCode")} placeholder="A1" />
            </Field>
            <Field label="Power (kW)">
              <Input value={form.powerKw} onChange={set("powerKw")} inputMode="numeric" />
            </Field>
            <Field label="Connector">
              <Select value={form.connectorType} onChange={set("connectorType")}>
                <option value="CCS2">CCS2</option>
                <option value="TYPE2">Type 2</option>
                <option value="CHADEMO">CHAdeMO</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={set("status")}>
                {["AVAILABLE", "CHARGING", "RESERVED", "OFFLINE", "MAINTENANCE"].map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Remove this charger?"
        description={
          deleting
            ? `Charger ${deleting.chargerCode} at ${deleting.station.name} will be removed along with its reservations and session history.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" fullWidth loading={busy} onClick={confirmDelete}>
              Remove charger
            </Button>
          </>
        }
      />
    </Page>
  );
}
