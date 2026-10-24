"use client";

import clsx from "clsx";
import { useI18n } from "@/i18n/I18nProvider";

/** Shows whether figures are streaming live or being refreshed by polling. */
export function LiveBadge({
  mode,
  tone = "light",
}: {
  mode: "connecting" | "live" | "polling";
  tone?: "light" | "onColor";
}) {
  const { m } = useI18n();
  const label =
    mode === "live" ? m.live.badgeLive : mode === "polling" ? m.live.badgePolling : m.live.badgeConnecting;
  const hint = mode === "polling" ? m.live.badgePollingHint : m.live.badgeLiveHint;
  return (
    <span
      title={hint}
      data-live-mode={mode}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tone === "onColor" ? "bg-white/15 text-white" : "bg-grid-green-tint text-grid-green-dark",
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {mode === "live" ? (
          <span className="vg-pulse absolute inset-0 rounded-full bg-current opacity-70" />
        ) : null}
        <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {label}
    </span>
  );
}
