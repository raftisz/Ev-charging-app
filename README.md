# Volt Grid — EV Charging Network

A complete, working EV charging platform for the Bangkok network: drivers find a
station, reserve a charger, run a live charging session, pay for it and review
their history; operators and admins manage the network from a separate console.

The UI follows the **Volt Grid** design reference (`design-reference/`): a light,
card-based system built on Space Grotesk + Inter, a `#1A66F0` brand blue and a
`#0E7A3E` green used for anything live.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
Prisma 7 · SQLite · Leaflet + OpenStreetMap · JWT auth in an httpOnly cookie.

---

## Quick start

```bash
npm install          # also runs `prisma generate`
cp .env.example .env
npx prisma migrate dev   # creates dev.db and applies the schema
npm run seed             # 20 stations, 71 chargers, 10 users, ~113 sessions
npm run dev
```

Open <http://localhost:3000>.

### Demo accounts

All demo accounts use the password `password123`.

| Email | Role | What it shows |
|---|---|---|
| `user1@example.com` | Driver | A live charging session, reservations, 45 days of history |
| `user2@example.com` … `user8@example.com` | Driver | Ordinary driver accounts |
| `admin@example.com` | Admin | Full admin console with CRUD on everything |
| `operator@example.com` | Operator | Read + station/charger management, no user deletion |

These are seed credentials for a local demo. Generate a fresh `JWT_SECRET`
before deploying anywhere real.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run seed` | Wipe and repopulate the demo data |
| `npm run db:reset` | Drop the database, re-run migrations, reseed |
| `npm run lint` | ESLint (Next 16 + React Compiler rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:api` | End-to-end REST API suite against a running server |
| `npm run test:ui` | Playwright browser suite at 5 viewport widths |

---

## Project structure

```
prisma/
  schema.prisma          # User, Station, Charger, Connector, Reservation,
                         # ChargingSession, Notification, Favorite
  stations.ts            # the 20 Bangkok stations from the design reference
  seed.ts                # deterministic demo-data seeder
src/
  app/
    page.tsx             # onboarding / landing
    (auth)/              # login, register
    (app)/               # everything behind the session guard
      dashboard/ stations/ charging/ reservations/ history/
      profile/ settings/ favorites/ notifications/
      admin/             # overview, stations, chargers, reservations,
                         # sessions, users
    api/                 # the REST API (see below)
  components/
    layout/              # AppShell (sidebar + topbar + tab bar), session context
    stations/            # station cards, Leaflet map
    ui/                  # Button, Badge, Field, Modal, Toast, States, Stat, Icons
  server/                # server-only query + serialisation layer
  lib/                   # prisma client, auth, validation, formatting, API client
  proxy.ts               # route guard (Next 16's `middleware` successor)
scripts/                 # api-test.mjs (REST) and ui-test.mjs (Playwright)
design-reference/        # the Volt Grid design canvas this UI reproduces
```

---

## API

