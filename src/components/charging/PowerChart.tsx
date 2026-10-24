"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { curvePoints, minutesToReach, type CurvePoint } from "@/lib/charge-curve";
import { useI18n } from "@/i18n/I18nProvider";
import type { SessionDTO } from "@/lib/types";

const HEIGHT = 190;
const PAD = { top: 16, right: 14, bottom: 26, left: 40 };

/** Width of an element, kept current as it resizes. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A round step for the kW axis: 10, 20, 25, 50… */
function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * pow;
}

/**
 * Charging power over the session: solid up to now, dashed from now to the
 * target. Drawn from the same charge curve the server projects with, so the
 * "now" point matches the figures above it. Hover or touch for a reading.
 */
export function PowerChart({ session }: { session: SessionDTO }) {
  const { m, f } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<CurvePoint | null>(null);

  // A charger on OCPP reports real readings: draw those for the past and the
  // model only for what is still to come.
  const trace = session.ocpp?.trace ?? [];
  const metered = trace.length > 0;
  const input = useMemo(
    () => ({
      ratedKw: session.powerKw,
      batteryKwh: session.batteryKwh,
      startPercent: session.startPercent,
      targetPercent: session.targetPercent,
    }),
    [session.powerKw, session.batteryKwh, session.startPercent, session.targetPercent],
  );
  // Once the battery reaches the target the car stops drawing power. A
  // session left plugged in for hours would otherwise squash the curve into
  // the first few minutes, so the chart ends where charging ended.
  const reachedAt = useMemo(() => (metered ? Number.POSITIVE_INFINITY : minutesToReach(input)), [metered, input]);
  const rawElapsed = metered ? Math.max(session.minutesElapsed, trace[trace.length - 1].m) : session.minutesElapsed;
  const elapsed = Math.min(rawElapsed, reachedAt);
  const total = Math.max(elapsed + session.minutesToTarget, 1);
  const modelled = useMemo(() => curvePoints(input, total, 60), [input, total]);
  const remaining = useMemo(
    () => (metered ? curvePoints({ ...input, startPercent: session.currentPercent }, session.minutesToTarget, 40) : []),
    [metered, input, session.currentPercent, session.minutesToTarget],
  );
  const points: CurvePoint[] = metered
    ? [
        ...trace.map((t) => ({ minute: t.m, kw: t.kw, soc: t.soc ?? Number.NaN, energyKwh: Number.NaN })),
        ...remaining
          .filter((p) => p.minute > 0)
          .map((p) => ({ ...p, minute: p.minute + elapsed, energyKwh: session.energyKwh + p.energyKwh })),
      ]
    : modelled;

  const maxKw = Math.max(...points.map((p) => p.kw), session.powerKw * 0.5, 1);
  const step = niceStep(maxKw);
  const top = Math.ceil(maxKw / step) * step;
  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (minute: number) => PAD.left + (minute / total) * plotW;
  const y = (kw: number) => PAD.top + plotH - (kw / top) * plotH;

  // The curve ends at the target with power falling to zero; draw the drop.
  const path = (list: CurvePoint[]) =>
    list.map((p, i) => `${i ? "L" : "M"} ${x(p.minute).toFixed(1)} ${y(p.kw).toFixed(1)}`).join(" ");
  const past = points.filter((p) => p.minute <= elapsed);
  const nowPoint = { minute: elapsed, kw: session.currentKw, soc: session.currentPercent, energyKwh: session.energyKwh };
  const pastLine = [...past, nowPoint];
  const futureLine = [nowPoint, ...points.filter((p) => p.minute > elapsed)];
  const area = `${path(pastLine)} L ${x(elapsed).toFixed(1)} ${y(0)} L ${x(0)} ${y(0)} Z`;

  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const xTicks = [0, Math.round(total / 2), Math.round(total)];

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const minute = ((event.clientX - rect.left - PAD.left) / plotW) * total;
    if (minute < 0 || minute > total) return setHover(null);
    let best = points[0];
    for (const p of points) if (Math.abs(p.minute - minute) < Math.abs(best.minute - minute)) best = p;
    setHover(best);
  }

  const shown = hover ?? nowPoint;
  const isFuture = hover ? hover.minute > elapsed : false;

  return (
    <div ref={ref} className="relative">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-[15px] font-semibold text-ink">{m.live.powerTitle}</span>
        <span className="text-[12px] text-faint">{metered ? m.live.powerNoteMetered : m.live.powerNote}</span>
      </div>
      {width > 0 ? (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={m.live.powerAria(f.kw(session.currentKw), f.duration(session.minutesToTarget))}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          className="touch-pan-y"
        >
          <defs>
            <linearGradient id="vg-power" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.24" />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-faint)">
                {t}
              </text>
            </g>
          ))}
          <text x={PAD.left - 8} y={PAD.top - 5} textAnchor="end" fontSize="10" fill="var(--color-faint)">
            kW
          </text>
          {xTicks.map((t, i) => (
            <text
              key={i}
              x={x(t)}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
              fontSize="11"
              fill="var(--color-faint)"
            >
              {f.duration(t)}
            </text>
          ))}
          <path d={area} fill="url(#vg-power)" />
          <path d={path(futureLine)} fill="none" stroke="var(--color-brand)" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="5 5" />
          <path d={path(pastLine)} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinejoin="round" />
          <line x1={x(elapsed)} x2={x(elapsed)} y1={PAD.top} y2={y(0)} stroke="var(--color-brand)" strokeOpacity="0.25" strokeDasharray="2 3" />
          <circle cx={x(elapsed)} cy={y(session.currentKw)} r="5.5" fill="var(--color-brand)" stroke="#fff" strokeWidth="2" />
          {hover ? (
            <g pointerEvents="none">
              <line x1={x(hover.minute)} x2={x(hover.minute)} y1={PAD.top} y2={y(0)} stroke="var(--color-ink)" strokeOpacity="0.25" />
              <circle cx={x(hover.minute)} cy={y(hover.kw)} r="4.5" fill="#fff" stroke="var(--color-brand)" strokeWidth="2" />
            </g>
          ) : null}
        </svg>
      ) : (
        <div style={{ height: HEIGHT }} />
      )}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted" aria-live="off">
        <span>
          {hover ? (isFuture ? m.live.atMinuteFuture : m.live.atMinute)(f.duration(shown.minute)) : m.live.now}
        </span>
        <span className="font-semibold text-ink tabular-nums">{f.kw(shown.kw)}</span>
        {Number.isFinite(shown.soc) ? <span className="tabular-nums">{Math.floor(shown.soc)}%</span> : null}
        {Number.isFinite(shown.energyKwh) ? (
          <span className="tabular-nums">{f.kwh(shown.energyKwh, 2)}</span>
        ) : null}
      </div>
    </div>
  );
}
