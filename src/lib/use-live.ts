"use client";

import { useEffect, useRef, useState } from "react";
import type { DriverSnapshot, NetworkSnapshot } from "@/lib/types";

type Scope = "driver" | "network";
type SnapshotFor<S extends Scope> = S extends "driver" ? DriverSnapshot : NetworkSnapshot;

export type LiveState<T> = {
  data: T | null;
  /** "live" while events arrive over the stream, "polling" after falling back. */
  mode: "connecting" | "live" | "polling";
};

/** After this many failures in a row without one event, poll instead. */
const MAX_STREAM_FAILURES = 3;
const POLL_MS = 5_000;

/**
 * Subscribes to /api/live over Server-Sent Events. EventSource reconnects by
 * itself when the server ends a connection; if the stream cannot be opened
 * at all (a proxy that buffers, a browser without EventSource) it falls back
 * to polling the same data as JSON.
 */
export function useLive<S extends Scope>(scope: S, enabled = true): LiveState<SnapshotFor<S>> {
  const [state, setState] = useState<LiveState<SnapshotFor<S>>>({ data: null, mode: "connecting" });
  const failures = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const accept = (data: SnapshotFor<S>, mode: LiveState<SnapshotFor<S>>["mode"]) => {
      if (!stopped) setState({ data, mode });
    };

    const poll = () => {
      const load = () =>
        fetch(`/api/live?scope=${scope}&once=1`, { cache: "no-store" })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => data && accept(data, "polling"))
          .catch(() => {});
      void load();
      timer = setInterval(load, POLL_MS);
    };

    if (typeof EventSource === "undefined") {
      poll();
    } else {
      source = new EventSource(`/api/live?scope=${scope}`);
      source.addEventListener("snapshot", (event) => {
        failures.current = 0;
        accept(JSON.parse((event as MessageEvent).data), "live");
      });
      source.onerror = () => {
        // A normal end of a connection also lands here; only give up when
        // the stream keeps failing before delivering anything.
        failures.current += 1;
        if (failures.current >= MAX_STREAM_FAILURES && source) {
          source.close();
          source = null;
          poll();
        }
      };
    }

    return () => {
      stopped = true;
      source?.close();
      if (timer) clearInterval(timer);
    };
  }, [scope, enabled]);

  return state;
}
