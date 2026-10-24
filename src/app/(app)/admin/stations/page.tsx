"use client";

import { useState } from "react";
import Link from "next/link";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { Button } from "@/components/ui/Button";
import { StationStatusBadge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PlusIcon, SearchIcon } from "@/components/ui/Icons";
import { EmptyState, ErrorState, FormError, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { StationDTO } from "@/lib/types";
import { useI18n } from "@/i18n/I18nProvider";

type FormState = {
  name: string;
  address: string;
  city: string;
  latitude: string;
  longitude: string;
  operator: string;
  status: string;
  openingHours: string;
  pricePerKwh: string;
  rating: string;
  amenities: string;
};

const BLANK: FormState = {
  name: "",
  address: "",
  city: "Bangkok",
  latitude: "13.7563",
  longitude: "100.5018",
  operator: "Volt Grid",
  status: "AVAILABLE",
  openingHours: "24 Hours",
  pricePerKwh: "8.50",
  rating: "4.5",
  amenities: "Wi-Fi, Restroom",
};

export default function AdminStationsPage() {
  const toast = useToast();
  const { m, f } = useI18n();
  const t = m.admin;
  const [query, setQuery] = useState("");
  const { data, loading, error, reload } = useAsync(
    () => api.stations({ q: query.trim() || undefined, sort: "name" }),
    [query],
  );

  const [editing, setEditing] = useState<StationDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<StationDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const stations = data?.stations ?? [];
  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  function openCreate() {
    setForm(BLANK);
    setFormError(null);
    setCreating(true);
  }

  function openEdit(station: StationDTO) {
    setForm({
      name: station.name,
      address: station.address,
      city: station.city,
      latitude: String(station.latitude),
      longitude: String(station.longitude),
      operator: station.operator,
      status: station.status,
      openingHours: station.openingHours,
      pricePerKwh: String(station.pricePerKwh),
      rating: String(station.rating),
      amenities: station.amenities.join(", "),
    });
    setFormError(null);
    setEditing(station);
  }

  async function save() {
    setFormError(null);
    if (form.name.trim().length < 2) return setFormError(t.needName);
    if (form.address.trim().length < 4) return setFormError(t.needAddress);
    if (Number.isNaN(Number(form.pricePerKwh)) || Number(form.pricePerKwh) <= 0) {
      return setFormError(t.needPrice);
    }

    setSaving(true);
    const payload = {
      ...form,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      pricePerKwh: Number(form.pricePerKwh),
      rating: Number(form.rating),
    };
    try {
      if (editing) {
        await api.updateStation(editing.id, payload);
        toast.push(t.stationUpdated);
      } else {
        await api.createStation(payload);
        toast.push(t.stationCreated);
      }
      setEditing(null);
      setCreating(false);
      void reload(true);
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : t.stationSaveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteStation(deleting.id);
      toast.push(t.stationDeleted);
      setDeleting(null);
      void reload(true);
    } catch (err) {
      toast.push(
        err instanceof ApiRequestError ? err.message : t.stationDeleteFailed,
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  const formFields = (
    <div className="space-y-3.5">
      <FormError message={formError} />
      <Field label={t.stationName}>
        <Input value={form.name} onChange={set("name")} placeholder="Sukhumvit Supercharge Hub" />
      </Field>
      <Field label={t.stationAddress}>
        <Input value={form.address} onChange={set("address")} placeholder={t.addressPlaceholder} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.stationCity}>
          <Input value={form.city} onChange={set("city")} />
        </Field>
        <Field label={t.stationOperator}>
          <Input value={form.operator} onChange={set("operator")} />
        </Field>
        <Field label={t.latitude}>
          <Input value={form.latitude} onChange={set("latitude")} inputMode="decimal" />
        </Field>
        <Field label={t.longitude}>
          <Input value={form.longitude} onChange={set("longitude")} inputMode="decimal" />
        </Field>
        <Field label={t.pricePerKwh}>
          <Input value={form.pricePerKwh} onChange={set("pricePerKwh")} inputMode="decimal" />
        </Field>
        <Field label={t.rating}>
          <Input value={form.rating} onChange={set("rating")} inputMode="decimal" />
        </Field>
        <Field label={t.status}>
          <Select value={form.status} onChange={set("status")}>
            {(["AVAILABLE", "BUSY", "OFFLINE", "MAINTENANCE"] as const).map((s) => (
              <option key={s} value={s}>
                {m.status.station[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.openingHours}>
          <Input value={form.openingHours} onChange={set("openingHours")} />
        </Field>
      </div>
      <Field label={t.amenities} hint={t.commaSeparated}>
        <Input value={form.amenities} onChange={set("amenities")} />
      </Field>
    </div>
  );

  return (
    <Page
      variant="admin"
      title={t.stationsTitle}
      subtitle={t.stationsCount(stations.length)}
      action={
        <Button size="sm" icon={<PlusIcon />} onClick={openCreate}>
          <span className="hidden sm:inline">{t.newStation}</span>
        </Button>
      }
    >
      <div className="relative mb-4">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint">
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchStations}
          aria-label={t.searchStationsLabel}
          className="vg-input pl-10"
        />
      </div>

      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <ListSkeleton count={6} /> : null}
      {data && stations.length === 0 ? (
        <EmptyState
          title={t.noStationsTitle}
          description={t.noStationsBody}
          action={{ label: t.newStation, onClick: openCreate }}
        />
      ) : null}

      {stations.length ? (
        <div className="vg-card overflow-hidden">
          <div className="hidden grid-cols-[2fr_1fr_0.8fr_0.8fr_1fr_auto] gap-3 border-b border-line bg-surface px-4 py-2.5 lg:grid">
            {t.stationColumns.map((c, i) => (
              <span key={i} className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
                {c}
              </span>
            ))}
          </div>
          <ul>
            {stations.map((s) => (
              <li
                key={s.id}
                className="grid gap-3 border-b border-line px-4 py-3.5 last:border-0 lg:grid-cols-[2fr_1fr_0.8fr_0.8fr_1fr_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <Link
                    href={`/stations/${s.id}`}
                    className="font-display text-[14px] font-semibold text-ink hover:text-brand"
                  >
                    {s.name}
                  </Link>
                  <div className="truncate text-[12.5px] text-faint">{s.address}</div>
                </div>
                <div>
                  <StationStatusBadge
                    status={s.status}
                    available={s.availableCount}
                    total={s.chargerCount}
                  />
                </div>
                <div className="text-[13px] text-muted">
                  {t.chargersUpTo(s.chargerCount, f.kw(s.maxPowerKw))}
                </div>
                <div className="font-display text-[13.5px] font-semibold text-ink">
                  {f.thb(s.pricePerKwh)}
                </div>
                <div className="text-[12.5px] text-faint">
                  {s.latitude.toFixed(3)}, {s.longitude.toFixed(3)}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>
                    {t.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-tint"
                    onClick={() => setDeleting(s)}
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
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? t.editStation(editing.name) : t.newStation}
        description={t.stationFormHint}
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
              {editing ? t.save : t.createStation}
            </Button>
          </>
        }
      >
        {formFields}
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t.deleteStationTitle}
        description={deleting ? t.deleteStationBody(deleting.name, deleting.chargerCount) : undefined}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setDeleting(null)}>
              {t.keepIt}
            </Button>
            <Button variant="danger" fullWidth loading={busy} onClick={confirmDelete}>
              {t.deleteStation}
            </Button>
          </>
        }
      />
    </Page>
  );
}
