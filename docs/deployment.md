# Deployment

[← back to README](../README.md)

## Checking a deployment

`GET /api/health` reports whether each piece is configured and reachable —
booleans and counts only, never the value of any variable:

```json
{ "ok": true,
  "checks": { "databaseUrlSet": true, "jwtSecretSet": true,
              "databaseReachable": true, "schemaApplied": true,
              "seeded": true, "stations": 20, "users": 10 } }
```

It answers `503` when something is missing, which makes the usual deploy
failures obvious: pages render but signing in returns 500 → `jwtSecretSet` is
false; everything 500s → `databaseReachable` is false.

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

### OCPP (optional)

The OCPP central system is a separate long-running process; see
[ocpp.md](ocpp.md#deploying-the-csms). Without it the app runs every charger as
a simulated session.

### Public demo

A deploy is a public demo unless `DEMO_MODE` is set to `off`. The sign-in page
then offers one-click demo accounts, and those accounts are protected: their
password, role and active flag are fixed and they cannot be deleted.

To put the demo back to its starting state every night, add a `CRON_SECRET`
environment variable (any long random string, generated like `JWT_SECRET`).
`vercel.json` schedules `GET /api/cron/reset-demo` for 20:00 UTC, which is
03:00 in Bangkok, and Vercel sends the secret as a bearer token. The route
refuses any other caller with `401`, and without `CRON_SECRET` it does nothing.
The reset wipes the database, accounts registered on the demo included, and
reseeds it with the same data as `npm run seed`. To run it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/cron/reset-demo
```

On other hosts, point any scheduler at the same URL with the same header.

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
