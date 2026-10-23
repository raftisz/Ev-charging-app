import "server-only";

/**
 * A small fixed-window counter for slowing down password guessing.
 *
 * It lives in this server instance's memory, so each instance counts on its
 * own and a restart forgets everything. That is enough to make guessing slow
 * on a demo deployment; a multi-instance production setup would keep these
 * counters in a shared store such as Redis instead.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

function current(key: string, now: number) {
  const w = windows.get(key);
  if (!w || w.resetAt <= now) return null;
  return w;
}

/** Seconds until `key` may try again, or 0 when it is under `limit`. */
export function retryAfter(key: string, limit: number, now = Date.now()) {
  const w = current(key, now);
  if (!w || w.count < limit) return 0;
  return Math.ceil((w.resetAt - now) / 1000);
}

/** Counts one attempt against `key` in a window of `windowMs`. */
export function hit(key: string, windowMs: number, now = Date.now()) {
  const w = current(key, now);
  if (w) w.count += 1;
  else windows.set(key, { count: 1, resetAt: now + windowMs });

  // Keep the map from growing without bound on a long-lived instance.
  if (windows.size > 10_000) {
    for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
  }
}

export function clear(key: string) {
  windows.delete(key);
}

/** The caller's address as the hosting proxy reports it. */
export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
