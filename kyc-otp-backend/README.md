# kyc-otp-backend

Phone verification (OTP) and identity verification (KYC) backend. A user submits their phone
number, receives an SMS (or call/WhatsApp) code, submits the code back, and the backend
confirms it against Twilio. Once OTP-verified, the user can be sent through a hosted
[Didit](https://didit.me) session for document/liveness identity verification, with results
delivered back via webhook.

## Stack

- Node.js (>=18, for native `fetch`) + TypeScript + Express
- [Twilio Verify](https://www.twilio.com/docs/verify) for OTP generation, delivery, and checking
- [Didit](https://docs.didit.me) for identity verification (document scan, liveness, decision)
- PostgreSQL for verification/session state (see [Storage](#storage))
- `pino` structured logging, `helmet` + `cors` for HTTP hardening, fail-fast env validation

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your credentials:
   ```
   cp .env.example .env
   ```
   - `DATABASE_URL` — Postgres connection string. For local dev, point it at a local Postgres instance or a free hosted one (Neon, Supabase). Set `DATABASE_SSL=true` for managed providers that require it.
   - `CORS_ORIGINS` — comma-separated browser origins allowed to call this API in production (leave empty in dev to allow all).
   - `TRUST_PROXY` — set `true` only when running behind a reverse proxy/load balancer (nginx, Render, Fly, Heroku, ALB), so rate limiting reads the real client IP.

   Get these from the [Twilio Console](https://console.twilio.com):
   - `TWILIO_ACCOUNT_SID` — Account SID
   - `TWILIO_AUTH_TOKEN` — Auth Token
   - `TWILIO_VERIFY_SERVICE_SID` — create a Verify Service under Verify > Services, use its SID

   Get these from the [Didit Business Console](https://business.didit.me):
   - `DIDIT_API_KEY` — API key for creating sessions
   - `DIDIT_WORKFLOW_ID` — the verification workflow to run (document, liveness, etc. are configured per-workflow in the console)
   - `DIDIT_WEBHOOK_SECRET_KEY` — shown once when you create a webhook destination pointing at `POST /api/kyc/webhook` on your publicly reachable URL (use a tunnel like ngrok in dev)
   - `DIDIT_CALLBACK_URL` — where Didit redirects the user's browser after they finish the hosted flow (a page in your frontend, not this API)

   The server validates all required env vars at startup and refuses to boot if any are missing, listing exactly which ones.
3. Create the database tables:
   ```
   npm run build
   npm run migrate
   ```
   This applies the SQL files in `src/db/migrations/`, tracking what's been applied in a `schema_migrations` table, so it's safe to re-run on every deploy.
4. Run the dev server:
   ```
   npm run dev
   ```
   Server starts on `http://localhost:3000` (or `PORT` from `.env`). It auto-restarts on file changes.

For production: `npm run build` (compiles to `dist/` and copies migration SQL alongside it), `npm run migrate`, then `npm start`. See [Docker](#docker) for a containerized setup.

**Never commit `.env`** — it holds live credentials. It's already gitignored.

## API

All endpoints are mounted under `/api/otp`. Phone numbers must be in **E.164 format**
(`+` + country code + number, no spaces or dashes), e.g. `+919808107022`.

### `POST /api/otp/send`

Sends a verification code to a phone number.

Request:
```json
{ "phoneNumber": "+919808107022" }
```

Response:
```json
{ "success": true, "message": "OTP sent successfully", "status": "pending" }
```

Rate limited to 5 requests per phone number per 15 minutes.

### `POST /api/otp/verify`

Checks a code the user entered.

Request:
```json
{ "phoneNumber": "+919808107022", "code": "123456" }
```

Response (success):
```json
{ "success": true, "verified": true, "message": "Phone number verified successfully" }
```

Response (wrong/expired code, HTTP 400):
```json
{ "success": false, "verified": false, "message": "Invalid or expired code" }
```

Rate limited to 10 attempts per phone number per 15 minutes. On success, the phone number
is marked verified in the store (see below).

### `GET /api/otp/status/:phoneNumber`

Looks up whether a phone number has been verified. The `+` in the phone number must be
URL-encoded as `%2B` in the path.

```
GET /api/otp/status/%2B919808107022
```

Response:
```json
{
  "success": true,
  "phoneNumber": "+919808107022",
  "verified": true,
  "verifiedAt": "2026-07-02T08:34:50.487Z"
}
```

### `GET /health`

Basic liveness check, returns `{ "status": "ok" }`.

### `POST /api/kyc/session`

Starts a Didit identity verification session for a phone number that has already
completed OTP verification (`403` if it hasn't).

Request:
```json
{ "phoneNumber": "+919808107022" }
```

Response:
```json
{
  "success": true,
  "message": "KYC session created",
  "sessionId": "017188a2-...",
  "url": "https://verify.didit.me/session/017188a2-...",
  "status": "NOT_STARTED"
}
```

Redirect the user's browser to `url` to complete the hosted verification flow (document
upload, liveness check, etc., depending on the configured workflow). Rate limited to 5
requests per phone number per 15 minutes.

### `GET /api/kyc/status/:phoneNumber`

Looks up the latest known KYC status for a phone number. Normally kept fresh by the
webhook below, but if the status isn't terminal yet (e.g. no webhook is configured, as
in local dev without a public URL), this endpoint polls Didit directly instead — so you
can test the full flow without setting up a webhook first. `phoneNumber` must be
URL-encoded.

```
GET /api/kyc/status/%2B919808107022
```

Response:
```json
{
  "success": true,
  "phoneNumber": "+919808107022",
  "status": "APPROVED",
  "sessionId": "017188a2-...",
  "updatedAt": "2026-07-03T09:12:04.101Z"
}
```

`status` is one of `NOT_STARTED`, `IN_PROGRESS`, `IN_REVIEW`, `APPROVED`, `DECLINED`,
`RESUBMITTED`, `ABANDONED`, `EXPIRED` (see [Didit's status reference](https://docs.didit.me/reference/verification-statuses)).
Didit's actual API/webhooks send these in Title Case (`"Not Started"`, `"Approved"`) rather
than this format; `normalizeStatus()` in `diditService.ts` converts them at the boundary so
everything downstream sees one consistent format.

### `POST /api/kyc/webhook`

Not called by your frontend — configure this URL as a webhook destination in the Didit
console. Didit posts here on every status change; the handler verifies the `X-Signature`
HMAC-SHA256 header (computed over the raw request body with `DIDIT_WEBHOOK_SECRET_KEY`)
and an `X-Timestamp` header (rejecting anything older than 5 minutes) before trusting the
payload, then updates the stored status for that session/phone number.

## Manual testing commands

**PowerShell:**
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/otp/send `
  -ContentType "application/json" -Body '{"phoneNumber":"+919808107022"}'

Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/otp/verify `
  -ContentType "application/json" -Body '{"phoneNumber":"+919808107022","code":"123456"}'

Invoke-RestMethod -Uri "http://localhost:3000/api/otp/status/%2B919808107022"
```

**curl (Git Bash / WSL):**
```bash
curl -X POST http://localhost:3000/api/otp/send \
  -H "Content-Type: application/json" -d '{"phoneNumber":"+919808107022"}'

curl -X POST http://localhost:3000/api/otp/verify \
  -H "Content-Type: application/json" -d '{"phoneNumber":"+919808107022","code":"123456"}'

curl "http://localhost:3000/api/otp/status/%2B919808107022"

curl -X POST http://localhost:3000/api/kyc/session \
  -H "Content-Type: application/json" -d '{"phoneNumber":"+919808107022"}'

curl "http://localhost:3000/api/kyc/status/%2B919808107022"
```

## Project structure

```
src/
  server.ts               Express app entry point, middleware, graceful shutdown
  config/
    env.ts                 Fail-fast environment variable validation
  logger.ts                Structured (pino) logger
  db/
    pool.ts                Postgres connection pool
    migrate.ts              Migration runner
    migrations/             SQL migration files, applied in filename order
  routes/
    otpRoutes.ts            /api/otp/send, /verify, /status/:phoneNumber
    kycRoutes.ts            /api/kyc/session, /webhook, /status/:phoneNumber
  services/
    otpService.ts           Twilio Verify client calls
    diditService.ts         Didit session creation, decision fetch, webhook signature check
    store.ts                Phone (OTP) verification store (Postgres)
    kycStore.ts             Didit KYC status store (Postgres)
  types/
    index.ts                Shared request/response types
```

## Storage

`src/services/store.ts` and `src/services/kycStore.ts` are backed by PostgreSQL
(`src/db/pool.ts`). Schema is managed by the plain-SQL migrations in
`src/db/migrations/`, applied via `npm run migrate`. Each phone number can accumulate
multiple KYC sessions over time (e.g. resubmission flows); `getKycRecordByPhoneNumber`
returns the most recently created one.

Run against a single Postgres instance (a managed one with its own HA/backups is
recommended for production). The current build assumes a single app instance — rate
limiting is in-process, so if you later scale to multiple instances behind a load
balancer, move rate limiting to a shared store (e.g. Redis via `rate-limit-redis`) so
limits apply across all of them.

## Docker

A multi-stage `Dockerfile` builds a minimal production image (compiles TypeScript,
installs only production dependencies, runs as a non-root user, exposes a `/health`
healthcheck):

```bash
docker build -t kyc-otp-backend .
docker run --rm --env-file .env -p 3000:3000 kyc-otp-backend
```

Migrations are not run automatically on container start — run them once as a separate
step against your database before starting (or rolling) app instances:

```bash
docker run --rm --env-file .env kyc-otp-backend node dist/db/migrate.js
```

## Testing the full flow locally (real SMS + real Didit verification)

This walks through exercising the entire OTP → KYC → webhook flow for real: an actual SMS
via Twilio, an actual Didit verification session, and an actual webhook call landing back
on your machine.

### 1. Start the server

```bash
npm run dev
```

Confirm it's up:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

### 2. Expose it publicly with ngrok

Didit's servers need a public URL to call `POST /api/kyc/webhook` — they can't reach
`localhost` directly. [Install ngrok](https://ngrok.com/download) if you haven't, then:

```bash
ngrok http 3000
```

Copy the `Forwarding` URL it prints, e.g. `https://abc123.ngrok-free.dev -> http://localhost:3000`.
**Keep this terminal window open** for the rest of the test — closing it kills the tunnel.

### 3. Register the webhook in the Didit console

1. Log into [business.didit.me](https://business.didit.me).
2. Go to the webhook/integration settings for your workflow.
3. Add a webhook destination: `https://<your-ngrok-subdomain>.ngrok-free.dev/api/kyc/webhook`
4. Copy the secret it shows you (**shown only once**) into `DIDIT_WEBHOOK_SECRET_KEY` in `.env`.
5. Restart the dev server so it picks up the new secret (see the gotcha below — a plain
   `.env` edit is not enough on its own).

### 4. Run the flow

```bash
# 1. Send a real OTP to your own phone number
curl -X POST http://localhost:3000/api/otp/send \
  -H "Content-Type: application/json" -d '{"phoneNumber":"+919808107022"}'

# 2. Verify it with the code you actually received by SMS
curl -X POST http://localhost:3000/api/otp/verify \
  -H "Content-Type: application/json" -d '{"phoneNumber":"+919808107022","code":"123456"}'

# 3. Create a KYC session
curl -X POST http://localhost:3000/api/kyc/session \
  -H "Content-Type: application/json" -d '{"phoneNumber":"+919808107022"}'
# → returns { "url": "https://verify.didit.me/session/...", ... }
```

4. Open the returned `url` in a browser and complete the hosted verification (document
   upload, liveness check).
5. Once done, Didit calls your webhook automatically. Confirm it landed:

```bash
curl "http://localhost:3000/api/kyc/status/%2B919808107022"
```

You should see `"status": "APPROVED"` (or `DECLINED`, depending on the outcome), updated
by the real webhook call — not by polling.

### Gotchas

- **ngrok's free-tier subdomain changes every time you restart it.** If you restart ngrok,
  you must go back to the Didit console and update the webhook URL to the new subdomain —
  the old one will silently stop receiving calls.
- **`ts-node-dev` can leave an orphaned server process holding port 3000.** Stopping the dev
  server (Ctrl+C, or killing the terminal) doesn't always kill its spawned child process. If
  a restart seems to ignore a `.env` change, or `npm run dev` fails with `EADDRINUSE`, find
  and kill the leftover process first:
  ```bash
  netstat -ano | grep ":3000" | grep LISTENING   # note the PID in the last column
  taskkill //PID <pid> //F
  ```
- **`.env` changes require a real restart**, not just a file save — `dotenv` only reads
  the file once, at process startup. `ts-node-dev`'s file watcher only reacts to changes
  under `src/`, so editing `.env` alone won't trigger a restart at all.
