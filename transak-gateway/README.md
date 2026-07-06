# Transak Payment Gateway (Node.js / Express / PostgreSQL)

A backend service that lets your users buy and sell crypto with fiat by
integrating [Transak](https://transak.com). Transak itself hosts the actual
payment UI/KYC flow (as a widget your frontend embeds) — this backend's job
is everything around that: keeping your API secret safe, creating trackable
order records, verifying webhooks, and exposing a clean REST API to your
frontend.

## How it fits together

```
Your Frontend                Your Backend (this service)              Transak
     |                              |                                    |
     |  POST /widget/session ------>|                                    |
     |                              | create order (status=CREATED)     |
     |<---- widgetUrl/params -------|                                    |
     |                                                                   |
     |  open Transak widget (iframe or @transak/transak-sdk) ---------->|
     |                              user completes KYC + payment on Transak's hosted UI
     |                                                                   |
     |                              |<----- webhook: order status ------|
     |                              | verify signature, update DB       |
     |  GET /orders/:id  --------->|                                    |
     |<---- current status ---------|                                    |
```

Key point: **you never handle card details, bank info, or KYC yourself** —
Transak's widget does that. Your backend only tracks intent (order created)
and outcome (webhook says completed/failed/etc).

## Project layout

```
src/
  config/          env config + Postgres pool
  db/              schema.sql + migration runner
  middleware/      auth (JWT) + error handler
  services/        authService (signup/login), transakClient (Transak API wrapper), orderService (business logic)
  models/          userModel + orderModel (raw SQL queries)
  controllers/      auth / widget / order / price / webhook handlers
  routes/          Express routers
  server.js        app entrypoint
```

## Setup

1. **Get Transak credentials**: sign up at https://dashboard.transak.com,
   start in the **STAGING** environment, and grab your API Key + API Secret.
   Also set up a webhook endpoint in the dashboard once you've deployed this
   service (or exposed it via a tunnel like ngrok for local testing), and
   note the signing secret/header it gives you.

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # fill in TRANSAK_API_KEY, TRANSAK_API_SECRET, TRANSAK_WEBHOOK_SECRET,
   # TRANSAK_REFERRER_DOMAIN, DATABASE_URL, JWT_SECRET
   ```
   `TRANSAK_REFERRER_DOMAIN` must match a domain whitelisted for your API
   key under **Transak dashboard → your API key → Secure Widget URL** — the
   widget will reject sessions created with a non-whitelisted domain.

4. **Create the database and run the migration**
   ```bash
   createdb transak_gateway   # or create it however you normally do
   npm run migrate
   ```

5. **Run it**
   ```bash
   npm run dev     # nodemon, for local development
   npm start       # plain node, for production
   ```

## API

All endpoints below are prefixed with `/api/v1`. Endpoints marked (auth)
require `Authorization: Bearer <JWT>` — obtained from this service's own
`/auth/signup` or `/auth/login` (see `src/services/authService.js`). Swap
`src/middleware/auth.js` and the auth routes for however your project
actually authenticates requests if you'd rather delegate to an existing
auth system instead.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | no | Create a user account, returns `{ user, token }` |
| POST | `/auth/login` | no | Verify credentials, returns `{ user, token }` |
| POST | `/widget/session` | yes | Create an order record + mint a Transak widget URL for BUY or SELL |
| GET | `/orders` | yes | List the current user's orders |
| GET | `/orders/:partnerOrderId` | yes | Get one order |
| POST | `/orders/:partnerOrderId/sync` | yes | Force a refresh from Transak's API (in case a webhook was missed) |
| GET | `/prices/quote` | no | Proxy a price quote (fiat↔crypto conversion, fees) |
| GET | `/prices/currencies/crypto` | no | Supported crypto currencies |
| GET | `/prices/currencies/fiat` | no | Supported fiat currencies |
| POST | `/webhooks/transak` | n/a (signature-verified) | Receives order status updates from Transak |

`/auth/signup` and `/auth/login` are rate-limited more tightly than the rest
of the API (10 requests / 15 min per IP) to slow down credential-stuffing
attempts.

### Example: sign up and log in

```bash
curl -X POST http://localhost:4000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "a-strong-password"}'
# => { "user": {...}, "token": "<jwt>" }

curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "a-strong-password"}'
# => { "user": {...}, "token": "<jwt>" }
```

Use the returned `token` as `Authorization: Bearer <token>` on the
endpoints marked (auth) above.

### Example: start a BUY session

```bash
curl -X POST http://localhost:4000/api/v1/widget/session \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "BUY",
    "fiatCurrency": "USD",
    "fiatAmount": 100,
    "cryptoCurrency": "ETH",
    "network": "ethereum",
    "walletAddress": "0xUserWalletAddress"
  }'
