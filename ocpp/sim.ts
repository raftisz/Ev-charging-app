/**
 * A charge point simulator that speaks OCPP 1.6J to the CSMS, standing in
 * for real hardware.
 *
 *   npm run ocpp:sim -- --id VG-01-A1               one charger
 *   npm run ocpp:sim -- --station 1                 every charger at station 1
 *   npm run ocpp:sim -- --id VG-01-A1 --speed 20    20× faster charging
 *
 * Options: --url ws://localhost:9220/ocpp  --kw <rated>  --soc <start %>
 *          --battery <kWh>  --interval <s between meter readings>  --password <basic auth>
 *
 * It boots, sends heartbeats and connector status, and waits. When the app
 * starts a session the CSMS sends RemoteStartTransaction; the simulator
 * authorises the tag, starts a transaction and reports meter readings
 * (energy register, power, state of charge) following the same charge curve
 * as the app's model, until it is told to stop.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { powerAt } from "../src/lib/charge-curve";
import { HEARTBEAT_INTERVAL_S } from "../src/lib/ocpp";
import { CALL, CALLERROR, CALLRESULT, SUBPROTOCOL, call, error, parseFrame, result } from "./protocol";

export type SimOptions = {
  url: string;
  identity: string;
  ratedKw: number;
  /** Battery state of charge when a car plugs in (%). */
  startSoc?: number;
  batteryKwh?: number;
  /** Seconds between MeterValues. */
  intervalS?: number;
  /** Simulated time runs this many times faster than real time. */
  speed?: number;
  password?: string;
  log?: (message: string) => void;
  /** Reconnect after the connection drops. */
  reconnect?: boolean;
};

type Transaction = { id: number; idTag: string; soc: number; timer: NodeJS.Timeout };

export class ChargePointSimulator {
  private socket: WebSocket | null = null;
  private pending = new Map<string, { resolve: (p: Record<string, unknown>) => void; reject: (e: Error) => void }>();
  private heartbeat: NodeJS.Timeout | null = null;
  private stopped = false;
  /** The energy register only ever goes up, across transactions. */
  registerWh = 1_250_000 + Math.floor(Math.random() * 500_000);
  status: "Available" | "Preparing" | "Charging" | "Finishing" | "Unavailable" = "Available";
  transaction: Transaction | null = null;
  readonly options: Required<Omit<SimOptions, "password" | "log">> & Pick<SimOptions, "password" | "log">;

  constructor(options: SimOptions) {
    this.options = {
      startSoc: 20,
      batteryKwh: 64,
      intervalS: 5,
      speed: 1,
      reconnect: true,
      ...options,
    };
  }

  private log(message: string) {
    this.options.log?.(`[${this.options.identity}] ${message}`);
  }

