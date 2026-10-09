// Exercises the REST API against a running server. The suite mutates data
// (it stops sessions, cancels reservations, deletes a user), so reseed first:
//   npm run seed && npm run test:api
//
// Start the server in UTC (`npm run dev:utc`), as Vercel runs, so the
// "Time zone" checks prove booking times stay in Bangkok time.
const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const jars = new Map();

function jar(name) {
  if (!jars.has(name)) jars.set(name, new Map());
  return jars.get(name);
}

async function req(who, method, path, body) {
  const cookies = [...jar(who)].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    const k = pair.slice(0, i), v = pair.slice(i + 1);
    if (v === "") jar(who).delete(k); else jar(who).set(k, v);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

const section = (t) => console.log(`\n=== ${t} ===`);

const BKK_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const BKK_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
const bkkTime = (iso) => BKK_TIME.format(new Date(iso));
const bkkDay = (d = new Date()) => BKK_DAY.format(d);
const BAHT = /฿[\d,]+(?:\.\d+)?/g;
const allSatang = (text) => (text.match(BAHT) ?? []).every((m) => /\.\d{2}$/.test(m));
// Independent of src/lib/promptpay.ts so the payload is checked, not echoed.
function crc16ccitt(str) {
  let crc = 0xffff;
  for (const b of Buffer.from(str, "utf8")) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function emvFields(payload) {
  const out = {};
  for (let i = 0; i < payload.length;) {
    const tag = payload.slice(i, i + 2), len = Number(payload.slice(i + 2, i + 4));
    out[tag] = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}
const validPromptPay = (payload, amount) => {
  const f = emvFields(payload);
  return crc16ccitt(payload.slice(0, -4)) === payload.slice(-4) && payload.slice(-8, -4) === "6304"
    && f["54"] === amount.toFixed(2) && f["53"] === "764" && f["58"] === "TH" && f["01"] === "12"
    && emvFields(f["29"])["00"] === "A000000677010111";
};
const isSatang = (n) => typeof n === "number" && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

const run = async () => {
  section("Auth");
  let r = await req("anon", "GET", "/api/auth/me");
  check("me (anon) returns null user", r.status === 200 && r.data.user === null);

  r = await req("anon", "GET", "/api/dashboard");
  check("dashboard requires auth (401)", r.status === 401, JSON.stringify(r.data));

  r = await req("driver", "POST", "/api/auth/login", { email: "user1@example.com", password: "wrong" });
  check("login with bad password → 401", r.status === 401);

  r = await req("driver", "POST", "/api/auth/login", { email: "user1@example.com", password: "password123" });
  check("login as driver", r.status === 200 && r.data.user.email === "user1@example.com", JSON.stringify(r.data));

  const email = `test${Date.now()}@example.com`;
  r = await req("newbie", "POST", "/api/auth/register", { fullName: "Test Driver", email, password: "password123" });
  check("register new account", r.status === 201 && r.data.user.email === email, JSON.stringify(r.data));
  const newUserId = r.data?.user?.id;

  r = await req("newbie", "POST", "/api/auth/register", { fullName: "Dup", email, password: "password123" });
  check("duplicate email → 409", r.status === 409);

  r = await req("newbie", "POST", "/api/auth/register", { fullName: "X", email: "bad", password: "1" });
  check("invalid register → 422 with field details", r.status === 422 && Array.isArray(r.data.details));

  r = await req("admin", "POST", "/api/auth/login", { email: "admin@example.com", password: "password123" });
  check("login as admin", r.status === 200 && r.data.user.role === "ADMIN");

  section("Stations");
  r = await req("driver", "GET", "/api/stations");
  const stations = r.data.stations;
  check("list stations", r.status === 200 && stations.length === 20, `got ${stations?.length}`);
  check("stations sorted by distance", stations[0].distanceKm <= stations[1].distanceKm);
  check("station has derived fields", typeof stations[0].availableCount === "number" && Array.isArray(stations[0].amenities));

  r = await req("driver", "GET", "/api/stations?q=Siam");
  check("search q=Siam", r.status === 200 && r.data.stations.every(s => /siam/i.test(s.name + s.address)) && r.data.stations.length > 0);

  r = await req("driver", "GET", "/api/stations?available=true");
  check("filter available only", r.data.stations.every(s => s.availableCount > 0));

  r = await req("driver", "GET", "/api/stations?minPower=100&sort=price");
  check("filter fast + sort price", r.data.stations.every(s => s.maxPowerKw >= 100) && r.data.stations[0].pricePerKwh <= r.data.stations.at(-1).pricePerKwh);

  r = await req("driver", "GET", "/api/stations/8");
  check("station detail includes chargers", r.status === 200 && r.data.station.chargers.length === 5);
  check("chargers include connectors", r.data.station.chargers[0].connectors.length > 0);

  r = await req("driver", "GET", "/api/stations/9999");
  check("unknown station → 404", r.status === 404);

  section("Favourites");
  r = await req("driver", "POST", "/api/stations/5/favorite");
  check("add favourite", r.status === 200 && r.data.isFavorite === true);
  r = await req("driver", "GET", "/api/favorites");
  check("favourites list contains it", r.data.stations.some(s => s.id === 5));
  r = await req("driver", "DELETE", "/api/stations/5/favorite");
  check("remove favourite", r.status === 200 && r.data.isFavorite === false);
  r = await req("driver", "GET", "/api/favorites");
  check("favourites list no longer contains it", !r.data.stations.some(s => s.id === 5));

  section("Reservations");
  const day = bkkDay(new Date(Date.now() + 26 * 3600_000));
  r = await req("driver", "GET", `/api/stations/4/availability?date=${day}&duration=45`);
  check("availability returns slots per charger", r.status === 200 && r.data.chargers.length > 0 && r.data.chargers[0].slots.length > 0);
  const charger = r.data.chargers.find(c => c.bookable && c.slots.some(s => s.available));
  const slot = charger.slots.find(s => s.available);

  r = await req("driver", "POST", "/api/reservations", { stationId: 4, chargerId: charger.id, startTime: slot.iso, durationMinutes: 45 });
  check("create reservation", r.status === 201 && r.data.reservation.status === "CONFIRMED", JSON.stringify(r.data));
  const reservationId = r.data?.reservation?.id;
  check("booked start equals the chosen slot", r.data.reservation.startTime === new Date(slot.iso).toISOString(), `${slot.time} ${slot.iso} → ${r.data.reservation.startTime}`);
  check("booked start reads as the slot label in Bangkok", bkkTime(r.data.reservation.startTime) === slot.time && bkkDay(new Date(r.data.reservation.startTime)) === day, bkkTime(r.data.reservation.startTime));

  section("Time zone");
  // Slot labels are Bangkok wall-clock times on the requested Bangkok day.
  r = await req("driver", "GET", `/api/stations/4/availability?date=${day}&duration=30`);
  const allSlots = r.data.chargers.flatMap(c => c.slots);
  check("every slot label matches its instant in Bangkok", allSlots.every(x => bkkTime(x.iso) === x.time && bkkDay(new Date(x.iso)) === day), JSON.stringify(allSlots.find(x => bkkTime(x.iso) !== x.time)));
  const s1630 = r.data.chargers[0].slots.find(x => x.time === "16:30");
  check("16:30 slot is 09:30 UTC", s1630?.iso === `${day}T09:30:00.000Z`, s1630?.iso);
  check("08:00 slot is 01:00 UTC", r.data.chargers[0].slots[0].iso === `${day}T01:00:00.000Z`, r.data.chargers[0].slots[0].iso);

  r = await req("driver", "GET", "/api/stations/4/availability?duration=30");
  check("default day is today in Bangkok", r.data.date === bkkDay(), `${r.data.date} vs ${bkkDay()}`);
  const todaySlots = r.data.chargers.find(c => c.bookable)?.slots ?? [];
  const checkedAt = Date.now();
  const pastWrong = todaySlots.filter(x => Math.abs(Date.parse(x.iso) - checkedAt) > 60_000 && (x.reason === "past") !== (Date.parse(x.iso) < checkedAt));
  check("a slot is 'past' only once its Bangkok time has passed", pastWrong.length === 0, JSON.stringify(pastWrong.slice(0, 3)));

  r = await req("driver", "POST", "/api/reservations", { stationId: 4, chargerId: charger.id, startTime: slot.iso, durationMinutes: 45 });
  check("double-booking same slot → 409", r.status === 409, JSON.stringify(r.data));

  r = await req("driver", "POST", "/api/reservations", { stationId: 4, chargerId: charger.id, startTime: "2020-01-01T10:00:00", durationMinutes: 45 });
  check("past reservation rejected", r.status === 400);

  r = await req("driver", "GET", `/api/stations/4/availability?date=${day}&duration=45`);
  const nowBooked = r.data.chargers.find(c => c.id === charger.id).slots.find(s => s.time === slot.time);
  check("slot now shows as booked", nowBooked.available === false && nowBooked.reason === "booked");

  r = await req("driver", "GET", "/api/reservations?scope=upcoming");
  check("upcoming reservations include new one", r.data.reservations.some(x => x.id === reservationId));

  r = await req("newbie", "PATCH", `/api/reservations/${reservationId}`, { status: "CANCELLED" });
  check("other driver cannot cancel → 403", r.status === 403);

  r = await req("driver", "PATCH", `/api/reservations/${reservationId}`, { status: "CANCELLED" });
  check("cancel own reservation", r.status === 200 && r.data.reservation.status === "CANCELLED");

  r = await req("driver", "PATCH", `/api/reservations/${reservationId}`, { status: "CANCELLED" });
  check("cancel twice → 409", r.status === 409);

  section("Charging sessions");
  r = await req("driver", "GET", "/api/charging-sessions?status=ACTIVE");
  const live = r.data.sessions[0];
  check("driver has a seeded live session", r.status === 200 && !!live);
  if (!live) {
    console.log("\n  This suite mutates data — run `npm run seed` before it.");
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(1);
  }
  check("live session projects energy > 0", live.energyKwh > 0 && live.cost > 0);
  check("live session percent within target", live.currentPercent <= live.targetPercent);

  r = await req("driver", "POST", "/api/charging-sessions", { stationId: 1, chargerId: 1, startPercent: 20, targetPercent: 80 });
  check("cannot start a second session → 409", r.status === 409);

  r = await req("driver", "PATCH", `/api/charging-sessions/${live.id}`, { action: "stop" });
  check("stop session", r.status === 200 && r.data.session.status === "COMPLETED", JSON.stringify(r.data).slice(0,200));
  const stopped = r.data.session;

  r = await req("driver", "PATCH", `/api/charging-sessions/${live.id}`, { action: "stop" });
  check("stop twice → 409", r.status === 409);

  r = await req("driver", "GET", "/api/profile");
  const driverId = r.data.user.id;
  const balanceBefore = r.data.user.walletBalance;

  r = await req("admin", "PATCH", `/api/users/${driverId}`, { walletBalance: 0 });
  check("admin empties the driver's wallet", r.status === 200 && r.data.user.walletBalance === 0);
  r = await req("driver", "PATCH", `/api/charging-sessions/${live.id}`, { action: "pay", paymentMethod: "WALLET" });
  check("wallet pay with too little balance → 409", r.status === 409, JSON.stringify(r.data));
  r = await req("driver", "GET", `/api/charging-sessions/${live.id}`);
  check("failed wallet pay leaves session unpaid", r.data.session.paymentStatus !== "PAID");
  r = await req("driver", "GET", "/api/profile");
  check("failed wallet pay leaves balance untouched", r.data.user.walletBalance === 0);
  await req("admin", "PATCH", `/api/users/${driverId}`, { walletBalance: balanceBefore });

  r = await req("driver", "PATCH", `/api/charging-sessions/${live.id}`, { action: "pay", paymentMethod: "BITCOIN" });
  check("unknown payment method → 422", r.status === 422);

  const both = await Promise.all([
    req("driver", "PATCH", `/api/charging-sessions/${live.id}`, { action: "pay", paymentMethod: "WALLET" }),
    req("driver", "PATCH", `/api/charging-sessions/${live.id}`, { action: "pay", paymentMethod: "Volt Grid wallet" }),
  ]);
  const okPays = both.filter(x => x.status === 200);
  check("two concurrent pays: exactly one succeeds", okPays.length === 1 && both.some(x => x.status === 409), both.map(x => x.status).join(","));
  check("pay with wallet marks session PAID", okPays[0]?.data.session.paymentStatus === "PAID" && okPays[0]?.data.session.paymentMethod === "Volt Grid wallet");

  r = await req("driver", "GET", "/api/profile");
  const charged = Math.round(stopped.cost * 100) / 100;
  check("wallet debited exactly once", Math.abs(balanceBefore - charged - r.data.user.walletBalance) < 0.01, `${balanceBefore} - ${charged} → ${r.data.user.walletBalance}`);

  r = await req("driver", "PATCH", `/api/charging-sessions/${live.id}`, { action: "pay", paymentMethod: "CREDIT_CARD" });
  check("paying twice → 409", r.status === 409);

  section("Wallet");
  r = await req("driver", "GET", "/api/wallet");
  const chargeRow = r.data?.transactions?.find(t => t.sessionId === live.id);
  check("wallet lists the charge as a Payment row", r.status === 200 && chargeRow?.type === "CHARGE" && chargeRow?.method === "WALLET" && chargeRow?.status === "PAID", JSON.stringify(chargeRow));
  check("only one Payment row for the session", r.data.transactions.filter(t => t.sessionId === live.id).length === 1);
  check("charge row amount matches the session cost", Math.abs(chargeRow.amount - charged) < 0.01);
  const walletBefore = r.data.balance;

  r = await req("anon", "GET", "/api/wallet");
  check("wallet requires auth (401)", r.status === 401);
  r = await req("driver", "POST", "/api/wallet/topup", { amount: 5, method: "CREDIT_CARD" });
  check("top-up below minimum → 422", r.status === 422);
  r = await req("driver", "POST", "/api/wallet/topup", { amount: 50000, method: "CREDIT_CARD" });
  check("top-up above maximum → 422", r.status === 422);
  r = await req("driver", "POST", "/api/wallet/topup", { amount: 100, method: "WALLET" });
  check("top-up from the wallet itself → 422", r.status === 422);

  r = await req("driver", "POST", "/api/wallet/topup", { amount: 250, method: "PROMPTPAY" });
  check("PromptPay top-up returns a pending payment (202)", r.status === 202 && r.data.payment.type === "TOPUP" && r.data.payment.status === "PENDING", JSON.stringify(r.data).slice(0, 200));
  check("top-up QR is valid EMVCo for ฿250.00", validPromptPay(r.data.promptpay.payload, 250), r.data.promptpay?.payload);
  check("demo recipient when PROMPTPAY_ID is unset", r.data.promptpay.isDemoRecipient === true && r.data.promptpay.recipient.endsWith("0000"));
  check("balance unchanged until confirmed", Math.abs(r.data.balance - walletBefore) < 0.01);
  const topUpPaymentId = r.data.payment.id;
  r = await req("newbie", "POST", `/api/payments/${topUpPaymentId}/confirm`);
  check("another driver cannot confirm it → 404", r.status === 404, String(r.status));
  r = await req("driver", "POST", `/api/payments/${topUpPaymentId}/confirm`);
  check("confirm the PromptPay top-up", r.status === 200 && r.data.payment.status === "PAID" && r.data.payment.providerRef, JSON.stringify(r.data).slice(0, 200));
  check("top-up returns the new balance", Math.abs(r.data.balance - (walletBefore + 250)) < 0.01);
  r = await req("driver", "POST", `/api/payments/${topUpPaymentId}/confirm`);
  check("confirming twice → 409", r.status === 409);
  r = await req("driver", "GET", "/api/wallet");
  check("top-up is the latest transaction", r.data.transactions[0].type === "TOPUP" && r.data.transactions[0].amount === 250);
  r = await req("driver", "GET", "/api/notifications");
  const topUpNote = r.data.notifications.find(n => n.title === "Wallet topped up");
  check("top-up notification shows ฿250.00 and a 2-decimal balance", /^฿250\.00 added .* New balance ฿[\d,]+\.\d{2}\.$/.test(topUpNote?.body ?? ""), topUpNote?.body);
  const paidNote = r.data.notifications.find(n => n.title === "Payment received" && n.body.includes(`session #${live.id}`));
  check("payment notification shows the exact amount", paidNote?.body.startsWith(`฿${charged.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} paid`), paidNote?.body);
  check("notification amounts all have 2 decimals", r.data.notifications.every(n => allSatang(n.body)), JSON.stringify(r.data.notifications.find(n => !allSatang(n.body))?.body));

  r = await req("driver", "GET", "/api/profile");
  check("profile balance includes the top-up", Math.abs(r.data.user.walletBalance - (walletBefore + 250)) < 0.01);

  // start a fresh session now that the old one is closed
  r = await req("driver", "GET", "/api/stations/1");
  const freeCharger = r.data.station.chargers.find(c => c.status === "AVAILABLE");
  r = await req("driver", "POST", "/api/charging-sessions", { stationId: 1, chargerId: freeCharger.id, startPercent: 30, targetPercent: 80 });
  check("start a new session", r.status === 201 && r.data.session.status === "ACTIVE", JSON.stringify(r.data).slice(0,200));
  const newSessionId = r.data?.session?.id;

  r = await req("driver", "GET", "/api/stations/1");
  check("charger flipped to CHARGING", r.data.station.chargers.find(c => c.id === freeCharger.id).status === "CHARGING");

  // Let it run a few seconds so it costs something to pay by PromptPay.
  await new Promise((done) => setTimeout(done, 3000));
  r = await req("driver", "PATCH", `/api/charging-sessions/${newSessionId}`, { action: "stop" });
  check("stop the new session", r.status === 200 && r.data.session.cost > 0, JSON.stringify(r.data.session?.cost));
  const newSessionCost = r.data.session.cost;
  r = await req("driver", "GET", "/api/stations/1");
  check("charger released back to AVAILABLE", r.data.station.chargers.find(c => c.id === freeCharger.id).status === "AVAILABLE");

  r = await req("driver", "GET", "/api/profile");
  const balanceBeforePromptPay = r.data.user.walletBalance;
  r = await req("driver", "PATCH", `/api/charging-sessions/${newSessionId}`, { action: "pay", paymentMethod: "PROMPTPAY" });
  check("PromptPay pay returns a QR, session not yet paid (202)", r.status === 202 && r.data.payment.status === "PENDING" && r.data.session.paymentStatus !== "PAID", JSON.stringify(r.data).slice(0, 200));
  check("session QR is valid EMVCo for the session cost", validPromptPay(r.data.promptpay.payload, newSessionCost), `${r.data.promptpay?.payload} vs ${newSessionCost}`);
  const ppPaymentId = r.data.payment.id;
  r = await req("driver", "PATCH", `/api/charging-sessions/${newSessionId}`, { action: "pay", paymentMethod: "PROMPTPAY" });
  check("asking again reuses the pending payment", r.status === 202 && r.data.payment.id === ppPaymentId);
  r = await req("driver", "POST", `/api/payments/${ppPaymentId}/confirm`);
  check("confirm the PromptPay payment", r.status === 200 && r.data.payment.status === "PAID");
  r = await req("driver", "GET", `/api/charging-sessions/${newSessionId}`);
  check("session is now paid by PromptPay", r.data.session.paymentStatus === "PAID" && r.data.session.paymentMethod === "PromptPay QR");
  r = await req("driver", "PATCH", `/api/charging-sessions/${newSessionId}`, { action: "pay", paymentMethod: "PROMPTPAY" });
  check("paid session cannot get a new QR → 409", r.status === 409);
  r = await req("driver", "GET", "/api/profile");
  check("PromptPay does not touch the wallet", r.data.user.walletBalance === balanceBeforePromptPay);
  r = await req("driver", "GET", "/api/wallet");
  check("PromptPay payment recorded", r.data.transactions.some(t => t.sessionId === newSessionId && t.method === "PROMPTPAY"));

  section("Dashboard & stats");
  r = await req("driver", "GET", "/api/dashboard");
  check("dashboard payload", r.status === 200 && r.data.stats.totalStations === 20);
  check("dashboard stats derived from db", r.data.stats.totalChargers > 0 && r.data.stats.dailyEnergy.length === 14);
  check("recommended stations returned", Array.isArray(r.data.recommended));
  check("monthSpend keeps satang", isSatang(r.data.stats.monthSpend), String(r.data.stats.monthSpend));
  const energyDays = r.data.stats.dailyEnergy.map(d => d.date);
  check("energy chart ends on today in Bangkok", energyDays.at(-1) === bkkDay(), `${energyDays.at(-1)} vs ${bkkDay()}`);
  check("energy chart covers 14 consecutive Bangkok days", energyDays.length === 14 && energyDays[0] === bkkDay(new Date(Date.now() - 13 * 86_400_000)));
  check("today's sessions count in today's bucket", r.data.stats.dailyEnergy.at(-1).kwh > 0, JSON.stringify(r.data.stats.dailyEnergy.at(-1)));

  r = await req("driver", "GET", "/api/admin/stats");
  check("driver blocked from admin stats → 403", r.status === 403);

  r = await req("admin", "GET", "/api/admin/stats");
  check("admin stats", r.status === 200 && r.data.stats.totalStations === 20 && r.data.stats.revenueByDay.length === 30);
  check("admin top stations", r.data.stats.topStations.length > 0);
  const money = [r.data.stats.revenue, r.data.stats.revenue30d, ...r.data.stats.revenueByDay.map(d => d.revenue), ...r.data.stats.topStations.map(t => t.revenue)];
  check("revenue figures keep satang (2 decimals)", money.every(isSatang) && money.some(v => !Number.isInteger(v)), JSON.stringify(money.slice(0, 5)));
  const revenueDays = r.data.stats.revenueByDay.map(d => d.date);
  check("revenue chart ends on today in Bangkok", revenueDays.at(-1) === bkkDay() && revenueDays[0] === bkkDay(new Date(Date.now() - 29 * 86_400_000)), `${revenueDays[0]}…${revenueDays.at(-1)}`);
  check("30-day revenue equals the daily buckets", Math.abs(r.data.stats.revenue30d - r.data.stats.revenueByDay.reduce((a, d) => a + d.revenue, 0)) < 0.05);

  section("Notifications & profile");
  r = await req("driver", "GET", "/api/notifications");
  check("notifications list", r.status === 200 && r.data.notifications.length > 0);
  const unreadBefore = r.data.unread;
  check("has unread notifications from actions", unreadBefore > 0);
  r = await req("driver", "PATCH", "/api/notifications");
  check("mark all read", r.status === 200);
  r = await req("driver", "GET", "/api/notifications");
  check("unread now 0", r.data.unread === 0);

  r = await req("driver", "PATCH", "/api/profile", { fullName: "Somchai Patchara", batteryKwh: 75, vehiclePlate: "กก 1234" });
  check("update profile", r.status === 200 && r.data.user.batteryKwh === 75);

  section("Admin CRUD");
  r = await req("admin", "POST", "/api/stations", {
    name: "Test Depot Charge", address: "1 Test Road, Bangkok", latitude: 13.75, longitude: 100.5,
    pricePerKwh: 9.25, status: "AVAILABLE", openingHours: "24 Hours", amenities: "Wi-Fi",
  });
  check("admin creates station", r.status === 201, JSON.stringify(r.data).slice(0,200));
  const testStationId = r.data?.station?.id;

  r = await req("driver", "POST", "/api/stations", { name: "Nope", address: "x y z", latitude: 1, longitude: 1, pricePerKwh: 5 });
  check("driver cannot create station → 403", r.status === 403);

  r = await req("admin", "PATCH", `/api/stations/${testStationId}`, { pricePerKwh: 10.5, status: "MAINTENANCE" });
  check("admin updates station", r.status === 200 && r.data.station.pricePerKwh === 10.5 && r.data.station.status === "MAINTENANCE");

  r = await req("admin", "POST", "/api/chargers", { stationId: testStationId, chargerCode: "A1", powerKw: 150, connectorType: "CCS2" });
  check("admin adds charger", r.status === 201, JSON.stringify(r.data).slice(0,200));
  const testChargerId = r.data?.charger?.id;

  r = await req("admin", "POST", "/api/chargers", { stationId: testStationId, chargerCode: "A1", powerKw: 150, connectorType: "CCS2" });
  check("duplicate charger code → 409", r.status === 409);

  r = await req("admin", "PATCH", `/api/chargers/${testChargerId}`, { powerKw: 180, status: "MAINTENANCE" });
  check("admin updates charger", r.status === 200);

  r = await req("admin", "GET", `/api/chargers?stationId=${testStationId}`);
  check("charger list filtered by station", r.data.chargers.length === 1 && r.data.chargers[0].powerKw === 180);

  r = await req("admin", "DELETE", `/api/chargers/${testChargerId}`);
  check("admin deletes charger", r.status === 200);

  r = await req("admin", "DELETE", `/api/stations/${testStationId}`);
  check("admin deletes station", r.status === 200);

  r = await req("admin", "GET", "/api/users");
  check("admin lists users", r.status === 200 && r.data.users.length >= 10);
  const me = r.data.users.find(u => u.email === "admin@example.com");
  r = await req("admin", "PATCH", `/api/users/${me.id}`, { isActive: false });
  check("admin cannot disable self → 400", r.status === 400);

  r = await req("admin", "PATCH", `/api/users/${newUserId}`, { role: "OPERATOR", walletBalance: 500 });
  check("admin updates a user", r.status === 200 && r.data.user.role === "OPERATOR" && r.data.user.walletBalance === 500);

  r = await req("admin", "DELETE", `/api/users/${newUserId}`);
  check("admin deletes a user", r.status === 200);

  section("Stale session");
  // A token that is still cryptographically valid but whose account is gone
  // used to bounce between the proxy and the app layout forever.
  await req("ghost", "POST", "/api/auth/login", { email: "user3@example.com", password: "password123" });
  const ghostCookie = [...jar("ghost")].map(([k, v]) => `${k}=${v}`).join("; ");
  const ghost = (await req("admin", "GET", "/api/users")).data.users.find(u => u.email === "user3@example.com");
  r = await req("admin", "DELETE", `/api/users/${ghost.id}`);
  check("admin deletes the signed-in driver", r.status === 200, JSON.stringify(r.data));

  let hops = 0;
  let url = BASE + "/dashboard";
  let cookie = ghostCookie;
  let finalStatus = 0;
  while (hops < 10) {
    const res = await fetch(url, { headers: { Cookie: cookie }, redirect: "manual" });
    finalStatus = res.status;
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (pair.slice(i + 1) === "") cookie = "";
    }
    if (res.status !== 307 && res.status !== 302) break;
    url = new URL(res.headers.get("location"), BASE).toString();
    hops++;
  }
  check("stale session does not loop", hops < 5, `took ${hops} hops`);
  check("stale session lands on login", url.includes("/login") && finalStatus === 200, url);
  check("stale session cookie is cleared", cookie === "", cookie.slice(0, 30));

  section("Logout");
  r = await req("driver", "POST", "/api/auth/logout");
  check("logout", r.status === 200);
  r = await req("driver", "GET", "/api/dashboard");
  check("after logout dashboard is 401", r.status === 401);

  section("Page routing");
  const pageChecks = [
    ["/", 200], ["/login", 200], ["/register", 200],
  ];
  for (const [path, expect] of pageChecks) {
    const res = await fetch(BASE + path, { redirect: "manual" });
    check(`GET ${path} → ${expect}`, res.status === expect, `got ${res.status}`);
  }
  let res = await fetch(BASE + "/dashboard", { redirect: "manual" });
  check("GET /dashboard signed out → redirect to /login", res.status === 307 && res.headers.get("location").includes("/login"), `got ${res.status}`);

  const adminCookie = [...jar("admin")].map(([k, v]) => `${k}=${v}`).join("; ");
  res = await fetch(BASE + "/dashboard", { headers: { Cookie: adminCookie }, redirect: "manual" });
  check("GET /dashboard signed in → 200", res.status === 200, `got ${res.status}`);
  res = await fetch(BASE + "/admin", { headers: { Cookie: adminCookie }, redirect: "manual" });
  check("GET /admin as admin → 200", res.status === 200, `got ${res.status}`);

  await req("driver2", "POST", "/api/auth/login", { email: "user2@example.com", password: "password123" });
  const driverCookie = [...jar("driver2")].map(([k, v]) => `${k}=${v}`).join("; ");
  res = await fetch(BASE + "/admin", { headers: { Cookie: driverCookie }, redirect: "manual" });
  check("GET /admin as driver → redirect to /dashboard", res.status === 307 && res.headers.get("location").includes("/dashboard"), `got ${res.status}`);
  res = await fetch(BASE + "/login", { headers: { Cookie: driverCookie }, redirect: "manual" });
  check("GET /login while signed in → redirect", res.status === 307);

  const appPages = ["/stations", "/stations/8", "/charging", "/reservations", "/reservations/new", "/history", "/wallet", "/profile", "/settings", "/favorites", "/notifications"];
  for (const path of appPages) {
    const res2 = await fetch(BASE + path, { headers: { Cookie: driverCookie }, redirect: "manual" });
    check(`GET ${path} → 200`, res2.status === 200, `got ${res2.status}`);
  }
  const adminPages = ["/admin/stations", "/admin/chargers", "/admin/reservations", "/admin/sessions", "/admin/users"];
  for (const path of adminPages) {
    const res2 = await fetch(BASE + path, { headers: { Cookie: adminCookie }, redirect: "manual" });
    check(`GET ${path} → 200`, res2.status === 200, `got ${res2.status}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
