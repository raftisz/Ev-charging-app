"use client";

import { useState } from "react";
import clsx from "clsx";
import { Page } from "@/components/layout/Page";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAsync, usePolling } from "@/lib/use-async";
import { ChargerStatusBadge } from "@/components/ui/Badge";
import { ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/components/layout/SessionProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { OCPP_CONSOLE_COMMANDS } from "@/lib/validation";
import type { OcppChargePointDTO, OcppConsoleDTO, OcppFrameDTO } from "@/lib/types";

export default function AdminOcppPage() {
  const { m } = useI18n();
  const t = m.ocpp;
  const [identity, setIdentity] = useState("");
  const [showAll, setShowAll] = useState(false);
  const { data, error, reload } = useAsync(() => api.ocppConsole(identity || undefined), [identity]);
  usePolling(() => void reload(true), 3000);

  const online = data?.chargePoints.filter((c) => c.online) ?? [];
  const shown = showAll ? (data?.chargePoints ?? []) : online;

  return (
    <Page variant="admin" title={t.title} subtitle={t.subtitle}>
      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {!data && !error ? <ListSkeleton count={5} /> : null}

      {data ? (
        <div className="space-y-4">
          <CsmsStatus data={data} onlineCount={online.length} />

          {data.configured && data.reachable ? (
            <section className="vg-card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3">
                <h2 className="font-display text-[16px] font-semibold text-ink">{t.online(online.length)}</h2>
                <span className="text-[12.5px] text-faint">{t.total(data.chargePoints.length)}</span>
                <div className="flex-1" />
                <label className="flex items-center gap-2 text-[12.5px] text-muted">
                  <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
                  {t.showAll}
                </label>
              </div>
              {shown.length === 0 ? (
                <div className="border-t border-line px-4 py-6 text-[13px] text-faint">{t.noneOnline}</div>
              ) : (
                <ChargePointTable rows={shown} />
              )}
            </section>
          ) : null}

          <Frames
            frames={data.frames}
            identities={data.chargePoints.filter((c) => c.online || c.lastSeen).map((c) => c.identity)}
            identity={identity}
            onIdentity={setIdentity}
          />
        </div>
      ) : null}
    </Page>
  );
}

function CsmsStatus({ data, onlineCount }: { data: OcppConsoleDTO; onlineCount: number }) {
  const { m } = useI18n();
  const t = m.ocpp;
  const tone = !data.configured ? "neutral" : data.reachable ? "green" : "danger";
  const label = !data.configured ? t.csmsOff : data.reachable ? t.csmsUp : t.csmsDown;
  const example = data.chargePoints[0]?.identity ?? "VG-01-A1";
  return (
    <section className="vg-card p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          data-csms={tone}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold",
            tone === "green" && "bg-grid-green-tint text-grid-green-dark",
            tone === "danger" && "bg-danger-tint text-danger-dark",
            tone === "neutral" && "bg-surface-alt text-muted",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {label}
        </span>
        {data.reachable ? <span className="text-[12.5px] text-faint">{t.online(onlineCount)}</span> : null}
      </div>
      {!data.configured ? (
        <p className="mt-3 max-w-[70ch] text-[13px] leading-relaxed text-muted">{t.notConfiguredBody}</p>
      ) : !data.reachable ? (
        <p className="mt-3 text-[13px] text-muted">{t.unreachableBody}</p>
      ) : onlineCount === 0 ? (
        <div className="mt-3 text-[13px] text-muted">
          <div className="font-semibold text-ink">{t.howToTitle}</div>
          <p className="mt-0.5">{t.howToBody}</p>
          <code className="mt-2 block w-fit rounded-lg bg-ink px-3 py-2 font-mono text-[12px] text-white">
            npm run ocpp:sim -- --id {example} --speed 20
          </code>
        </div>
      ) : null}
    </section>
  );
}

function ChargePointTable({ rows }: { rows: OcppChargePointDTO[] }) {
  const { m, f } = useI18n();
  const t = m.ocpp;
  const { user } = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(cp: OcppChargePointDTO, command: string) {
    setBusy(`${cp.chargerId}:${command}`);
    try {
      const res = await api.ocppCommand(cp.chargerId, command);
      toast.push(t.commandSent(res.action, String(res.response.status ?? "OK")), "success");
    } catch (e) {
      toast.push(e instanceof ApiRequestError ? e.message : m.common.genericError, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-[13px]">
        <thead>
          <tr className="border-y border-line bg-surface text-left">
            {t.columns.map((c, i) => (
              <th key={i} className="px-4 py-2 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cp) => (
            <tr key={cp.chargerId} data-identity={cp.identity} className="border-b border-line align-top last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 font-mono text-[12.5px] font-semibold text-ink">
                  <span className={clsx("h-2 w-2 rounded-full", cp.online ? "bg-grid-green-bright" : "bg-line-strong")} />
                  {cp.identity}
                </div>
                <div className="mt-0.5 text-[12px] text-faint">{f.kw(cp.powerKw)}</div>
              </td>
              <td className="px-4 py-3 text-muted">
                {cp.station.name} · {cp.chargerCode}
              </td>
              <td className="px-4 py-3">
                {cp.online ? <ChargerStatusBadge status={cp.status} /> : <span className="text-faint">{t.offline}</span>}
              </td>
              <td className="px-4 py-3 text-[12px] text-muted">
                {cp.vendor ? (
                  <>
                    {cp.vendor} {cp.model}
                    <div className="text-faint">{cp.firmware}</div>
                  </>
                ) : (
                  "–"
                )}
              </td>
              <td className="px-4 py-3 text-[12.5px]">
                {cp.transaction ? (
                  <>
                    <div className="font-medium text-ink">
                      {cp.transaction.transactionId
                        ? t.transaction(String(cp.transaction.transactionId), cp.transaction.driver)
                        : t.waitingTx(cp.transaction.driver)}
                    </div>
                    {cp.transaction.transactionId ? (
                      <div className="text-faint tabular-nums">
                        {f.kw(cp.transaction.kw)} · {f.kwh(cp.transaction.energyKwh, 2)}
                        {cp.transaction.soc !== null ? ` · ${cp.transaction.soc}%` : ""}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <span className="text-faint">{t.noTransaction}</span>
                )}
              </td>
              <td className="px-4 py-3 text-[12px] whitespace-nowrap text-faint">
                {cp.lastSeen ? f.relative(cp.lastSeen) : "–"}
              </td>
              <td className="px-4 py-3">
                {cp.online && user?.role === "ADMIN" ? (
                  <select
                    aria-label={t.commands}
                    value=""
                    disabled={busy !== null}
                    onChange={(e) => e.target.value && void run(cp, e.target.value)}
                    className="h-8 rounded-full border border-line bg-white px-3 text-[12px] text-ink"
                  >
                    <option value="">{t.commands}</option>
                    {OCPP_CONSOLE_COMMANDS.map((c) => (
                      <option key={c} value={c}>
                        {t.cmd[c]}
                      </option>
                    ))}
                  </select>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Frames({
  frames,
  identities,
  identity,
  onIdentity,
}: {
  frames: OcppFrameDTO[];
  identities: string[];
  identity: string;
  onIdentity: (id: string) => void;
}) {
  const { m, f } = useI18n();
  const t = m.ocpp;
  const [open, setOpen] = useState<number | null>(null);
  const options = [...new Set([...identities, ...(identity ? [identity] : [])])].sort();

  return (
    <section className="vg-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3">
        <h2 className="font-display text-[16px] font-semibold text-ink">{t.framesTitle}</h2>
        <span className="text-[12.5px] text-faint">{t.framesNote}</span>
        <div className="flex-1" />
        <select
          aria-label={t.filterLabel}
          value={identity}
          onChange={(e) => onIdentity(e.target.value)}
          className="h-8 rounded-full border border-line bg-white px-3 text-[12px] text-ink"
        >
          <option value="">{t.filterAll}</option>
          {options.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
      {frames.length === 0 ? (
        <div className="border-t border-line px-4 py-6 text-[13px] text-faint">{t.noFrames}</div>
      ) : (
        <ol className="max-h-[560px] overflow-y-auto border-t border-line font-mono text-[12px]" data-testid="ocpp-frames">
          {frames.map((fr) => (
            <li key={fr.id} className="border-b border-line last:border-0">
              <button
                onClick={() => setOpen(open === fr.id ? null : fr.id)}
                aria-expanded={open === fr.id}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-left hover:bg-surface"
              >
                <span className="w-[70px] text-faint tabular-nums">{f.time(fr.createdAt)}</span>
                <span
                  className={clsx(
                    "w-[118px] whitespace-nowrap",
                    fr.direction === "in" ? "text-grid-green-dark" : "text-brand",
                  )}
                >
                  {t.direction[fr.direction]}
                </span>
                <span className="w-[86px] text-ink">{fr.identity}</span>
                <span
                  className={clsx(
                    "rounded px-1.5 py-px text-[10.5px] font-semibold",
                    fr.messageType === 2 && "bg-brand-tint text-brand",
                    fr.messageType === 3 && "bg-grid-green-tint text-grid-green-dark",
                    fr.messageType === 4 && "bg-danger-tint text-danger-dark",
                  )}
                >
                  {t.type[fr.messageType] ?? fr.messageType}
                </span>
                <span className="font-semibold text-ink">{fr.action ?? "–"}</span>
                <span className="min-w-0 flex-1 truncate text-faint">{JSON.stringify(fr.payload)}</span>
              </button>
              {open === fr.id ? (
                <pre className="overflow-x-auto bg-surface px-4 py-3 text-[11.5px] leading-relaxed text-ink">
                  {JSON.stringify(fr.payload, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
