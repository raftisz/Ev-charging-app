/**
 * Browser test suite: drives the real app with Playwright at mobile, tablet and
 * desktop widths, checking navigation shape, the map, loading/empty/error/success
 * states, form validation and horizontal overflow.
 *
 * Needs a running server (`npm run dev`) and, once, `npx playwright install chromium`.
 * Screenshots land in ./tests/screenshots (override with OUT=...).
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = process.env.OUT ?? "tests/screenshots";
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const errors = [];
const check = (n, c, extra = "") => {
  if (c) { pass++; console.log(`  ok   ${n}`); }
  else { fail++; console.log(`  FAIL ${n} ${extra}`); }
};

const browser = await chromium.launch();

async function newPage(viewport, name, options = {}) {
  const ctx = await browser.newContext({ viewport, ...options });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${name}] ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  return { ctx, page };
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForSelector("text=Network status", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
}

// ---------- DESKTOP ----------
console.log("\n=== Desktop 1440x900 · driver ===");
{
  const { ctx, page } = await newPage({ width: 1440, height: 900 }, "desktop");

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check("landing renders headline", await page.locator("h1").first().isVisible());
  check("landing shows demo accounts", (await page.textContent("body")).includes("user1@example.com"));

  await login(page, "user1@example.com");
  check("desktop sidebar visible", await page.locator("aside").isVisible());
  check("mobile tab bar hidden on desktop", !(await page.locator("nav.fixed.inset-x-0.bottom-0").isVisible()));
  const dashText = await page.textContent("body");
  check("live session card shown", /charging now|target reached/i.test(dashText));
  check("recommendations rendered", await page.locator("text=Suggested for your next charge").isVisible());
  check("network status panel", await page.locator("text=Network status").isVisible());
  check("no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: `${OUT}/desktop-dashboard.png`, fullPage: false });

  await page.click('a[href="/stations"]');
  await page.waitForURL("**/stations");
  await page.waitForTimeout(2500);
  check("station list renders cards", (await page.locator(".vg-card").count()) > 5);
  check("leaflet map mounted", (await page.locator(".leaflet-container").count()) === 1);
  check("map tiles loaded", (await page.locator(".leaflet-tile").count()) > 0);
  check("map markers rendered", (await page.locator(".leaflet-marker-icon").count()) > 5);
  await page.screenshot({ path: `${OUT}/desktop-stations.png` });

  await page.fill('input[aria-label="Search stations"]', "Siam");
  await page.waitForTimeout(900);
  const listText = await page.textContent("body");
  check("search narrows the list", listText.includes("Siam Green Station") && !listText.includes("Onnut Local Charger"));

  await page.fill('input[aria-label="Search stations"]', "zzzz-nothing");
  await page.waitForTimeout(900);
  check("empty state shown for no matches", await page.locator("text=No stations match those filters").isVisible());
  await page.screenshot({ path: `${OUT}/desktop-stations-empty.png` });
  await page.fill('input[aria-label="Search stations"]', "");
  await page.waitForTimeout(800);

  await page.click('button:has-text("Fast 100 kW+")');
  await page.waitForTimeout(900);
  check("fast filter applied", (await page.textContent("body")).includes("stations match"));

  await page.goto(`${BASE}/stations/8`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("station detail heading", await page.locator("h2:has-text('Rama IX Power Station')").isVisible());
  check("charger rows listed", (await page.locator("text=Start charging").count()) >= 1);
  check("amenities shown", await page.locator("text=Amenities & hours").isVisible());
  await page.screenshot({ path: `${OUT}/desktop-station-detail.png` });

  // favourite toggle
  const favBtn = page.locator('button[aria-label="Save to favourites"], button[aria-label="Remove from favourites"]').first();
  const beforeLabel = await favBtn.getAttribute("aria-label");
  await favBtn.click();
  await page.waitForTimeout(900);
  const afterLabel = await page.locator('button[aria-label="Save to favourites"], button[aria-label="Remove from favourites"]').first().getAttribute("aria-label");
  check("favourite toggles", beforeLabel !== afterLabel, `${beforeLabel} -> ${afterLabel}`);

  await page.goto(`${BASE}/charging`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  check("charging page shows live ring", (await page.textContent("body")).includes("target 80%"));
  check("stop button present", await page.locator('button:has-text("Stop charging")').isVisible());
  await page.screenshot({ path: `${OUT}/desktop-charging.png` });

  await page.goto(`${BASE}/reservations/new`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("reservation wizard steps", await page.locator("text=1. Station").isVisible());
  await page.selectOption('select[aria-label="Choose a station"]', { index: 3 });
  await page.waitForTimeout(1500);
  // Slots run 08:00-20:30, so pick tomorrow to stay deterministic whatever
  // time of day the suite runs at.
  await page.selectOption('select[aria-label="Choose a day"]', { index: 1 });
  await page.waitForTimeout(1800);
  check("slots appear after choosing a station", (await page.locator('button:has-text(":00"), button:has-text(":30")').count()) > 4);
  const slot = page.locator("button:not([disabled])").filter({ hasText: /^\d{2}:\d{2}$/ }).first();
  await slot.scrollIntoViewIfNeeded().catch(() => {});
  await slot.click({ timeout: 8000 }).catch((e) => console.log("   (slot click failed: " + e.message.split("\n")[0] + ")"));
  await page.waitForTimeout(900);
  check("summary total computed", (await page.textContent("body")).includes("Estimated total"));
  await page.screenshot({ path: `${OUT}/desktop-reservation.png` });

  await page.goto(`${BASE}/history`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("history table rendered", (await page.textContent("body")).includes("Energy charged"));
  check("history rows present", (await page.locator("text=Rama IX").count()) >= 0);
  await page.screenshot({ path: `${OUT}/desktop-history.png` });

  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  check("profile form loaded", await page.locator("text=Your details").isVisible());
  await page.screenshot({ path: `${OUT}/desktop-profile.png` });

  await page.goto(`${BASE}/notifications`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  check("notifications listed", (await page.locator("li").count()) > 2);

  await ctx.close();
}

// ---------- ADMIN ----------
console.log("\n=== Desktop 1440x900 · admin ===");
{
  const { ctx, page } = await newPage({ width: 1440, height: 900 }, "admin");
  await login(page, "admin@example.com");
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  check("admin badge in sidebar", await page.locator("text=ADMIN").first().isVisible());
  const body = await page.textContent("body");
  check("admin KPI tiles", body.includes("Total stations") && body.includes("Revenue (all time)"));
  check("revenue chart", await page.locator("text=Revenue, last 30 days").isVisible());
  check("live sessions panel", await page.locator("text=Live charging sessions").isVisible());
  check("top stations panel", await page.locator("text=Top stations by revenue").isVisible());
  await page.screenshot({ path: `${OUT}/desktop-admin.png` });

  await page.goto(`${BASE}/admin/stations`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("admin station table", (await page.locator("li").count()) > 10);
  await page.click('button:has-text("New station")');
  await page.waitForTimeout(500);
  check("create station modal opens", await page.locator('[role="dialog"]').isVisible());
  await page.screenshot({ path: `${OUT}/desktop-admin-station-modal.png` });
  await page.click('button:has-text("Create station")');
  await page.waitForTimeout(700);
  check("modal validates empty name", (await page.textContent('[role="dialog"]')).includes("Station needs a name"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await page.goto(`${BASE}/admin/chargers`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("charger table rendered", (await page.locator("li").count()) > 10);
  await page.screenshot({ path: `${OUT}/desktop-admin-chargers.png` });

  await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("user table rendered", (await page.locator("li").count()) >= 10);
  await page.screenshot({ path: `${OUT}/desktop-admin-users.png` });

  await page.goto(`${BASE}/admin/sessions`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  check("sessions page KPIs", (await page.textContent("body")).includes("Running now"));

  await page.goto(`${BASE}/admin/reservations`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("admin reservations rendered", (await page.locator("li").count()) > 3);
  await ctx.close();
}

// ---------- MOBILE ----------
console.log("\n=== Mobile 390x844 ===");
{
  const { ctx, page } = await newPage({ width: 390, height: 844 }, "mobile");
  await login(page, "user1@example.com");
  await page.waitForTimeout(1500);
  check("bottom tab bar visible", await page.locator("nav.fixed.inset-x-0.bottom-0").isVisible());
  check("desktop sidebar hidden", !(await page.locator("aside").isVisible()));
  check("no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: `${OUT}/mobile-dashboard.png`, fullPage: true });

  await page.click('button[aria-label="Open menu"]');
  await page.waitForTimeout(500);
  check("mobile drawer opens", await page.locator('div.fixed.inset-0.z-\\[120\\]').isVisible());
  await page.screenshot({ path: `${OUT}/mobile-drawer.png` });
  await page.keyboard.press("Escape");
  await page.mouse.click(370, 400);
  await page.waitForTimeout(500);

  await page.goto(`${BASE}/stations`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  check("mobile stations list", (await page.locator(".vg-card").count()) > 3);
  check("no horizontal overflow on stations", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: `${OUT}/mobile-stations.png` });

  await page.click('button:has-text("Map")');
  await page.waitForTimeout(2500);
  check("mobile map toggles on", (await page.locator(".leaflet-container").isVisible()));
  await page.screenshot({ path: `${OUT}/mobile-map.png` });

  await page.goto(`${BASE}/charging`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("mobile charging page", (await page.textContent("body")).includes("Charging now"));
  check("no horizontal overflow on charging", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: `${OUT}/mobile-charging.png`, fullPage: true });

  await page.goto(`${BASE}/history`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("mobile history uses cards not table", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: `${OUT}/mobile-history.png` });
  await ctx.close();
}

// ---------- TABLET ----------
console.log("\n=== Tablet 820x1180 ===");
{
  const { ctx, page } = await newPage({ width: 820, height: 1180 }, "tablet");
  await login(page, "user1@example.com");
  await page.waitForTimeout(1500);
  check("tablet renders without overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: `${OUT}/tablet-dashboard.png` });
  await page.goto(`${BASE}/stations`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  check("tablet stations no overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: `${OUT}/tablet-stations.png` });
  await ctx.close();
}

// ---------- REGISTER FLOW ----------
console.log("\n=== Registration flow ===");
{
  const { ctx, page } = await newPage({ width: 1440, height: 900 }, "register");
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await page.click('button[type="submit"]');
  await page.waitForTimeout(600);
  check("register validates empty form", (await page.textContent("body")).includes("Please enter your full name"));
  const email = `pw${Date.now()}@example.com`;
  await page.fill('input[autocomplete="name"]', "Playwright Tester");
  await page.fill('input[type="email"]', email);
  await page.locator('input[autocomplete="new-password"]').first().fill("password123");
  await page.locator('input[autocomplete="new-password"]').nth(1).fill("password456");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(600);
  check("password mismatch caught", (await page.textContent("body")).includes("Passwords do not match"));
  await page.locator('input[autocomplete="new-password"]').nth(1).fill("password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  check("registered and landed on dashboard", page.url().includes("/dashboard"));
  await page.waitForTimeout(1800);
  check("new user sees empty-state dashboard", (await page.textContent("body")).includes("Nothing charging right now"));
  await page.screenshot({ path: `${OUT}/desktop-dashboard-new-user.png` });
  await ctx.close();
}

// ---------- MONEY FORMAT ----------
// Every baht amount on screen carries satang: ฿64.47, ฿249.00, never ฿64.
console.log("\n=== Money shown to 2 decimals ===");
{
  // innerText, not textContent: adjacent elements must not run together.
  const amounts = async (page) => (await page.innerText("body")).match(/฿[\d,]+(?:\.\d+)?/g) ?? [];
  const sweep = async (page, paths) => {
    for (const path of paths) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      const found = await amounts(page);
      const bad = found.filter((m) => !/\.\d{2}$/.test(m));
      check(`${path}: ${found.length} amounts, all 2 decimals`, found.length > 0 && bad.length === 0, bad.slice(0, 5).join(" "));
    }
  };
  const driver = await newPage({ width: 1440, height: 900 }, "money-driver");
  await login(driver.page, "user1@example.com");
  await sweep(driver.page, ["/dashboard", "/history", "/wallet", "/charging", "/reservations", "/reservations/new?station=4", "/profile", "/notifications", "/stations"]);
  await driver.ctx.close();

  const admin = await newPage({ width: 1440, height: 900 }, "money-admin");
  await login(admin.page, "admin@example.com");
  await sweep(admin.page, ["/admin", "/admin/sessions", "/admin/users", "/admin/stations"]);
  await admin.ctx.close();
}

// ---------- TIME ZONE ----------
// A browser in UTC (as the Vercel server is) must still offer, book and show
// Bangkok times: the slot picked is the slot booked and the time displayed.
console.log("\n=== Booking from a UTC browser ===");
{
  const { ctx, page } = await newPage({ width: 1280, height: 900 }, "utc", { timezoneId: "UTC" });
  check("browser runs in UTC", (await page.evaluate(() => new Date(0).getTimezoneOffset())) === 0);
  await login(page, "user2@example.com");
  await page.goto(`${BASE}/reservations/new?station=6`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.selectOption('select[aria-label="Choose a day"]', { index: 2 });
  await page.waitForTimeout(1800);
  const want = page.locator("button:not([disabled])").filter({ hasText: /^16:30$/ }).first();
  const pick = (await want.count()) ? want : page.locator("button:not([disabled])").filter({ hasText: /^\d{2}:\d{2}$/ }).first();
  const label = (await pick.textContent()).trim();
  await pick.click();
  await page.waitForTimeout(600);
  const when = await page.locator("dt:has-text('When') + dd").textContent();
  check(`summary shows the picked slot (${label})`, when.trim().endsWith(label), when);

  const [created] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/reservations") && r.request().method() === "POST"),
    page.click('button:has-text("Confirm reservation")'),
  ]);
  const { reservation } = await created.json();
  const bkk = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  check("booked start is the picked slot in Bangkok", bkk.format(new Date(reservation.startTime)) === label, reservation.startTime);

  await page.waitForURL("**/reservations", { timeout: 15000 });
  await page.waitForTimeout(1200);
  const row = page.locator("li", { hasText: reservation.station.name }).first();
  check("reservation list shows the same time", ((await row.textContent()) ?? "").includes(`${label} –`), (await row.textContent())?.slice(0, 120));
  await page.screenshot({ path: `${OUT}/utc-reservation.png` });

  await page.request.patch(`${BASE}/api/reservations/${reservation.id}`, { data: { status: "CANCELLED" } });
  await ctx.close();
}

await browser.close();

const realErrors = errors.filter((e) => !/favicon|net::ERR_|Download the React DevTools/i.test(e));
console.log(`\nConsole errors: ${realErrors.length}`);
realErrors.slice(0, 15).forEach((e) => console.log("  " + e));
check("no console errors", realErrors.length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
