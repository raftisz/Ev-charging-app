/**
 * Small OCPP facts shared by the app, the CSMS (ocpp/) and the seed.
 * Dependency-free so plain Node can import it.
 */

/** A charger's charge-point identity: VG-<station, 2 digits>-<code>, e.g. VG-01-A1. */
export function ocppIdentity(stationId: number, chargerCode: string) {
  return `VG-${String(stationId).padStart(2, "0")}-${chargerCode}`;
}

/** How often charge points are told to send a Heartbeat (seconds). */
export const HEARTBEAT_INTERVAL_S = 30;

/** A charge point heard from within this window is online. */
export const ONLINE_WINDOW_MS = HEARTBEAT_INTERVAL_S * 2.5 * 1000;

export function isOcppOnline(lastSeen: Date | string | null | undefined, now = Date.now()) {
  if (!lastSeen) return false;
  return now - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS;
}

/**
 * The idTag the app hands a charger to start a session with. OCPP 1.6 caps
 * idTag at 20 characters; "VG" plus the session id fits easily.
 */
export function sessionIdTag(sessionId: number) {
  return `VGS${sessionId}`;
}

/** The session an idTag starts, or null for a tag this network didn't issue. */
export function parseIdTag(tag: string): number | null {
  const m = /^VGS(\d{1,9})$/.exec(tag);
  return m ? Number(m[1]) : null;
}
