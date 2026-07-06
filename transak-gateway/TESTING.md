# Testing / Verifying This Project

Three ways to check things work: click through a browser test page
(easiest), or run commands yourself in PowerShell or bash/curl (this
file). All of them talk to your locally running server, so **start the
server first** and leave it running in its own terminal window:

```powershell
npm run dev
```

---

## Option A: Click-through test page (easiest)

Open [tools/manual-test.html](tools/manual-test.html) directly in your
browser (double-click the file, or right-click → Open with → Chrome/Edge).
Sign up, create an order, and it'll show you the real Transak widget URL —
no commands needed. See the "How to use it" walkthrough earlier in this
project's chat history, or just click the buttons top to bottom.

---

## Option B: Command-line checks (PowerShell)

Run these one at a time in a **second** PowerShell window (keep `npm run
dev` running in the first).

### 1. Is the server even up?

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/health"
```

Expect: `status : ok`

### 2. Sign up a test user

```powershell
$body = @{ email = "you@example.com"; password = "correcthorsebattery" } | ConvertTo-Json
$signup = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/auth/signup" -Method Post -ContentType "application/json" -Body $body
$signup
$token = $signup.token
```

Expect: a `user` object and a long `token` string. `$token` now holds it
for the next steps.

If you already signed up before and want to log in instead:

```powershell
$body = @{ email = "you@example.com"; password = "correcthorsebattery" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/auth/login" -Method Post -ContentType "application/json" -Body $body
$token = $login.token
```

### 3. Create an order (widget session)

```powershell
$orderBody = @{ type = "BUY"; cryptoCurrency = "ETH"; fiatCurrency = "USD"; fiatAmount = 50 } | ConvertTo-Json
$session = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/widget/session" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $orderBody
$session
```

Expect: `partnerOrderId` and `widgetUrl`. Copy `widgetUrl` into a browser
tab to see the actual Transak widget — note it's single-use and expires in
~5 minutes, so generate a fresh one for each attempt rather than reopening
an old one.

### 4. List your orders

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/orders" -Headers @{ Authorization = "Bearer $token" }
```

Expect: the order you just created, with `status: CREATED`.

### 5. Get one order by id

```powershell
$poid = $session.partnerOrderId
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/orders/$poid" -Headers @{ Authorization = "Bearer $token" }
```

### 6. Check public price/currency endpoints (no login needed)

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/prices/currencies/fiat"
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/prices/currencies/crypto"
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/prices/quote?fiatCurrency=USD&cryptoCurrency=ETH&fiatAmount=100"
```

Expect: real data pulled live from Transak's staging API. If these fail,
your `TRANSAK_API_KEY`/`TRANSAK_API_SECRET` in `.env` are likely wrong.

### 7. Confirm auth actually blocks unauthenticated requests

```powershell
try { Invoke-RestMethod -Uri "http://localhost:4000/api/v1/orders" } catch { $_.Exception.Response.StatusCode }
```

Expect: `Unauthorized` (401) — proves protected routes reject requests with
no token.

---

## Option C: Command-line checks (bash / Git Bash / curl)

Same checks as Option B, but with `curl` for anyone using Git Bash, WSL, or
a Linux/Mac terminal. There's no `jq` dependency assumed — a `grep`/`sed`
one-liner pulls fields out of the JSON response instead.

(An earlier version of this file used `node -e "..."` for this — on Git
Bash for Windows, invoking the native `node.exe` inside a `$(...)`
command substitution can silently fail with a `stdout is not a tty`
warning and leave the variable empty, which then shows up later as
`{"error":"Missing or malformed Authorization header"}`. The `grep`/`sed`
approach below avoids spawning `node` at all, so it doesn't hit that.)

Run these one at a time in a **second** terminal (keep `npm run dev`
running in the first).

### 1. Is the server even up?

```bash
curl -s http://localhost:4000/health
```

Expect: `{"status":"ok"}`

### 2. Sign up a test user

```bash
SIGNUP_RES=$(curl -s -X POST http://localhost:4000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"correcthorsebattery"}')
echo "$SIGNUP_RES"
TOKEN=$(echo "$SIGNUP_RES" | grep -o '"token":"[^"]*"' | head -1 | sed 's/.*:"//;s/"$//')
echo "TOKEN=[$TOKEN]"
```

Expect: a `user` object and a long `token` string in the response, and the
final `echo` should show a long non-empty string between the brackets —
**if it prints `TOKEN=[]` (empty), something went wrong upstream** (check
the `echo "$SIGNUP_RES"` line above it for an `{"error": ...}` instead of a
token, e.g. "Email already registered").

If you already signed up before and want to log in instead:

```bash
LOGIN_RES=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"correcthorsebattery"}')
echo "$LOGIN_RES"
TOKEN=$(echo "$LOGIN_RES" | grep -o '"token":"[^"]*"' | head -1 | sed 's/.*:"//;s/"$//')
echo "TOKEN=[$TOKEN]"
```

### 3. Create an order (widget session)

```bash
SESSION_RES=$(curl -s -X POST http://localhost:4000/api/v1/widget/session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"BUY","cryptoCurrency":"ETH","fiatCurrency":"USD","fiatAmount":50}')
echo "$SESSION_RES"
POID=$(echo "$SESSION_RES" | grep -o '"partnerOrderId":"[^"]*"' | head -1 | sed 's/.*:"//;s/"$//')
echo "POID=[$POID]"
```

If this prints `{"error":"Missing or malformed Authorization header"}`
instead of an order, `$TOKEN` is empty — re-check the `TOKEN=[...]` output
from step 2 above before continuing.

Expect: `partnerOrderId` and `widgetUrl`. Copy `widgetUrl` into a browser
tab to see the actual Transak widget — note it's single-use and expires in
~5 minutes, so generate a fresh one for each attempt rather than reopening
an old one.

### 4. List your orders

```bash
curl -s http://localhost:4000/api/v1/orders -H "Authorization: Bearer $TOKEN"
```

Expect: the order you just created, with `"status":"CREATED"`.

### 5. Get one order by id

```bash
curl -s http://localhost:4000/api/v1/orders/$POID -H "Authorization: Bearer $TOKEN"
```

### 6. Check public price/currency endpoints (no login needed)

```bash
curl -s http://localhost:4000/api/v1/prices/currencies/fiat
curl -s http://localhost:4000/api/v1/prices/currencies/crypto
curl -s "http://localhost:4000/api/v1/prices/quote?fiatCurrency=USD&cryptoCurrency=ETH&fiatAmount=100"
```

Expect: real data pulled live from Transak's staging API. If these fail,
your `TRANSAK_API_KEY`/`TRANSAK_API_SECRET` in `.env` are likely wrong.

### 7. Confirm auth actually blocks unauthenticated requests

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/v1/orders
```

Expect: `401` — proves protected routes reject requests with no token.

---

## Checking the database directly

If `psql` isn't recognized, use the full path instead, e.g.
`"C:\Program Files\PostgreSQL\17\bin\psql.exe"`.

**PowerShell:**

```powershell
$env:PGPASSWORD = "<your DB password from DATABASE_URL>"
psql -U postgres -h localhost -d transak_gateway -c "\dt"                 # list tables
psql -U postgres -h localhost -d transak_gateway -c "SELECT * FROM users;"
psql -U postgres -h localhost -d transak_gateway -c "SELECT * FROM orders;"
psql -U postgres -h localhost -d transak_gateway -c "SELECT * FROM webhook_events;"
```

**bash / Git Bash:**

```bash
PGPASSWORD='<your DB password from DATABASE_URL>' psql -U postgres -h localhost -d transak_gateway -c "\dt"
PGPASSWORD='<your DB password from DATABASE_URL>' psql -U postgres -h localhost -d transak_gateway -c "SELECT * FROM users;"
PGPASSWORD='<your DB password from DATABASE_URL>' psql -U postgres -h localhost -d transak_gateway -c "SELECT * FROM orders;"
PGPASSWORD='<your DB password from DATABASE_URL>' psql -U postgres -h localhost -d transak_gateway -c "SELECT * FROM webhook_events;"
```

---

## What you can't fully test yet

- **Real webhooks** — `TRANSAK_WEBHOOK_SECRET` is still a placeholder until
  your Transak KYB approval goes through, so Transak can't actually call
  your `/webhooks/transak` endpoint yet. The endpoint itself is already
  built and correctly rejects unsigned/invalid requests — there's just
  nothing live to send it a real one.
- **Visual widget rendering** — only a real browser can show you whether
  Transak's hosted BUY/SELL screen renders correctly for your API key
  (command-line tools can't run the JavaScript it depends on). Use the
  `widgetUrl` from step 3 above, or `tools/manual-test.html`.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `health` check fails / connection refused | Server isn't running — check the `npm run dev` terminal for errors |
| `401` on signup/login with correct password | `.env` missing or `JWT_SECRET` changed after tokens were issued (old tokens become invalid) |
| `500` on price/currency endpoints | `TRANSAK_API_KEY`/`TRANSAK_API_SECRET` wrong, or wrong `TRANSAK_ENVIRONMENT` for the key you have |
| Widget URL shows "Something went wrong with this transaction" | `TRANSAK_REFERRER_DOMAIN` doesn't match a domain whitelisted for your API key (dashboard → API key → Secure Widget URL), or you reused/waited too long on a `widgetUrl` — sessions are single-use and expire in ~5 minutes, request a fresh one |
| Orders endpoints fail with a DB error | `DATABASE_URL` wrong, Postgres not running, or `npm run migrate` was never run |
| `429 Too Many Requests` on login | You hit the login rate limit (10 attempts / 15 min) — wait or restart the server to reset it |
| Server logs `connect ECONNREFUSED 127.0.0.1:5432` (health check works, everything DB-related 500s) | You ran `npm run dev` **inside WSL**, but Postgres runs on Windows — WSL's own `127.0.0.1` is a separate network namespace with nothing listening on 5432. Run `npm run dev` from PowerShell or Git Bash instead (same host as Postgres), not from a WSL terminal. |
