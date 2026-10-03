# Volt Grid — EV Charging Network

A complete, working EV charging platform for the Bangkok network: drivers find a
station, reserve a charger, run a live charging session, pay for it and review
their history; operators and admins manage the network from a separate console.

The UI follows `docs/design-reference/evstations-dashboard-concept.jpg`: borderless
white cards floating on a pale blue canvas, large corner radii, diffuse
blue-tinted shadows, pastel stat tiles, capsule pills and segmented controls,
Poppins headings over Inter body text, and soft blue area and bar charts. The
information architecture — which screens exist and what each one shows — still
comes from the original Volt Grid canvas in the same folder.

---

## Features

**For drivers**

- Browse stations with search, filters and sorting, or find them on a Leaflet map
  over live OpenStreetMap tiles
- Save stations as favourites
- Reserve a charger from half-hour availability slots, clash-checked against
  every pending, confirmed and active reservation on that charger
- Run a live charging session that advances in real time, then stop and pay
- Review 45 days of history, notifications, profile and settings

**For operators and admins**

- A separate console with network-wide KPIs, live sessions and recent activity
- CRUD on stations, chargers, reservations, sessions and users
- Operators get read plus station/charger management; admins get everything

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
Prisma 7 · PostgreSQL · Leaflet + OpenStreetMap · JWT auth in an httpOnly cookie.

## Requirements

| | |
|---|---|
| Node.js | `>=20.9.0` (see `engines` in `package.json`) |
| PostgreSQL | 16 — supplied by `npm run db:up` via Docker, or bring your own |
| Docker | only if you use `npm run db:up` for the local database |

---

## Installation

```bash
npm install              # also runs `prisma generate`
cp .env.example .env
```

## Quick start

```bash
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

## Development

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

### Testing

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
errors at every width. Screenshots are written to `tests/screenshots/`.

---

## Documentation

| Document | What it covers |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Project structure, how the domain works, data, auth |
| [docs/system-diagrams.md](docs/system-diagrams.md) | Architecture, target microservices, tech stack, ER diagram and user journey (Mermaid) |
| [docs/api.md](docs/api.md) | Every REST endpoint and its purpose |
| [docs/deployment.md](docs/deployment.md) | Render, Vercel and any Node host · `GET /api/health` |
| [docs/design-reference/](docs/design-reference/) | The visual concept and the original Volt Grid canvas |
