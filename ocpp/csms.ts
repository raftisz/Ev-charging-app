/**
 * Volt Grid CSMS: the OCPP 1.6J central system chargers connect to.
 *
 *   ws://<host>:<port>/ocpp/<identity>   charge points (subprotocol "ocpp1.6")
 *   POST /commands                       the app sends a command to a charger
 *   GET  /health                         connected charge points
 *   GET  /simulator/chargers?station=1   ratings for the simulator (see sim.ts)
 *
 * It shares the app's Postgres database: a BootNotification updates the
 * charger row, StartTransaction/MeterValues/StopTransaction drive the
 * driver's ChargingSession, and every frame is written to OcppMessage for
 * the admin console. Run it with `npm run ocpp:csms`. It is a long-lived
 * process, so it needs a host that keeps WebSockets open (Render, Railway,
 * Fly), not a serverless function.
 */
import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseDatabaseUrl, requireDatabaseUrl } from "../src/server/env";
import { handleCall, type ChargePoint } from "./handlers";
import {
  CALL,
  CALLERROR,
  CALLRESULT,
  COMMANDS,
  OcppError,
  SUBPROTOCOL,
  call as callFrame,
  error as errorFrame,
  parseFrame,
  result as resultFrame,
  type Command,
} from "./protocol";

export type CsmsOptions = {
  port?: number;
  /** Bearer token the app must send to POST /commands. */
  commandSecret?: string;
  /** If set, charge points must send HTTP Basic auth <identity>:<password> (OCPP security profile 1). */
  chargerPassword?: string;
  /** How long to wait for a charge point to answer a command. */
  callTimeoutMs?: number;
  quiet?: boolean;
};

type Pending = { resolve: (p: Record<string, unknown>) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };

type Connection = {
  socket: WebSocket;
  chargePoint: ChargePoint;
  pending: Map<string, Pending>;
  /** Incoming CALLs are handled one at a time, in order. */
  queue: Promise<void>;
  alive: boolean;
};

class CommandError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Keep the message log to roughly this many rows. */
const LOG_KEEP = 5000;

export function createDb() {
  const { connectionString, schema } = parseDatabaseUrl(requireDatabaseUrl());
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }, schema ? { schema } : undefined) });
}

