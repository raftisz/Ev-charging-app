"use client";

import { useState } from "react";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { Button } from "@/components/ui/Button";
import { ChargerStatusBadge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PlusIcon } from "@/components/ui/Icons";
import { EmptyState, ErrorState, FormError, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { ChargerStatus } from "@/lib/types";
import { useI18n } from "@/i18n/I18nProvider";

const CHARGER_STATUSES = ["AVAILABLE", "CHARGING", "RESERVED", "OFFLINE", "MAINTENANCE"] as const;

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
  const { m, f } = useI18n();
  const t = m.admin;
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
    if (!form.stationId) return setFormError(t.pickStation);
    if (!form.chargerCode.trim()) return setFormError(t.needCode);
    if (Number(form.powerKw) <= 0) return setFormError(t.needPower);

    setSaving(true);
    try {
      if (editing) {
        await api.updateCharger(editing.id, {
          chargerCode: form.chargerCode,
          powerKw: Number(form.powerKw),
          connectorType: form.connectorType,
          status: form.status,
        });
        toast.push(t.chargerUpdated);
      } else {
        await api.createCharger({
          stationId: Number(form.stationId),
          chargerCode: form.chargerCode,
          powerKw: Number(form.powerKw),
          connectorType: form.connectorType,
          status: form.status,
        });
        toast.push(t.chargerAdded);
      }
      setEditing(null);
      setCreating(false);
      void reload(true);
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : t.chargerSaveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteCharger(deleting.id);
      toast.push(t.chargerRemoved);
      setDeleting(null);
      void reload(true);
    } catch (err) {
      toast.push(
        err instanceof ApiRequestError ? err.message : t.chargerRemoveFailed,
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      variant="admin"
      title={t.chargersTitle}
      subtitle={t.chargersCount(chargers.length)}
      action={
        <Button size="sm" icon={<PlusIcon />} onClick={openCreate}>
          <span className="hidden sm:inline">{t.addCharger}</span>
        </Button>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Select
          value={stationFilter}
          onChange={(e) => setStationFilter(e.target.value)}
          aria-label={t.filterByStation}
        >
          <option value="">{t.allStations}</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t.filterByStatus}
        >
          <option value="">{t.allStatuses}</option>
          {CHARGER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {m.status.charger[s]}
            </option>
          ))}
        </Select>
      </div>

      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <ListSkeleton count={6} /> : null}
      {data && chargers.length === 0 ? (
        <EmptyState
          icon="⚡"
          title={t.noChargersTitle}
          description={t.noChargersBody}
          action={{ label: t.addCharger, onClick: openCreate }}
        />
      ) : null}

      {chargers.length ? (
        <div className="vg-card overflow-hidden">
          <div className="hidden grid-cols-[0.6fr_2fr_1fr_1fr_1fr_auto] gap-3 border-b border-line bg-surface px-4 py-2.5 lg:grid">
            {t.chargerColumns.map((c, i) => (
              <span key={i} className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
                {c}
              </span>
            ))}
          </div>
          <ul>
            {chargers.map((c) => (
              <li
                key={c.id}
                className="grid gap-3 border-b border-line px-4 py-3.5 last:border-0 lg:grid-cols-[0.6fr_2fr_1fr_1fr_1fr_auto] lg:items-center"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-surface-alt font-display text-[12px] font-bold text-ink">
                  {c.chargerCode}
                </span>
                <span className="text-[13.5px] font-medium text-ink">{c.station.name}</span>
                <span className="text-[13px] text-muted">
                  {c.connectors.map((x) => x.label).join(", ") || "—"}
                </span>
                <span className="text-[13px] text-muted">{f.kw(c.powerKw)}</span>
                <span>
                  <ChargerStatusBadge status={c.status as ChargerStatus} />
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                    {t.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-tint"
                    onClick={() => setDeleting(c)}
                  >
                    {t.remove}
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
        title={editing ? t.editCharger(editing.chargerCode) : t.addACharger}
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
              {t.cancel}
            </Button>
            <Button fullWidth loading={saving} onClick={save}>
              {editing ? t.save : t.addCharger}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <FormError message={formError} />
          <Field label={t.station}>
            <Select value={form.stationId} onChange={set("stationId")} disabled={Boolean(editing)}>
              <option value="">{t.chooseStation}</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.chargerCode}>
              <Input value={form.chargerCode} onChange={set("chargerCode")} placeholder="A1" />
            </Field>
            <Field label={t.power}>
              <Input value={form.powerKw} onChange={set("powerKw")} inputMode="numeric" />
            </Field>
            <Field label={t.connector}>
              <Select value={form.connectorType} onChange={set("connectorType")}>
                <option value="CCS2">CCS2</option>
                <option value="TYPE2">Type 2</option>
                <option value="CHADEMO">CHAdeMO</option>
              </Select>
            </Field>
            <Field label={t.status}>
              <Select value={form.status} onChange={set("status")}>
                {CHARGER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {m.status.charger[s]}
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
        title={t.removeChargerTitle}
        description={
          deleting ? t.removeChargerBody(deleting.chargerCode, deleting.station.name) : undefined
        }
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setDeleting(null)}>
              {t.keepIt}
            </Button>
            <Button variant="danger" fullWidth loading={busy} onClick={confirmDelete}>
              {t.removeCharger}
            </Button>
          </>
        }
      />
    </Page>
  );
}
