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
| GET | `/api/stations/{id}/availability` | Half-hour slots per charger for a given day (Bangkok time) |
| GET | `/api/favorites` | The driver's saved stations |
| GET/POST | `/api/chargers` | List (admin, filterable) · create (admin) |
| PATCH/DELETE | `/api/chargers/{id}` | Update · delete (admin) |
| GET/POST | `/api/reservations` | List (scoped) · create |
| GET/PATCH/DELETE | `/api/reservations/{id}` | Detail · cancel or change status · delete |
| GET/POST | `/api/charging-sessions` | List · start charging |
| GET/PATCH/DELETE | `/api/charging-sessions/{id}` | Detail · `action: "stop"` \| `"pay"` · delete (admin) |
| GET | `/api/wallet` | Wallet balance and the latest 50 transactions (`Payment` rows) |
| POST | `/api/wallet/topup` | Add money: `{ amount: 20–10000, method: "CREDIT_CARD" \| "PROMPTPAY" }` (PromptPay: `202` + QR) |
| GET | `/api/payments/{id}` | One payment as a receipt (payer or admin; otherwise `404`) |
| POST | `/api/payments/{id}/confirm` | Confirm a pending PromptPay payment (simulated, payer only) |
| GET/PATCH | `/api/notifications` | List · mark all read |
| PATCH/DELETE | `/api/notifications/{id}` | Mark read · delete |
| GET/PATCH | `/api/profile` | View / update the signed-in user |
| GET | `/api/users` | List users (admin) |
| GET/PATCH/DELETE | `/api/users/{id}` | Detail · update role/wallet/active · delete (admin) |
| GET | `/api/admin/stats` | Network-wide KPIs, live sessions, recent activity |

## Money

Amounts are baht stored as numbers rounded to 2 decimals (satang) before
they are written. API figures keep those 2 decimals, including the
dashboard `monthSpend` and the admin revenue totals. Every amount shown in
the UI or in a notification goes through `thb()` in `src/lib/format.ts` and
always has 2 decimals: `฿64.47`, `฿249.00`, `฿0.00`.

## Time zone

Booking days and slot times are Bangkok wall-clock time (`Asia/Bangkok`,
UTC+7), whatever zone the server or browser runs in.
`GET /api/stations/{id}/availability?date=YYYY-MM-DD` treats `date` as a
Bangkok day (default: today in Bangkok). Each slot has a `time` label such as
`"16:30"` and an `iso` instant, `2026-10-09T09:30:00.000Z` for that label;
send `iso` as `startTime` when booking. A slot is `past` once that instant has
passed. All API timestamps are UTC ISO strings and the UI formats them in
Bangkok time (`src/lib/timezone.ts`, `src/lib/format.ts`).

Dashboard and admin statistics use Bangkok days too: `dailyEnergy` (14 days)
and `revenueByDay` (30 days) are keyed by Bangkok `YYYY-MM-DD` and end on
today in Bangkok, and "this month" (`monthSpend`, `monthEnergyKwh`) starts
at Bangkok midnight on the 1st.

`npm run dev:utc` starts the server in UTC as Vercel runs it, and
`npm run test:tz` checks the helpers with `TZ=UTC`.

## Paying for a session

`PATCH /api/charging-sessions/{id}` with
`{ "action": "pay", "paymentMethod": "WALLET" | "CREDIT_CARD" | "PROMPTPAY" }`.
The older labels (`"Volt Grid wallet"`, `"Credit card"`, `"PromptPay QR"`) are
still accepted.

The payment runs in one database transaction:

1. The session is marked `PAID` only if it is finished and not already paid.
   A second request for the same session, even a concurrent one, gets `409`.
2. For `WALLET`, the balance is debited only if it covers the amount, in the
   same `UPDATE`. Too little balance returns `409` and nothing is written.
3. A `Payment` row (`type: CHARGE`) records the amount, method and status.

`PROMPTPAY` works differently, see below.

## PromptPay QR

Paying a session or topping up with `PROMPTPAY` does not move money yet. It
returns `202` with a `PENDING` payment and a QR:

```json
{ "payment": { "id": 812, "status": "PENDING", ... },
  "promptpay": { "payload": "000201010212...6304ABCD", "amount": 64.47,
                 "recipient": "xxxxxx0000", "isDemoRecipient": true } }
```

`payload` is a dynamic EMVCo PromptPay payload: tag 29 holds the PromptPay
application id and the recipient, tag 54 the exact amount with 2 decimals,
and tag 63 a CRC-16/CCITT checksum. Asking again for the same session and
amount returns the same pending payment.

`POST /api/payments/{id}/confirm` stands in for the bank's confirmation (the
"ยืนยันการชำระ" button). In one transaction it marks the payment `PAID` and
either settles the session or credits the wallet. Only the payer can confirm
(others get `404`), and only once (`409` after that). A ฿0.00 session settles
without a QR.

The recipient comes from the `PROMPTPAY_ID` environment variable only (a
phone number, national/tax ID or e-wallet ID; see `.env.example`). Unset, it
falls back to 000-000-0000, which no bank accepts, and the response says
`isDemoRecipient: true`.

## Receipts

Every `Payment` row is a receipt. `GET /api/payments/{id}` returns
`{ receipt: { receiptNo, payment, customer, session } }`, where `receiptNo`
is `VG-<Bangkok date YYYYMMDD>-<payment id, 6 digits>` and `session` (station,
charger, kWh, rate, times) is `null` for a top-up. The printable page is
`/receipts/{id}`: it has a print stylesheet, so the browser's Print dialog
can save it as an A4 PDF.

Only the payer and `ADMIN` users can open a receipt. Anyone else, operators
included, gets `404` from both the API and the page, so receipt ids cannot be
probed. Sessions carry `receiptId`, the payment that settled them.

## Wallet top-up

`POST /api/wallet/topup` with `CREDIT_CARD` increments the balance and writes
a `Payment` row (`type: TOPUP`, `status: PAID`) in one transaction, then sends
a `PAYMENT` notification. No card provider is connected yet, so card top-ups
are approved immediately. With `PROMPTPAY` it returns a QR and the wallet is
credited on confirm. The page is `/wallet`.

The frontend never hardcodes data: every page fetches through
`src/lib/api-client.ts`, and every dashboard figure is aggregated from the
database in `src/server/stats.ts`.

See also: [architecture](architecture.md) for how auth guards these routes,
[deployment](deployment.md) for `GET /api/health`.
