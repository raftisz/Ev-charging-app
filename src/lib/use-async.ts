"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";

type State<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

/**
 * Runs an async loader on mount (and whenever `deps` change), tracking the
 * loading/error/data states every page in this app has to render.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const mounted = useRef(true);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (quiet = false) => {
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loaderRef.current();
      if (mounted.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (!mounted.current) return;
      setState((s) => ({
        data: s.data,
        loading: false,
        error:
          error instanceof ApiRequestError
            ? error.message
            : "Something went wrong. Please try again.",
      }));
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    ...state,
    reload: run,
    setData: (data: T) => setState((s) => ({ ...s, data })),
  };
}

/** Re-runs `fn` on an interval — used to keep live sessions ticking. */
export function usePolling(fn: () => void, ms: number, enabled = true) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}
