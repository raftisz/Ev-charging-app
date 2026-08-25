# Volt Grid — EV Charging Network

A complete, working EV charging platform for the Bangkok network: drivers find a
station, reserve a charger, run a live charging session, pay for it and review
their history; operators and admins manage the network from a separate console.

The UI follows `design-reference/evstations-dashboard-concept.jpg`: borderless
white cards floating on a pale blue canvas, large corner radii, diffuse
blue-tinted shadows, pastel stat tiles, capsule pills and segmented controls,
Poppins headings over Inter body text, and soft blue area and bar charts. The
information architecture — which screens exist and what each one shows — still
comes from the original Volt Grid canvas in the same folder.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
Prisma 7 · PostgreSQL · Leaflet + OpenStreetMap · JWT auth in an httpOnly cookie.

---

## Quick start

```bash
npm install              # also runs `prisma generate`
cp .env.example .env
npm run db:up            # PostgreSQL 16 in Docker on port 5433
npx prisma migrate dev   # applies the schema
npm run seed             # 20 stations, 71 chargers, 10 users, ~113 sessions
npm run dev
```

If you already run PostgreSQL locally, skip `npm run db:up` and point
`DATABASE_URL` at your own instance instead.

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
| `npm run build` | Production build |
| `npm start` | Apply migrations, seed an empty database, then serve |
| `npm run start:next` | Serve only, without the migrate/seed step |
| `npm run db:up` / `npm run db:down` | Start / stop the local PostgreSQL container |
| `npm run seed` | Wipe and repopulate the demo data |
| `npm run seed:if-empty` | Seed only when the database has no stations (used by deploys) |
| `npm run db:reset` | Drop the database, re-run migrations, reseed |
| `npm run lint` | ESLint (Next 16 + React Compiler rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:api` | End-to-end REST API suite against a running server |
| `npm run test:ui` | Playwright browser suite at 5 viewport widths |

---

## Project structure

```
docker-compose.yml       # local PostgreSQL
render.yaml              # Render blueprint: database + web service
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
design-reference/        # the visual concept and the original Volt Grid canvas
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

## Deploying

The app needs a PostgreSQL database and two environment variables:
`DATABASE_URL` and `JWT_SECRET`.

### Render (blueprint)

`render.yaml` provisions both pieces. In Render choose **New → Blueprint** and
point it at this repository; it creates the database, creates the web service,
wires `DATABASE_URL` between them and generates a `JWT_SECRET`.

Note that Render's free plan allows only **one active free PostgreSQL per
account**, so a blueprint that creates one fails with *cannot have more than
one active free tier database* if you already have any. Reuse the database you
have instead — see **Sharing one database** below.

### Sharing one database with another project

Append `?schema=voltgrid` to `DATABASE_URL`:

```
postgresql://user:password@host:5432/dbname?schema=voltgrid
```

Volt Grid then creates and uses its own Postgres schema inside that database.
The other project keeps `public` and the two never see each other's tables, so
a single free instance can serve both.

### Vercel

Vercel never runs `npm start` — it builds the app and serves it as functions —
so the migration has to happen during the build. `package.json` provides a
`vercel-build` script that Vercel picks up automatically:

```
prisma migrate deploy && tsx prisma/seed.ts --if-empty && next build
```

Import the repo in Vercel, add `DATABASE_URL` and `JWT_SECRET` under
**Settings → Environment Variables**, and deploy. There is no build-command or
start-command to configure.

Add both variables **before** the first deploy, and tick every environment you
build (Production, Preview, Development). A build that starts without
`DATABASE_URL` stops at `prisma migrate deploy`, because the schema cannot be
applied to a database it has no address for. Vercel also lower-cases nothing
for you: the project name must be lowercase even though the repository is
`Ev-charging-app`.

Vercel has no database of its own, so create one first — [Neon](https://neon.tech)
has a free tier with no per-account instance limit. Use its **pooled**
connection string (the host containing `-pooler`), which suits functions that
open a connection per invocation.

### Render (manual), or any other Node host

Create a PostgreSQL database first, then a web service with:

| Setting | Value |
|---|---|
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| `DATABASE_URL` | the database's internal connection string (add `?schema=voltgrid` to share it with another project) |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |

`npm start` runs `prisma migrate deploy` and then seeds an empty database
before handing over to `next start`, so the schema is in place however the host
is configured. That is deliberate: a deploy whose build step forgets
`prisma migrate deploy` is exactly what produces
`DriverAdapterError: TableDoesNotExist` at runtime, and booting through the
migration removes that failure mode entirely.

Seeding uses `--if-empty`, so the demo data lands on the first boot and later
restarts leave accounts and sessions created on the live site alone.

On Render's free plan the service sleeps after inactivity, so the first request
after a while takes a few seconds to wake up.
