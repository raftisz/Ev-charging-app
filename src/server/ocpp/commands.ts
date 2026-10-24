import "server-only";
import { isOcppOnline } from "@/lib/ocpp";

/**
 * The app's side of OCPP: it never talks to chargers itself. It asks the
 * CSMS (ocpp/csms.ts, a separate long-running process) to send a command,
 * over HTTP with a shared secret. Without OCPP_CSMS_URL and
 * OCPP_COMMAND_SECRET, every charger behaves as before: a simulated session
 * that advances along the charge curve.
 */

export function csmsConfigured() {
  return Boolean(process.env.OCPP_CSMS_URL && process.env.OCPP_COMMAND_SECRET);
}

/** Should a session on this charger run over OCPP? */
export function runsOverOcpp(charger: { ocppIdentity: string | null; ocppLastSeen: Date | null }) {
  return csmsConfigured() && Boolean(charger.ocppIdentity) && isOcppOnline(charger.ocppLastSeen);
}

export type CommandResult =
  | { ok: true; response: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export async function sendCommand(identity: string, action: string, payload: object = {}): Promise<CommandResult> {
  if (!csmsConfigured()) return { ok: false, status: 503, error: "No CSMS is configured" };
  try {
    const res = await fetch(`${process.env.OCPP_CSMS_URL!.replace(/\/$/, "")}/commands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OCPP_COMMAND_SECRET}`,
      },
      body: JSON.stringify({ identity, action, payload }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as { response?: Record<string, unknown>; error?: string };
    if (!res.ok) return { ok: false, status: res.status, error: body.error ?? `CSMS answered ${res.status}` };
    return { ok: true, response: body.response ?? {} };
  } catch (e) {
    return { ok: false, status: 503, error: `Could not reach the CSMS: ${(e as Error).message}` };
  }
}

/** Is the CSMS process up? For the admin console. */
export async function csmsHealth(): Promise<{ reachable: boolean; connected: string[] }> {
  if (!csmsConfigured()) return { reachable: false, connected: [] };
  try {
    const res = await fetch(`${process.env.OCPP_CSMS_URL!.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(3_000),
      cache: "no-store",
    });
    const body = (await res.json()) as { connected?: string[] };
    return { reachable: res.ok, connected: body.connected ?? [] };
  } catch {
    return { reachable: false, connected: [] };
  }
}
