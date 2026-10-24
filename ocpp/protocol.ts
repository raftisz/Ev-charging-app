/**
 * OCPP-J 1.6 framing. Every WebSocket message is a JSON array:
 *
 *   [2, "<id>", "<Action>", {payload}]                 CALL        request
 *   [3, "<id>", {payload}]                             CALLRESULT  its answer
 *   [4, "<id>", "<ErrorCode>", "<description>", {}]    CALLERROR   its failure
 *
 * Either side may send a CALL; the other answers with the same id.
 */
import { z } from "zod";

export const SUBPROTOCOL = "ocpp1.6";

export const CALL = 2;
export const CALLRESULT = 3;
export const CALLERROR = 4;

export type ErrorCode =
  | "NotImplemented"
  | "NotSupported"
  | "InternalError"
  | "ProtocolError"
  | "SecurityError"
  | "FormationViolation"
  | "PropertyConstraintViolation"
  | "OccurenceConstraintViolation"
  | "TypeConstraintViolation"
  | "GenericError";

/** Thrown by a handler to answer with a CALLERROR. */
export class OcppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export type Call = { type: typeof CALL; id: string; action: string; payload: Record<string, unknown> };
export type CallResult = { type: typeof CALLRESULT; id: string; payload: Record<string, unknown> };
export type CallError = {
  type: typeof CALLERROR;
  id: string;
  code: string;
  description: string;
  details: Record<string, unknown>;
};
export type Frame = Call | CallResult | CallError;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Parse one message. Throws OcppError("FormationViolation") for anything
 * that is not a well-formed frame; `id` is returned on the error when it
 * could be read, so the caller can still answer it.
 */
export function parseFrame(raw: string): Frame {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new OcppError("FormationViolation", "Message is not valid JSON");
  }
  if (!Array.isArray(data) || typeof data[1] !== "string") {
    throw new OcppError("FormationViolation", "Message must be [type, id, ...]");
  }
  const [type, id] = data as [unknown, string];
  if (type === CALL && data.length === 4 && typeof data[2] === "string" && isObject(data[3])) {
    return { type: CALL, id, action: data[2], payload: data[3] };
  }
  if (type === CALLRESULT && data.length === 3 && isObject(data[2])) {
    return { type: CALLRESULT, id, payload: data[2] };
  }
  if (type === CALLERROR && data.length >= 4 && typeof data[2] === "string") {
    return {
      type: CALLERROR,
      id,
      code: data[2],
      description: typeof data[3] === "string" ? data[3] : "",
      details: isObject(data[4]) ? data[4] : {},
    };
  }
  throw Object.assign(new OcppError("FormationViolation", "Unrecognised message"), { id });
}

export const call = (id: string, action: string, payload: object) => JSON.stringify([CALL, id, action, payload]);
export const result = (id: string, payload: object) => JSON.stringify([CALLRESULT, id, payload]);
export const error = (id: string, code: ErrorCode, description: string, details: object = {}) =>
  JSON.stringify([CALLERROR, id, code, description, details]);

/** Validate a payload; a failure becomes the CALLERROR OCPP prescribes. */
export function parsePayload<T extends z.ZodType>(schema: T, payload: unknown): z.infer<T> {
  const parsed = schema.safeParse(payload);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const where = issue.path.join(".") || "payload";
  const value = issue.path.reduce<unknown>(
    (v, key) => (v && typeof v === "object" ? (v as Record<PropertyKey, unknown>)[key] : undefined),
    payload,
  );
  const code: ErrorCode =
    issue.code === "invalid_type" && value === undefined
      ? "OccurenceConstraintViolation"
      : issue.code === "invalid_type"
        ? "TypeConstraintViolation"
        : "PropertyConstraintViolation";
  throw new OcppError(code, `${where}: ${issue.message}`);
}

// ---- Payloads the charge point sends (OCPP 1.6 §4) ----

const dateTime = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "must be an ISO 8601 date-time");
const idTag = z.string().max(20);

export const BootNotification = z.object({
  chargePointVendor: z.string().max(20),
  chargePointModel: z.string().max(20),
  chargePointSerialNumber: z.string().max(25).optional(),
  firmwareVersion: z.string().max(50).optional(),
});

export const Heartbeat = z.object({});

export const CHARGE_POINT_STATUS = [
  "Available",
  "Preparing",
  "Charging",
  "SuspendedEVSE",
  "SuspendedEV",
  "Finishing",
  "Reserved",
  "Unavailable",
  "Faulted",
] as const;
export type ChargePointStatus = (typeof CHARGE_POINT_STATUS)[number];

export const StatusNotification = z.object({
  connectorId: z.number().int().min(0),
  errorCode: z.string(),
  status: z.enum(CHARGE_POINT_STATUS),
  info: z.string().max(50).optional(),
  timestamp: dateTime.optional(),
});

export const Authorize = z.object({ idTag });

export const StartTransaction = z.object({
  connectorId: z.number().int().min(1),
  idTag,
  meterStart: z.number().int(),
  timestamp: dateTime,
  reservationId: z.number().int().optional(),
});

const SampledValue = z.object({
  value: z.string(),
  context: z.string().optional(),
  format: z.string().optional(),
  measurand: z.string().optional(),
  phase: z.string().optional(),
  location: z.string().optional(),
  unit: z.string().optional(),
});
const MeterValue = z.object({ timestamp: dateTime, sampledValue: z.array(SampledValue).min(1) });

export const MeterValues = z.object({
  connectorId: z.number().int().min(0),
  transactionId: z.number().int().optional(),
  meterValue: z.array(MeterValue).min(1),
});

export const StopTransaction = z.object({
  transactionId: z.number().int(),
  meterStop: z.number().int(),
  timestamp: dateTime,
  idTag: idTag.optional(),
  reason: z.string().optional(),
  transactionData: z.array(MeterValue).optional(),
});

export const DataTransfer = z.object({
  vendorId: z.string().max(255),
  messageId: z.string().max(50).optional(),
  data: z.string().optional(),
});

/**
 * Read energy (Wh), power (kW) and state of charge (%) out of a MeterValue.
 * A sampled value with no measurand is the energy register, per the spec.
 */
export function readMeterValue(meterValue: z.infer<typeof MeterValue>) {
  const out: { wh?: number; kw?: number; soc?: number; at: Date } = { at: new Date(meterValue.timestamp) };
  for (const s of meterValue.sampledValue) {
    const value = Number(s.value);
    if (!Number.isFinite(value)) continue;
    const measurand = s.measurand ?? "Energy.Active.Import.Register";
    if (measurand === "Energy.Active.Import.Register") out.wh = s.unit === "kWh" ? value * 1000 : value;
    else if (measurand === "Power.Active.Import") out.kw = s.unit === "kW" ? value : value / 1000;
    else if (measurand === "SoC") out.soc = value;
  }
  return out;
}

/** Commands the CSMS may send a charge point on the app's behalf. */
export const COMMANDS = [
  "RemoteStartTransaction",
  "RemoteStopTransaction",
  "Reset",
  "ChangeAvailability",
  "TriggerMessage",
  "UnlockConnector",
] as const;
export type Command = (typeof COMMANDS)[number];
