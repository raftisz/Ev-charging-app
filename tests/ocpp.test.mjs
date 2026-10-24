// OCPP 1.6J against the running app and CSMS. Plays a charge point over a
// raw WebSocket, so every frame is checked, then runs the simulator once.
//
//   npm run seed
//   npm run dev:utc            (with OCPP_CSMS_URL and OCPP_COMMAND_SECRET set)
//   npm run ocpp:csms
//   npm run test:ocpp
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const APP = "http://localhost:3000";
const CSMS = process.env.OCPP_TEST_CSMS ?? "http://localhost:9220";
const WS = CSMS.replace(/^http/, "ws") + "/ocpp";
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};
const section = (t) => console.log(`\n=== ${t} ===`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A tiny HTTP client with a cookie jar per name. */
const jars = new Map();
async function req(who, method, path, body) {
  const jar = jars.get(who) ?? new Map();
  jars.set(who, jar);
  const res = await fetch(APP + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

/**
 * A charge point under test control. CALLs from the CSMS are answered by
 * `answers[action]` (a payload or a function of the request) and recorded.
 */
class TestChargePoint {
  constructor(identity) {
    this.identity = identity;
    this.pending = new Map();
    this.received = [];
    this.waiters = [];
    this.answers = {};
  }
  open(protocols = ["ocpp1.6"]) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS}/${this.identity}`, protocols);
      this.ws.once("open", () => resolve(this));
      this.ws.once("unexpected-response", (_q, res) => reject(Object.assign(new Error("refused"), { status: res.statusCode })));
      this.ws.once("error", reject);
      this.ws.on("message", (d) => this.onMessage(d.toString()));
    });
  }
  onMessage(raw) {
    const msg = JSON.parse(raw);
    if (msg[0] === 2) {
      this.received.push({ action: msg[2], payload: msg[3] });
      const answer = this.answers[msg[2]];
      const payload = typeof answer === "function" ? answer(msg[3]) : answer ?? { status: "Accepted" };
      this.ws.send(JSON.stringify([3, msg[1], payload]));
      for (const w of [...this.waiters]) if (w.action === msg[2]) { w.resolve(msg[3]); this.waiters.splice(this.waiters.indexOf(w), 1); }
      return;
    }
    const p = this.pending.get(msg[1]);
    if (p) { this.pending.delete(msg[1]); p(msg); }
  }
  /** Send a raw string, resolve with the CSMS's reply frame. */
  raw(text, id) {
    return new Promise((resolve) => { this.pending.set(id, resolve); this.ws.send(text); });
  }
  async call(action, payload) {
    const id = randomUUID();
    return this.raw(JSON.stringify([2, id, action, payload]), id);
  }
  waitFor(action, ms = 8000) {
    const seen = this.received.find((r) => r.action === action && !r.taken);
    if (seen) { seen.taken = true; return Promise.resolve(seen.payload); }
    return new Promise((resolve, reject) => {
      const w = { action, resolve: (p) => { const r = this.received.find((x) => x.payload === p); if (r) r.taken = true; resolve(p); } };
      this.waiters.push(w);
      setTimeout(() => reject(new Error(`no ${action} within ${ms} ms`)), ms);
    });
  }
  close() { this.ws?.close(); }
}

const now = () => new Date().toISOString();
const meter = (txId, wh, w, soc, unit = "Wh") => ({
  connectorId: 1,
  transactionId: txId,
  meterValue: [{ timestamp: now(), sampledValue: [
    { measurand: "Energy.Active.Import.Register", unit, value: String(unit === "kWh" ? wh / 1000 : wh) },
    { measurand: "Power.Active.Import", unit: "W", value: String(w) },
    { measurand: "SoC", unit: "Percent", value: String(soc) },
  ] }],
});

async function run() {
  const health = await fetch(CSMS + "/health").then((r) => r.json()).catch(() => null);
  if (!health?.ok) { console.log(`CSMS not running at ${CSMS} (npm run ocpp:csms)`); process.exit(1); }

  // Free chargers, away from the stations the other suites use.
  await req("admin", "POST", "/api/auth/demo", { as: "admin" });
  const { data: chargerList } = await req("admin", "GET", "/api/chargers?status=AVAILABLE");
  const free = chargerList.chargers.filter((c) => c.station.id >= 10 && c.ocppIdentity && !c.ocppOnline);
  const [A, B, C] = free;
  check("found free chargers to test with", Boolean(A && B && C), String(free.length));

  section("Handshake");
  let refused = await new TestChargePoint(A.ocppIdentity).open([]).then(() => 0, (e) => e.status);
  check("no ocpp1.6 subprotocol is refused", refused === 400, String(refused));
  refused = await new TestChargePoint("NOT-A-CHARGER").open().then(() => 0, (e) => e.status);
  check("unknown identity is refused", refused === 404, String(refused));
  const cp = await new TestChargePoint(A.ocppIdentity).open();
  check("charge point connects with ocpp1.6", cp.ws.protocol === "ocpp1.6", cp.ws.protocol);

  section("Core messages");
  let r = await cp.call("BootNotification", { chargePointVendor: "TestCo", chargePointModel: "T1", firmwareVersion: "9.9" });
  check("BootNotification accepted with heartbeat interval", r[0] === 3 && r[2].status === "Accepted" && r[2].interval === 30 && !Number.isNaN(Date.parse(r[2].currentTime)), JSON.stringify(r));
  r = await cp.call("Heartbeat", {});
  check("Heartbeat returns the time", r[0] === 3 && typeof r[2].currentTime === "string");
  r = await cp.call("StatusNotification", { connectorId: 1, errorCode: "NoError", status: "Available" });
  check("StatusNotification answered", r[0] === 3);
  r = await req("driver", "POST", "/api/auth/login", { email: "user6@example.com", password: "password123" });
  const st = await req("driver", "GET", `/api/stations/${A.station.id}`);
  check("app shows the charger online", st.data.station.chargers.find((c) => c.id === A.id)?.ocppOnline === true);

  section("Protocol errors");
  r = await cp.raw("not json", "-1");
  check("bad JSON → FormationViolation", r[0] === 4 && r[2] === "FormationViolation", JSON.stringify(r));
  r = await cp.raw(JSON.stringify([2, "x1", "Heartbeat"]), "x1");
  check("short CALL → FormationViolation", r[0] === 4 && r[2] === "FormationViolation", JSON.stringify(r));
  r = await cp.call("FirmwareStatusNotification", { status: "Idle" });
  check("unsupported action → NotImplemented", r[0] === 4 && r[2] === "NotImplemented", JSON.stringify(r));
  r = await cp.call("BootNotification", { chargePointModel: "T1" });
  check("missing field → OccurenceConstraintViolation", r[0] === 4 && r[2] === "OccurenceConstraintViolation", JSON.stringify(r));
  r = await cp.call("StatusNotification", { connectorId: "one", errorCode: "NoError", status: "Available" });
  check("wrong type → TypeConstraintViolation", r[0] === 4 && r[2] === "TypeConstraintViolation", JSON.stringify(r));
  r = await cp.call("StatusNotification", { connectorId: 1, errorCode: "NoError", status: "Sleeping" });
  check("bad enum → PropertyConstraintViolation", r[0] === 4 && r[2] === "PropertyConstraintViolation", JSON.stringify(r));
  r = await cp.call("Authorize", { idTag: "STRANGER" });
  check("unknown tag is Invalid", r[2].idTagInfo?.status === "Invalid");
  r = await cp.call("StartTransaction", { connectorId: 1, idTag: "VGS999999", meterStart: 0, timestamp: now() });
  check("transaction with a foreign tag is refused", r[2].transactionId === 0 && r[2].idTagInfo.status === "Invalid", JSON.stringify(r[2]));
  r = await cp.call("DataTransfer", { vendorId: "acme" });
  check("DataTransfer from an unknown vendor", r[2].status === "UnknownVendorId");

  section("Session over OCPP");
  const startP = req("driver", "POST", "/api/charging-sessions", { stationId: A.station.id, chargerId: A.id, startPercent: 20, targetPercent: 80 });
  const remoteStart = await cp.waitFor("RemoteStartTransaction");
  const started = await startP;
  check("starting in the app sends RemoteStartTransaction", /^VGS\d+$/.test(remoteStart.idTag) && remoteStart.connectorId === 1, JSON.stringify(remoteStart));
  check("session waits for the charger", started.status === 201 && started.data.session.ocpp?.state === "waiting", JSON.stringify(started.data).slice(0, 200));
  const sessionId = started.data.session.id;
  const price = started.data.session.pricePerKwh;
  check("the tag names the session", remoteStart.idTag === `VGS${sessionId}`);

  r = await cp.call("Authorize", { idTag: remoteStart.idTag });
  check("the issued tag is Accepted", r[2].idTagInfo.status === "Accepted");
  const register = 4_200_000;
  r = await cp.call("StartTransaction", { connectorId: 1, idTag: remoteStart.idTag, meterStart: register, timestamp: now() });
  const txId = r[2].transactionId;
  check("StartTransaction gets the session as its transaction", txId === sessionId && r[2].idTagInfo.status === "Accepted", JSON.stringify(r[2]));
  r = await cp.call("StartTransaction", { connectorId: 1, idTag: remoteStart.idTag, meterStart: register, timestamp: now() });
  check("the same tag can't start twice", r[2].transactionId === 0);
  await cp.call("StatusNotification", { connectorId: 1, errorCode: "NoError", status: "Charging" });

  await cp.call("MeterValues", meter(txId, register + 5000, 50_000, 30));
  let live = await req("driver", "GET", "/api/live?scope=driver&once=1");
  let s = live.data.session;
  check("live figures come from the meter", s.ocpp.state === "charging" && s.energyKwh === 5 && s.currentKw === 50 && s.currentPercent === 30, JSON.stringify({ e: s.energyKwh, kw: s.currentKw, soc: s.currentPercent }));
  check("cost is metered energy × price", Math.abs(s.cost - 5 * price) < 0.01, `${s.cost} vs ${5 * price}`);
  await cp.call("MeterValues", meter(txId, register + 6000, 40_000, 32, "kWh"));
  live = await req("driver", "GET", "/api/live?scope=driver&once=1");
  s = live.data.session;
  check("kWh registers are read too", s.energyKwh === 6 && s.currentKw === 40, `${s.energyKwh} ${s.currentKw}`);
  check("readings build the chart trace", s.ocpp.trace.length === 2 && s.ocpp.trace[1].kw === 40);
  // "Available" from the hardware doesn't free a charger that's mid-session.
  await cp.call("StatusNotification", { connectorId: 1, errorCode: "NoError", status: "Available" });
  const chargerNow = (await req("admin", "GET", `/api/chargers?stationId=${A.station.id}`)).data.chargers.find((c) => c.id === A.id);
  check("charger stays in use during the session", chargerNow.status === "CHARGING", chargerNow.status);
  const adminLive = await req("admin", "GET", "/api/live?scope=network&once=1");
  check("network view includes the metered session", adminLive.data.sessions.some((x) => x.id === sessionId && x.currentKw === 40));

  cp.answers.RemoteStopTransaction = (p) => {
    setTimeout(() => void cp.call("StopTransaction", { transactionId: p.transactionId, meterStop: register + 7500, timestamp: now(), reason: "Remote" }), 50);
    return { status: "Accepted" };
  };
  const stopped = await req("driver", "PATCH", `/api/charging-sessions/${sessionId}`, { action: "stop" });
  const remoteStop = cp.received.find((x) => x.action === "RemoteStopTransaction");
  if (remoteStop) remoteStop.taken = true;
  check("stopping in the app sends RemoteStopTransaction", remoteStop?.payload.transactionId === txId);
  check("session is billed from meterStop", stopped.status === 200 && stopped.data.session.status === "COMPLETED" && stopped.data.session.energyKwh === 7.5, JSON.stringify(stopped.data).slice(0, 200));
  check("cost = 7.5 kWh × price", Math.abs(stopped.data.session.cost - Math.round(7.5 * price * 100) / 100) < 0.001, String(stopped.data.session.cost));
  r = await req("driver", "PATCH", `/api/charging-sessions/${sessionId}`, { action: "pay", paymentMethod: "CREDIT_CARD" });
  check("metered session can be paid", r.status === 200 && r.data.session.paymentStatus === "PAID", String(r.status));

  section("Stopping at the target");
  delete cp.answers.RemoteStopTransaction;
  const start2P = req("driver", "POST", "/api/charging-sessions", { stationId: A.station.id, chargerId: A.id, startPercent: 20, targetPercent: 40 });
  const rs2 = await cp.waitFor("RemoteStartTransaction");
  const s2 = (await start2P).data.session;
  r = await cp.call("StartTransaction", { connectorId: 1, idTag: rs2.idTag, meterStart: register + 7500, timestamp: now() });
  const tx2 = r[2].transactionId;
  await cp.call("MeterValues", meter(tx2, register + 10_000, 60_000, 35));
  check("no stop before the target", !cp.received.some((x) => x.action === "RemoteStopTransaction" && x.payload.transactionId === tx2));
  await cp.call("MeterValues", meter(tx2, register + 20_000, 60_000, 40));
  const autoStop = await cp.waitFor("RemoteStopTransaction").catch(() => null);
  check("CSMS stops the charger at the driver's target", autoStop?.transactionId === tx2, JSON.stringify(autoStop));
  r = await cp.call("StopTransaction", { transactionId: tx2, meterStop: register + 20_500, timestamp: now(), reason: "Remote" });
  check("StopTransaction accepted", r[2].idTagInfo?.status === "Accepted");
  const done = (await req("driver", "GET", `/api/charging-sessions/${s2.id}`)).data.session;
  check("session closed at the target", done.status === "COMPLETED" && done.currentPercent === 40 && done.energyKwh === 13, JSON.stringify({ st: done.status, p: done.currentPercent, e: done.energyKwh }));
  await req("driver", "PATCH", `/api/charging-sessions/${s2.id}`, { action: "pay", paymentMethod: "CREDIT_CARD" });

  section("Charger refuses");
  cp.answers.RemoteStartTransaction = { status: "Rejected" };
  r = await req("driver", "POST", "/api/charging-sessions", { stationId: A.station.id, chargerId: A.id, startPercent: 20, targetPercent: 80 });
  check("a rejected start is a 409", r.status === 409, `${r.status} ${r.data?.error}`);
  live = await req("driver", "GET", "/api/live?scope=driver&once=1");
  check("and leaves no session behind", live.data.session === null);
  const after = (await req("admin", "GET", `/api/chargers?stationId=${A.station.id}`)).data.chargers.find((c) => c.id === A.id);
  check("and frees the charger", after.status === "AVAILABLE", after.status);
  delete cp.answers.RemoteStartTransaction;

  section("Console & commands");
  r = await fetch(CSMS + "/commands", { method: "POST", body: JSON.stringify({ identity: A.ocppIdentity, action: "Reset", payload: { type: "Soft" } }) });
  check("CSMS commands need the secret", r.status === 401, String(r.status));
  r = await fetch(CSMS + "/commands", { method: "POST", headers: { Authorization: "Bearer wrong" }, body: "{}" });
  check("and a wrong secret is refused", r.status === 401, String(r.status));
  const con = await req("admin", "GET", `/api/admin/ocpp?identity=${A.ocppIdentity}`);
  const point = con.data.chargePoints?.find((c) => c.identity === A.ocppIdentity);
  check("console lists the charge point online", con.status === 200 && con.data.reachable && point?.online && point.vendor === "TestCo", JSON.stringify(point).slice(0, 160));
  check("console log has both directions", con.data.frames.some((f) => f.direction === "in" && f.action === "BootNotification") && con.data.frames.some((f) => f.direction === "out" && f.action === "RemoteStartTransaction"));
  check("results are labelled with their action", con.data.frames.some((f) => f.messageType === 3 && f.action === "MeterValues"));
  r = await req("driver", "GET", "/api/admin/ocpp");
  check("drivers can't open the console", r.status === 403);
  await req("operator", "POST", "/api/auth/demo", { as: "operator" });
  r = await req("operator", "POST", "/api/admin/ocpp/commands", { chargerId: A.id, command: "reset-soft" });
  check("operators can't send commands", r.status === 403, String(r.status));
  r = await req("admin", "POST", "/api/admin/ocpp/commands", { chargerId: A.id, command: "trigger-status" });
  const trig = cp.received.find((x) => x.action === "TriggerMessage");
  check("admin command reaches the charger", r.status === 200 && r.data.response.status === "Accepted" && trig?.payload.requestedMessage === "StatusNotification", JSON.stringify(r.data));
  r = await req("admin", "POST", "/api/admin/ocpp/commands", { chargerId: A.id, command: "explode" });
  check("unknown commands are rejected", r.status === 422 || r.status === 400, String(r.status));
  r = await req("admin", "POST", "/api/admin/ocpp/commands", { chargerId: B.id, command: "reset-soft" });
  check("offline chargers can't be commanded", r.status === 409, String(r.status));

  section("Disconnect");
  cp.close();
  await sleep(500);
  const gone = await req("driver", "GET", `/api/stations/${A.station.id}`);
  check("charger is offline once its socket closes", gone.data.station.chargers.find((c) => c.id === A.id)?.ocppOnline === false);

  section("Simulator end to end");
  await req("sim-driver", "POST", "/api/auth/login", { email: "user7@example.com", password: "password123" });
  const sim = spawn("npx", ["tsx", "ocpp/sim.ts", "--id", C.ocppIdentity, "--url", WS, "--speed", "900", "--interval", "1", "--soc", "30"], { stdio: ["ignore", "pipe", "pipe"] });
  let simLog = "";
  sim.stdout.on("data", (d) => (simLog += d));
  sim.stderr.on("data", (d) => (simLog += d));
  for (let i = 0; i < 40 && !simLog.includes("online"); i++) await sleep(250);
  check("simulator boots", simLog.includes("booted"), simLog);
  r = await req("sim-driver", "POST", "/api/charging-sessions", { stationId: C.station.id, chargerId: C.id, startPercent: 30, targetPercent: 50 });
  check("session starts on the simulator", r.status === 201, `${r.status} ${r.data?.error}`);
  const simSession = r.data.session?.id;
  let final = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    final = (await req("sim-driver", "GET", `/api/charging-sessions/${simSession}`)).data.session;
    if (final.status !== "ACTIVE") break;
  }
  check("simulator charges to the target and stops", final?.status === "COMPLETED" && final.currentPercent >= 50 && final.energyKwh > 0, JSON.stringify({ st: final?.status, p: final?.currentPercent, e: final?.energyKwh }));
  check("simulator log shows the transaction", /transaction \d+ started/.test(simLog) && /stopped at \d+% \(Remote\)/.test(simLog), simLog.slice(-300));
  sim.kill("SIGINT");
  await req("sim-driver", "PATCH", `/api/charging-sessions/${simSession}`, { action: "pay", paymentMethod: "CREDIT_CARD" });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
