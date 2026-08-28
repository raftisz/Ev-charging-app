# Architecture

[← back to README](../README.md)

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
    api/                 # the REST API (see docs/api.md)
  components/
    layout/              # AppShell (sidebar + topbar + tab bar), session context
    stations/            # station cards, Leaflet map
    ui/                  # Button, Badge, Field, Modal, Toast, States, Stat, Icons
  server/                # server-only: db client, auth, http helpers,
                         # query + serialisation layer
  lib/                   # shared + client-safe: types, validation, formatting,
                         # geo, edge auth, API client, hooks
  proxy.ts               # route guard (Next 16's `middleware` successor)
tests/                   # api.test.mjs (REST) and ui.test.mjs (Playwright)
docs/                    # this documentation and the design reference
```

`@/server/*` is server-only and `@/lib/*` is safe anywhere, so the runtime
boundary is readable from the import path alone.

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
amenities come from `docs/design-reference/station-data.js` and are reproduced
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
