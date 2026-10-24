# Live charging and analytics

[← back to README](../README.md)

## The charge curve

A battery doesn't take full power all the way to full. `src/lib/charge-curve.ts`
models that:

- **DC** (50 kW and up) runs at rated power between about 10% and 45%, then
  tapers: half power at 80%, a tenth at 100%.
- **AC** stays flat until about 92%, then eases off.

The model steps through the session every 15 seconds. Energy, battery level,
current power and time to target all come from that one curve.

The module has no dependencies. The server uses it to project an active
session (`projectSession` in `src/server/sessions.ts`), and the browser uses
the same function to draw the power chart. The point marked "now" on the chart
therefore always matches the figures above it. The seed uses it too, so past
sessions have realistic energy and durations.

## Live updates (Server-Sent Events)

```
GET /api/live?scope=driver    the signed-in driver's active session
GET /api/live?scope=network   every active session, network kW (staff only)
GET /api/live?...&once=1      one JSON snapshot instead of a stream
```

The route returns a `text/event-stream` response and pushes
`event: snapshot` every 3 seconds.

Serverless hosts cap how long a function can run (`maxDuration = 60`), so the
server closes each stream after 50 seconds and tells the browser to reconnect
after `retry: 1000`. `EventSource` does that reconnect on its own.

`useLive(scope)` in `src/lib/use-live.ts` wraps the stream. If the stream fails
three times in a row (a proxy that buffers responses, for example), it falls
back to polling `once=1` every 5 seconds. The badge next to the session shows
which mode is running: **Live**, **Updating** or **Connecting**.

Where it's used:

- **`/charging`**: live figures plus the power chart. A solid line shows the
  power so far, a dashed line shows the projection to the target, and you can
  hover for a reading at any minute.
- **Dashboard**: the live session card.
- **Admin overview**: every running session, its kW, and total network power.

## Analytics (`/admin/analytics`)

`GET /api/admin/analytics?days=7|30|90` (staff only).

The endpoint reads the sessions in the period once and aggregates them in
`src/server/analytics.ts`. It groups by Bangkok day and hour with the same
time-zone helpers as the rest of the app.

| Section | What it shows |
|---|---|
| KPIs | Revenue billed, energy, sessions, average kWh and length, drivers, each compared with the previous period of the same length |
| Revenue per day / Energy per day | Two separate charts rather than one chart with two axes |
| When drivers charge | Sessions started, by weekday × hour, Monday first, in Bangkok time |
| Stations | Ranked by revenue, with sessions, energy and busy % (share of charger time spent charging) |
| Charger types | Energy by AC (under 50 kW) / DC (50–99 kW) / Fast DC (100 kW+) |
| How drivers pay | Paid charges by method |

"Billed" revenue counts sessions that are paid or awaiting payment. Refunded
and failed payments are left out.

The demo seed generates 90 days of history: about 650 sessions, with weekday
commute peaks, busier weekends and gentle growth. That gives every period
something to show.

## Tests

- `npm run test:curve`: curve shape, time to target, energy, and agreement
  between chart points and the projection.
- `npm run test:api` sections **Live updates** and **Analytics**:
  - Auth for each scope.
  - The SSE stream sends repeated snapshots.
  - Daily, station and heatmap totals add up to the KPIs.
  - Periods other than 7, 30 and 90 are rejected.
- `npm run test:ui`:
  - The power chart is drawn and the badge reaches **Live**.
  - The analytics page renders in English and Thai.
  - The heatmap has 168 cells.
  - The period switch works.