Every endpoint returns JSON. Errors come back as `{ "error": "...", "details": ... }`
with a meaningful status code; validation failures return `422` with per-field details.
All routes except register/login and `GET /api/stations` require a session cookie.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create an account and start a session |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/me` | Current user, or `null` |
| GET | `/api/dashboard` | Driver dashboard payload (stats, live session, recommendations) |
| GET/POST | `/api/stations` | Browse (search, filters, sort) · create (admin) |
| GET/PATCH/DELETE | `/api/stations/{id}` | Station detail · update · delete (admin) |
| POST/DELETE | `/api/stations/{id}/favorite` | Save / unsave a station |
| GET | `/api/stations/{id}/availability` | Half-hour slots per charger for a given day |
| GET | `/api/favorites` | The driver's saved stations |
| GET/POST | `/api/chargers` | List (admin, filterable) · create (admin) |
| PATCH/DELETE | `/api/chargers/{id}` | Update · delete (admin) |
| GET/POST | `/api/reservations` | List (scoped) · create |
| GET/PATCH/DELETE | `/api/reservations/{id}` | Detail · cancel or change status · delete |
| GET/POST | `/api/charging-sessions` | List · start charging |
| GET/PATCH/DELETE | `/api/charging-sessions/{id}` | Detail · `action: "stop"` \| `"pay"` · delete (admin) |
| GET/PATCH | `/api/notifications` | List · mark all read |
| PATCH/DELETE | `/api/notifications/{id}` | Mark read · delete |
| GET/PATCH | `/api/profile` | View / update the signed-in user |
| GET | `/api/users` | List users (admin) |
| GET/PATCH/DELETE | `/api/users/{id}` | Detail · update role/wallet/active · delete (admin) |
| GET | `/api/admin/stats` | Network-wide KPIs, live sessions, recent activity |

The frontend never hardcodes data: every page fetches through
`src/lib/api-client.ts`, and every dashboard figure is aggregated from the
database in `src/server/stats.ts`.

---

## How the domain works

**Charging sessions advance in real time.** An `ACTIVE` session stores its start
time, rated power and the driver's battery capacity; energy, battery percent and
cost are *projected* from elapsed wall-clock time on every read
(`src/server/sessions.ts`), using a 0.62 taper factor for the DC charge curve.
Stopping a session freezes those projected values into the row and releases the
charger. So the dashboard genuinely ticks upward while you watch it.

**Reservations are clash-checked.** Booking a slot re-validates against every
`PENDING`/`CONFIRMED`/`ACTIVE` reservation on that charger, so a slot taken while
you were choosing returns `409` rather than double-booking. Cancelling releases
a `RESERVED` charger back to `AVAILABLE`.

**Station status is derived, not stored twice.** `availableCount`, `maxPowerKw`,
`connectorTypes`, distance and ETA are computed from the charger rows on read.

---

## Data

The 20 stations, their chargers, connectors, prices, ratings, opening hours and
amenities come from `design-reference/station-data.js` and are reproduced
verbatim in `prisma/stations.ts`, so the seeded database matches the design
reference exactly. Coordinates are real Bangkok locations, and the map renders
them on live OpenStreetMap tiles via Leaflet.

The stations, drivers, sessions and payments are **realistic demo data, not real
network data.** There is no live operator feed behind this app. If you want to
back it with a real source, `src/server/stations.ts` is the single place that
produces `StationDTO`; swapping its Prisma queries for an
[Open Charge Map](https://openchargemap.org/site/develop/api) or OpenStreetMap
Overpass client (both need only a free API key or none at all) would leave the
rest of the app untouched.

Seeding is deterministic — a fixed PRNG seed means `npm run seed` always
produces the same demo story.

---

## Auth

- Passwords hashed with bcrypt (cost 10).
- Sessions are HS256 JWTs in an httpOnly, SameSite=Lax cookie, valid 7 days.
- `src/proxy.ts` guards page routes at the edge (JWT verification only, so no
  Prisma or bcrypt in the edge runtime); API routes re-check with
  `requireUser()` / `requireAdmin()`.
- Roles: `USER`, `OPERATOR`, `ADMIN`. Drivers are redirected away from `/admin`;
  admin-only API routes return `403`.

---

## Testing

With the dev server running:

```bash
npm run test:api
```

Covers 92 cases: auth and role boundaries, station search/filter/sort, favourites,
reservation clash detection, the full start → stop → pay session lifecycle,
dashboard and admin aggregates, admin CRUD, and page-level route guards.

And the browser suite (once, `npx playwright install chromium`):

```bash
npm run test:ui
```

57 cases driving the real UI at 390px, 768px, 1024px, 1440px and 1920px:
navigation shape per breakpoint, Leaflet tiles and markers, search and filters,
loading / empty / error / success states, form validation, modals, the
registration flow, and an assertion of zero horizontal overflow and zero console
errors at every width. Screenshots are written to `test-screenshots/`.

---

## Moving to PostgreSQL

SQLite is the default so the demo runs with no external services. To switch:

1. `provider = "postgresql"` in `prisma/schema.prisma`.
2. Point `DATABASE_URL` at the server.
3. Swap the adapter in `src/lib/prisma.ts` for `@prisma/adapter-pg`.
4. `npx prisma migrate dev && npm run seed`.

Nothing above the Prisma client needs to change.