```

Response gives you `widgetUrl` — open it in an iframe/webview or a new
tab. It's minted via Transak's create-widget-session API (see "Widget URL"
section below), so it's **short-lived (~5 min) and single-use** — request
a fresh one for each attempt rather than reusing an old response.

### Example: start a SELL session

Same endpoint, `"type": "SELL"` — `walletAddress` is required (it's where
Transak expects the user to send the crypto being sold from).

## Widget URL — must be minted server-side

Transak deprecated building the widget URL by hand as a query string.
`src/services/transakClient.js`'s `createWidgetSession()` calls Transak's
[create-widget-url API](https://docs.transak.com/api/public/create-widget-url)
(`POST {widgetApiBaseUrl}/api/v2/auth/session`, authenticated with the same
access token used for order lookups) and returns whatever `widgetUrl` it
gives back — this backend no longer constructs that URL itself.

Two things that will make this fail if misconfigured:
- **`TRANSAK_REFERRER_DOMAIN`** must match a domain whitelisted for your
  API key in the dashboard. A mismatched/unwhitelisted domain, or trying to
  open a hand-built (non-session) URL, is what produces Transak's generic
  *"Something went wrong with this transaction"* error.
- The returned `widgetUrl` embeds a **single-use session id that expires in
  about 5 minutes** — don't cache or reuse it; call `/widget/session` again
  for each new attempt.

`TRANSAK_WIDGET_API_BASE_URL_PRODUCTION` in `.env.example` is inferred by
pattern (`api-gateway.transak.com`) since Transak's docs didn't explicitly
confirm the production host as of when this was written — verify it before
going live.

## Webhooks — please read

Transak notifies this backend of order lifecycle events (created,
processing, completed, failed, etc.) via webhook, which is what actually
updates order status in your database.

`src/controllers/webhookController.js` verifies an HMAC-SHA256 signature
before trusting any payload, and logs every attempt (valid or not) to the
`webhook_events` table for auditing.

**Before going live, confirm these against your own Transak dashboard**,
since exact names can differ by account/API version and may have changed
since this was written:
- The header name the signature arrives in (`TRANSAK_WEBHOOK_SIGNATURE_HEADER`, defaults to `x-transak-webhook-signature`)
- The exact webhook payload shape / field names (the handler defensively
  checks a couple of common shapes, but check a real payload from your
  dashboard's webhook delivery logs)
- The event names Transak actually sends (e.g. `ORDER_COMPLETED`,
  `ORDER_FAILED`, `ORDER_PROCESSING` — check `docs.transak.com`)

For local testing, expose this service with a tunnel (e.g. `ngrok http
4000`) and register `https://<your-tunnel>/api/v1/webhooks/transak` in the
Transak staging dashboard.

## Security notes

- The Transak API secret and webhook secret only ever live server-side —
  never send them to the frontend.
- Webhook signature verification uses `crypto.timingSafeEqual` to avoid
  timing attacks.
- `partnerOrderId` is generated server-side per session, so a user can't
  spoof or guess another user's order id to poll its status (endpoints also
  check `order.user_id` matches the authenticated caller).
- Add HTTPS/TLS termination in front of this service in production (e.g.
  via your load balancer/reverse proxy) — Transak requires HTTPS webhook
  URLs for anything beyond local testing anyway.
- This was built against Transak's documented partner-API pattern as of
  early 2026. Third-party APIs change — skim `docs.transak.com` before
  going to production, particularly the exact endpoint paths in
  `src/services/transakClient.js` and the webhook shape above.

## Extending this

- This service now has its own minimal signup/login (`src/services/authService.js`,
  `src/controllers/authController.js`) issuing JWTs verified by
  `src/middleware/auth.js`. If you'd rather delegate to an existing auth
  system (session cookie, API gateway header, SSO, etc.), swap both the
  routes and the middleware.
- Consider adding password reset, email verification, and token revocation
  (JWTs currently can't be invalidated before their 7-day expiry) if this
  becomes the system of record for user accounts.
- Add idempotency handling if you expect webhook retries to arrive more than
  once (the current `UPDATE ... WHERE partner_order_id = $1` is naturally
  idempotent for status updates, so retries are safe as-is).
- If you need KYC status or limits before showing a BUY/SELL button, Transak
  exposes user-level endpoints too — same `transakClient.js` pattern applies.
