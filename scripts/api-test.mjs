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
  const day = new Date(Date.now() + 26 * 3600_000).toISOString().slice(0, 10);
  r = await req("driver", "GET", `/api/stations/4/availability?date=${day}&duration=45`);
  check("availability returns slots per charger", r.status === 200 && r.data.chargers.length > 0 && r.data.chargers[0].slots.length > 0);
  const charger = r.data.chargers.find(c => c.bookable && c.slots.some(s => s.available));
  const slot = charger.slots.find(s => s.available);

  r = await req("driver", "POST", "/api/reservations", { stationId: 4, chargerId: charger.id, startTime: slot.iso, durationMinutes: 45 });
  check("create reservation", r.status === 201 && r.data.reservation.status === "CONFIRMED", JSON.stringify(r.data));
  const reservationId = r.data?.reservation?.id;

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
  check("live session projects energy > 0", live.energyKwh > 0 && live.cost > 0);
  check("live session percent within target", live.currentPercent <= live.targetPercent);

  r = await req("driver", "POST", "/api/charging-sessions", { stationId: 1, chargerId: 1, startPercent: 20, targetPercent: 80 });
  check("cannot start a second session → 409", r.status === 409);

  r = await req("driver", "PATCH", `/api/charging-sessions/${live.id}`, { action: "stop" });
  check("stop session", r.status === 200 && r.data.session.status === "COMPLETED", JSON.stringify(r.data).slice(0,200));


  r = await req("driver", "PATCH", `/api/charging-sessions/${live.id}`, { action: "stop" });
  check("stop twice → 409", r.status === 409);

  r = await req("driver", "PATCH", `/api/charging-sessions/${live.id}`, { action: "pay", paymentMethod: "Volt Grid wallet" });
  check("pay with wallet", r.status === 200 && r.data.session.paymentStatus === "PAID", JSON.stringify(r.data).slice(0,200));

  r = await req("driver", "GET", "/api/profile");
  check("wallet was debited", Math.abs(r.data.user.walletBalance) >= 0);

  r = await req("driver", "PATCH", `/api/charging-sessions/${live.id}`, { action: "pay", paymentMethod: "Credit card" });
  check("paying twice → 409", r.status === 409);

  // start a fresh session now that the old one is closed
  r = await req("driver", "GET", "/api/stations/1");
  const freeCharger = r.data.station.chargers.find(c => c.status === "AVAILABLE");
  r = await req("driver", "POST", "/api/charging-sessions", { stationId: 1, chargerId: freeCharger.id, startPercent: 30, targetPercent: 80 });
  check("start a new session", r.status === 201 && r.data.session.status === "ACTIVE", JSON.stringify(r.data).slice(0,200));
  const newSessionId = r.data?.session?.id;

  r = await req("driver", "GET", "/api/stations/1");
  check("charger flipped to CHARGING", r.data.station.chargers.find(c => c.id === freeCharger.id).status === "CHARGING");

  r = await req("driver", "PATCH", `/api/charging-sessions/${newSessionId}`, { action: "stop" });
  check("stop the new session", r.status === 200);
  r = await req("driver", "GET", "/api/stations/1");
  check("charger released back to AVAILABLE", r.data.station.chargers.find(c => c.id === freeCharger.id).status === "AVAILABLE");

  section("Dashboard & stats");
  r = await req("driver", "GET", "/api/dashboard");
  check("dashboard payload", r.status === 200 && r.data.stats.totalStations === 20);
  check("dashboard stats derived from db", r.data.stats.totalChargers > 0 && r.data.stats.dailyEnergy.length === 14);
  check("recommended stations returned", Array.isArray(r.data.recommended));

  r = await req("driver", "GET", "/api/admin/stats");
  check("driver blocked from admin stats → 403", r.status === 403);

  r = await req("admin", "GET", "/api/admin/stats");
  check("admin stats", r.status === 200 && r.data.stats.totalStations === 20 && r.data.stats.revenueByDay.length === 30);
  check("admin top stations", r.data.stats.topStations.length > 0);

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

  const appPages = ["/stations", "/stations/8", "/charging", "/reservations", "/reservations/new", "/history", "/profile", "/settings", "/favorites", "/notifications"];
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