export function startCsms(options: CsmsOptions = {}) {
  const port = options.port ?? Number(process.env.OCPP_PORT ?? process.env.PORT ?? 9220);
  const commandSecret = options.commandSecret ?? process.env.OCPP_COMMAND_SECRET ?? "";
  const chargerPassword = options.chargerPassword ?? process.env.OCPP_CHARGER_PASSWORD ?? "";
  const callTimeoutMs = options.callTimeoutMs ?? 10_000;
  const log = options.quiet ? () => {} : (msg: string) => console.log(`[csms] ${msg}`);

  const db = createDb();
  const connections = new Map<string, Connection>();
  let logged = 0;

  function record(identity: string, direction: "in" | "out", raw: string) {
    let frame: unknown[];
    try {
      frame = JSON.parse(raw);
    } catch {
      frame = [0, "", raw];
    }
    const type = Number(frame[0]) || 0;
    const action = type === CALL ? String(frame[2]) : type === CALLERROR ? String(frame[2]) : null;
    const payload = (type === CALL ? frame[3] : type === CALLRESULT ? frame[2] : frame.slice(2)) ?? {};
    void db.ocppMessage
      .create({
        data: {
          identity,
          direction,
          messageType: type,
          messageId: String(frame[1] ?? ""),
          action,
          payload: payload as object,
        },
      })
      .then(async () => {
        if (++logged % 250 === 0) {
          const cutoff = await db.ocppMessage.findFirst({ orderBy: { id: "desc" }, skip: LOG_KEEP, select: { id: true } });
          if (cutoff) await db.ocppMessage.deleteMany({ where: { id: { lte: cutoff.id } } });
        }
      })
      .catch((e) => log(`could not log a frame: ${e.message}`));
  }

  function sendRaw(conn: Connection, raw: string) {
    record(conn.chargePoint.identity, "out", raw);
    conn.socket.send(raw);
  }

  /** Send a CALL to a charge point and wait for its CALLRESULT. */
  function callChargePoint(identity: string, action: string, payload: object) {
    const conn = connections.get(identity);
    if (!conn) return Promise.reject(new CommandError(404, `${identity} is not connected`));
    const id = randomUUID();
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        conn.pending.delete(id);
        reject(new CommandError(504, `${identity} did not answer ${action} in time`));
      }, callTimeoutMs);
      conn.pending.set(id, { resolve, reject, timer });
      sendRaw(conn, callFrame(id, action, payload));
    });
  }

  async function onMessage(conn: Connection, raw: string) {
    record(conn.chargePoint.identity, "in", raw);
    await db.charger
      .update({ where: { id: conn.chargePoint.id }, data: { ocppLastSeen: new Date() } })
      .catch(() => {});

    let frame;
    try {
      frame = parseFrame(raw);
    } catch (e) {
      const id = (e as { id?: string }).id ?? "-1";
      const err = e as OcppError;
      sendRaw(conn, errorFrame(id, err.code, err.message));
      return;
    }

    if (frame.type === CALLRESULT || frame.type === CALLERROR) {
      const waiting = conn.pending.get(frame.id);
      if (!waiting) return;
      conn.pending.delete(frame.id);
      clearTimeout(waiting.timer);
      if (frame.type === CALLRESULT) waiting.resolve(frame.payload);
      else waiting.reject(new CommandError(502, `${frame.code}: ${frame.description}`, frame.details));
      return;
    }

    try {
      const response = await handleCall(
        {
          db,
          chargePoint: conn.chargePoint,
          send: (action, payload) => callChargePoint(conn.chargePoint.identity, action, payload),
          log: (m) => log(`${conn.chargePoint.identity}: ${m}`),
        },
        frame.action,
        frame.payload,
      );
      sendRaw(conn, resultFrame(frame.id, response));
    } catch (e) {
      if (e instanceof OcppError) sendRaw(conn, errorFrame(frame.id, e.code, e.message, e.details));
      else {
        log(`${frame.action} from ${conn.chargePoint.identity} failed: ${(e as Error).message}`);
        sendRaw(conn, errorFrame(frame.id, "InternalError", "The CSMS could not process this message"));
      }
    }
  }

  // ---- WebSocket: charge points ----

  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => (protocols.has(SUBPROTOCOL) ? SUBPROTOCOL : false),
  });

  function reject(socket: import("node:stream").Duplex, status: number, text: string) {
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  }

  function safeEqual(a: string, b: string) {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  }

  async function onUpgrade(req: IncomingMessage, socket: import("node:stream").Duplex, head: Buffer) {
    const url = new URL(req.url ?? "/", "http://csms");
    const match = /^\/ocpp\/([A-Za-z0-9._:-]{1,48})$/.exec(url.pathname);
    if (!match) return reject(socket, 404, "Not Found");
    const identity = decodeURIComponent(match[1]);

    const offered = String(req.headers["sec-websocket-protocol"] ?? "")
      .split(",")
      .map((s) => s.trim());
    if (!offered.includes(SUBPROTOCOL)) return reject(socket, 400, "Bad Request");

    if (chargerPassword) {
      const header = req.headers.authorization ?? "";
      const given = header.startsWith("Basic ") ? Buffer.from(header.slice(6), "base64").toString() : "";
      if (!safeEqual(given, `${identity}:${chargerPassword}`)) return reject(socket, 401, "Unauthorized");
    }

    const charger = await db.charger
      .findUnique({ where: { ocppIdentity: identity }, select: { id: true } })
      .catch(() => null);
    if (!charger) return reject(socket, 404, "Not Found");

    wss.handleUpgrade(req, socket, head, (ws) => {
      // A charge point that reconnects replaces its old connection.
      connections.get(identity)?.socket.terminate();
      const conn: Connection = {
        socket: ws,
        chargePoint: { id: charger.id, identity },
        pending: new Map(),
        queue: Promise.resolve(),
        alive: true,
      };
      connections.set(identity, conn);
      log(`${identity} connected`);

      ws.on("pong", () => (conn.alive = true));
      ws.on("message", (data) => {
        const raw = data.toString();
        conn.queue = conn.queue.then(() => onMessage(conn, raw)).catch(() => {});
      });
      ws.on("close", () => {
        for (const p of conn.pending.values()) {
          clearTimeout(p.timer);
          p.reject(new CommandError(502, `${identity} disconnected`));
        }
        if (connections.get(identity) === conn) {
          connections.delete(identity);
          void db.charger.update({ where: { id: charger.id }, data: { ocppLastSeen: null } }).catch(() => {});
        }
        log(`${identity} disconnected`);
      });
    });
  }

  // ---- HTTP: the app's command channel, health ----

  function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  }

  async function readBody(req: IncomingMessage) {
    let text = "";
    for await (const chunk of req) {
      text += chunk;
      if (text.length > 64_000) throw new CommandError(413, "Body too large");
    }
    try {
      return JSON.parse(text || "{}") as Record<string, unknown>;
    } catch {
      throw new CommandError(400, "Body must be JSON");
    }
  }

  async function onRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://csms");
    try {
      if (req.method === "GET" && url.pathname === "/health") {
        return json(res, 200, { ok: true, connected: [...connections.keys()].sort() });
      }

      if (req.method === "GET" && url.pathname === "/simulator/chargers") {
        if (process.env.OCPP_SIMULATOR_CONFIG === "off") throw new CommandError(404, "Not found");
        const station = Number(url.searchParams.get("station"));
        const identity = url.searchParams.get("identity");
        const chargers = await db.charger.findMany({
          where: identity ? { ocppIdentity: identity } : { stationId: Number.isInteger(station) ? station : -1 },
          select: { ocppIdentity: true, powerKw: true },
          orderBy: { chargerCode: "asc" },
        });
        return json(res, 200, { chargers: chargers.map((c) => ({ identity: c.ocppIdentity, powerKw: c.powerKw })) });
      }

      if (req.method === "POST" && url.pathname === "/commands") {
        const auth = req.headers.authorization ?? "";
        if (!commandSecret || !safeEqual(auth, `Bearer ${commandSecret}`)) {
          throw new CommandError(401, "Missing or wrong command secret");
        }
        const body = await readBody(req);
        const identity = String(body.identity ?? "");
        const action = String(body.action ?? "") as Command;
        if (!COMMANDS.includes(action)) throw new CommandError(400, `Unknown command ${action}`);
        const payload = (typeof body.payload === "object" && body.payload) || {};
        const response = await callChargePoint(identity, action, payload);
        return json(res, 200, { response });
      }

      json(res, 404, { error: "Not found" });
    } catch (e) {
      const status = e instanceof CommandError ? e.status : 500;
      json(res, status, { error: (e as Error).message, details: (e as CommandError).details });
    }
  }

  const server = createServer((req, res) => void onRequest(req, res));
  server.on("upgrade", (req, socket, head) => void onUpgrade(req, socket, head));

  // Drop connections that stop answering pings.
  const sweep = setInterval(() => {
    for (const conn of connections.values()) {
      if (!conn.alive) conn.socket.terminate();
      else {
        conn.alive = false;
        conn.socket.ping();
      }
    }
  }, 30_000);

  const ready = new Promise<void>((resolve) => server.listen(port, () => resolve()));
  void ready.then(() => log(`listening on :${port} (ws://localhost:${port}/ocpp/<identity>)`));

  return {
    port,
    ready,
    connections,
    call: callChargePoint,
    async close() {
      clearInterval(sweep);
      for (const conn of connections.values()) conn.socket.terminate();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.$disconnect();
    },
  };
}

// Run directly: `tsx ocpp/csms.ts`.
if (process.argv[1] && /csms\.(ts|js|mjs)$/.test(process.argv[1])) {
  if (!process.env.OCPP_COMMAND_SECRET) {
    console.warn("[csms] OCPP_COMMAND_SECRET is not set: the app will not be able to send commands.");
  }
  const csms = startCsms();
  const stop = () => void csms.close().then(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
