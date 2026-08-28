# API

[← back to README](../README.md)

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

See also: [architecture](architecture.md) for how auth guards these routes,
[deployment](deployment.md) for `GET /api/health`.