  /** Connect and boot. Resolves once the CSMS has accepted the BootNotification. */
  async connect() {
    const { url, identity, password } = this.options;
    const headers = password
      ? { Authorization: `Basic ${Buffer.from(`${identity}:${password}`).toString("base64")}` }
      : undefined;
    const socket = new WebSocket(`${url.replace(/\/$/, "")}/${encodeURIComponent(identity)}`, SUBPROTOCOL, { headers });
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
      socket.once("unexpected-response", (_req, res) => reject(new Error(`CSMS refused the connection: HTTP ${res.statusCode}`)));
    });
    socket.on("message", (data) => void this.onMessage(data.toString()));
    socket.on("close", () => {
      this.clearTimers();
      for (const p of this.pending.values()) p.reject(new Error("connection closed"));
      this.pending.clear();
      if (!this.stopped && this.options.reconnect) {
        this.log("connection lost, reconnecting in 3 s");
        setTimeout(() => void this.connect().catch((e) => this.log(`reconnect failed: ${e.message}`)), 3000);
      }
    });

    const boot = await this.call("BootNotification", {
      chargePointVendor: "VoltGrid",
      chargePointModel: "SimCharger",
      chargePointSerialNumber: identity,
      firmwareVersion: "sim-1.0",
    });
    if (boot.status !== "Accepted") throw new Error(`Boot was ${boot.status}`);
    const interval = Number(boot.interval) || HEARTBEAT_INTERVAL_S;
    this.heartbeat = setInterval(() => void this.call("Heartbeat", {}).catch(() => {}), interval * 1000);
    await this.sendStatus(this.transaction ? "Charging" : this.status === "Unavailable" ? "Unavailable" : "Available");
    if (this.transaction) this.startMeter();
    this.log(`booted (${this.options.ratedKw} kW), heartbeat every ${interval}s`);
  }

  async close() {
    this.stopped = true;
    this.clearTimers();
    this.socket?.close();
  }

  private clearTimers() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.transaction) clearInterval(this.transaction.timer);
    this.heartbeat = null;
  }

  private send(raw: string) {
    this.socket?.send(raw);
  }

  /** Send a CALL and wait for the CSMS's answer. */
  call(action: string, payload: object) {
    const id = randomUUID();
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send(call(id, action, payload));
    });
  }

  private sendStatus(status: ChargePointSimulator["status"], errorCode = "NoError") {
    this.status = status;
    return this.call("StatusNotification", {
      connectorId: 1,
      errorCode,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  private async onMessage(raw: string) {
    let frame;
    try {
      frame = parseFrame(raw);
    } catch {
      return;
    }
    if (frame.type === CALLRESULT || frame.type === CALLERROR) {
      const waiting = this.pending.get(frame.id);
      this.pending.delete(frame.id);
      if (frame.type === CALLRESULT) waiting?.resolve(frame.payload);
      else waiting?.reject(new Error(`${frame.code}: ${frame.description}`));
      return;
    }
    if (frame.type !== CALL) return;

    const p = frame.payload;
    switch (frame.action) {
      case "RemoteStartTransaction": {
        const ok = !this.transaction && this.status !== "Unavailable" && typeof p.idTag === "string";
        this.send(result(frame.id, { status: ok ? "Accepted" : "Rejected" }));
        if (ok) void this.startTransaction(p.idTag as string).catch((e) => this.log(`start failed: ${e.message}`));
        return;
      }
      case "RemoteStopTransaction": {
        const ok = this.transaction?.id === p.transactionId;
        this.send(result(frame.id, { status: ok ? "Accepted" : "Rejected" }));
        if (ok) void this.stopTransaction("Remote");
        return;
      }
      case "Reset": {
        this.send(result(frame.id, { status: "Accepted" }));
        this.log(`${p.type} reset`);
        if (this.transaction) await this.stopTransaction(p.type === "Hard" ? "HardReset" : "SoftReset");
        this.socket?.close();
        return;
      }
      case "ChangeAvailability": {
        const toAvailable = p.type === "Operative";
        const scheduled = Boolean(this.transaction) && !toAvailable;
        this.send(result(frame.id, { status: scheduled ? "Scheduled" : "Accepted" }));
        if (!scheduled) await this.sendStatus(toAvailable ? "Available" : "Unavailable");
        return;
      }
      case "TriggerMessage": {
        const known = ["StatusNotification", "Heartbeat", "MeterValues", "BootNotification"];
        const ok = known.includes(String(p.requestedMessage));
        this.send(result(frame.id, { status: ok ? "Accepted" : "NotImplemented" }));
        if (p.requestedMessage === "StatusNotification") await this.sendStatus(this.status);
        if (p.requestedMessage === "Heartbeat") await this.call("Heartbeat", {});
        if (p.requestedMessage === "MeterValues") await this.sendMeter();
        return;
      }
      case "UnlockConnector":
        this.send(result(frame.id, { status: "Unlocked" }));
        return;
      default:
        this.send(error(frame.id, "NotImplemented", `${frame.action} is not supported by the simulator`));
    }
  }

  /** The car plugs in: authorise the tag, start the transaction, meter it. */
  private async startTransaction(idTag: string) {
    await this.sendStatus("Preparing");
    const auth = await this.call("Authorize", { idTag });
    if ((auth.idTagInfo as { status?: string })?.status !== "Accepted") {
      this.log(`tag ${idTag} refused`);
      await this.sendStatus("Available");
      return;
    }
    const started = await this.call("StartTransaction", {
      connectorId: 1,
      idTag,
      meterStart: Math.round(this.registerWh),
      timestamp: new Date().toISOString(),
    });
    const id = Number(started.transactionId);
    if ((started.idTagInfo as { status?: string })?.status !== "Accepted" || !id) {
      this.log("transaction refused");
      await this.sendStatus("Available");
      return;
    }
    this.transaction = { id, idTag, soc: this.options.startSoc, timer: setInterval(() => {}, 1 << 30) };
    await this.sendStatus("Charging");
    this.log(`transaction ${id} started at ${this.options.startSoc}%`);
    this.startMeter();
  }

  private startMeter() {
    if (!this.transaction) return;
    clearInterval(this.transaction.timer);
    this.transaction.timer = setInterval(() => void this.tick(), this.options.intervalS * 1000);
  }

  private currentKw() {
    if (!this.transaction) return 0;
    return powerAt(this.options.ratedKw, this.transaction.soc);
  }

  /** Advance the simulated battery by one interval and report it. */
  private async tick() {
    const tx = this.transaction;
    if (!tx) return;
    const hours = (this.options.intervalS * this.options.speed) / 3600;
    const kwh = this.currentKw() * hours;
    tx.soc = Math.min(100, tx.soc + (kwh / this.options.batteryKwh) * 100);
    this.registerWh += kwh * 1000;
    await this.sendMeter().catch(() => {});
    if (tx.soc >= 100) await this.stopTransaction("EVDisconnected");
  }

  private sendMeter() {
    const tx = this.transaction;
    if (!tx) return Promise.resolve({});
    return this.call("MeterValues", {
      connectorId: 1,
      transactionId: tx.id,
      meterValue: [
        {
          timestamp: new Date().toISOString(),
          sampledValue: [
            { measurand: "Energy.Active.Import.Register", unit: "Wh", value: String(Math.round(this.registerWh)), context: "Sample.Periodic" },
            { measurand: "Power.Active.Import", unit: "W", value: String(Math.round(this.currentKw() * 1000)), context: "Sample.Periodic" },
            { measurand: "SoC", unit: "Percent", value: String(Math.floor(tx.soc)), context: "Sample.Periodic" },
          ],
        },
      ],
    });
  }

  private async stopTransaction(reason: string) {
    const tx = this.transaction;
    if (!tx) return;
    clearInterval(tx.timer);
    this.transaction = null;
    await this.sendStatus("Finishing");
    await this.call("StopTransaction", {
      transactionId: tx.id,
      idTag: tx.idTag,
      meterStop: Math.round(this.registerWh),
      timestamp: new Date().toISOString(),
      reason,
    });
    this.log(`transaction ${tx.id} stopped at ${Math.floor(tx.soc)}% (${reason})`);
    await this.sendStatus("Available");
  }
}

// ---- CLI ----

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = arg("url") ?? process.env.OCPP_SIM_URL ?? "ws://localhost:9220/ocpp";
  const httpBase = url.replace(/^ws/, "http").replace(/\/ocpp\/?$/, "");
  const id = arg("id");
  const station = arg("station");
  if (!id && !station) {
    console.log("Usage: npm run ocpp:sim -- --id VG-01-A1 | --station 1  [--speed 10] [--url ws://host:9220/ocpp]");
    process.exit(1);
  }

  // A real charger knows its own rating. The simulator asks the CSMS, unless --kw is given.
  let chargers: { identity: string; powerKw: number }[];
  if (id && arg("kw")) chargers = [{ identity: id, powerKw: Number(arg("kw")) }];
  else {
    const query = id ? `identity=${encodeURIComponent(id)}` : `station=${station}`;
    const res = await fetch(`${httpBase}/simulator/chargers?${query}`).catch(() => null);
    if (!res?.ok) throw new Error(`Could not reach the CSMS at ${httpBase}. Is it running (npm run ocpp:csms)?`);
    chargers = ((await res.json()) as { chargers: typeof chargers }).chargers;
    if (!chargers.length) throw new Error(`No charger matches ${id ?? `station ${station}`}`);
  }

  const sims = chargers.map(
    (c) =>
      new ChargePointSimulator({
        url,
        identity: c.identity,
        ratedKw: c.powerKw,
        startSoc: Number(arg("soc") ?? 20),
        batteryKwh: Number(arg("battery") ?? 64),
        intervalS: Number(arg("interval") ?? 5),
        speed: Number(arg("speed") ?? 1),
        password: arg("password") ?? process.env.OCPP_CHARGER_PASSWORD,
        log: (m) => console.log(m),
      }),
  );
  for (const sim of sims) await sim.connect();
  console.log(`\n${sims.length} charge point(s) online. Start a session on one in the app; Ctrl+C to stop.`);
  process.on("SIGINT", () => void Promise.all(sims.map((s) => s.close())).then(() => process.exit(0)));
}

if (process.argv[1] && /sim\.(ts|js|mjs)$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
