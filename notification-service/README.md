# Notification Service

A Web Push notification microservice for wallet-based apps. A React (or any) frontend subscribes a browser to push notifications for a wallet address; other services then trigger pushes to that address via a simple REST API.

## Features

- **Web Push** via VAPID (`web-push`) — no third-party push provider needed
- **Wallet-address-keyed subscriptions** — in-memory store of `address → PushSubscription`
- **Optional API key** guard for securing the service
- **Health check** endpoint
- Auto-removes subscriptions that have expired (HTTP 410 from the push service)

## Setup

```bash
cd notification-service
npm install
node generate-vapid-keys.js   # generates VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
# copy the generated keys (and set VAPID_EMAIL, PORT, API_KEY) into .env
node server.js
```

The service starts at `http://localhost:4000` by default (configurable via `PORT` in `.env`).

---

## API Reference

### GET /health
Check if the service is running and whether the push channel is configured.

**Response:**
```json
{
  "status": "ok",
  "service": "notification-service",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "channels": { "push": true }
}
```

---

### GET /vapid-public-key
Returns the VAPID public key so a frontend can subscribe via the Push API.

**Response:**
```json
{ "key": "BF32IXqtbIS0..." }
```

---

### POST /subscribe
Register a browser's push subscription against a wallet address. Called by the frontend after the user grants notification permission.

**Body:**
```json
{
  "address": "0xabc123...",
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": { "p256dh": "...", "auth": "..." }
  }
}
```

**Response:**
```json
{ "success": true, "message": "Subscribed" }
```

### DELETE /subscribe
Remove a wallet address's push subscription (e.g. when the user revokes permission).

**Body:**
```json
{ "address": "0xabc123..." }
```

---

### POST /notify/push
Send a push notification to a wallet address that has an active subscription.

**Body:**
```json
{
  "address": "0xabc123...",
  "title": "Funds received",
  "body": "0.5 ETH sent to you.",
  "data": { "txHash": "0x..." }
}
```
`data` is optional — forwarded as-is to the service worker.

**Response:**
```json
{ "success": true, "channel": "push", "address": "0xabc123..." }
```

If there's no subscription for the address: `404`. If the push subscription has expired, it's removed automatically and the response is `410`.

---

## Security — API Key

Set `API_KEY` in `.env` to protect the service. Every request must then include:
```
X-Api-Key: your-secret-key
```
Leave `API_KEY` empty to disable the guard (useful for internal/private networks).

---

## Integrating from another project

```js
const NOTIFY_URL = "http://localhost:4000";
const API_KEY    = process.env.NOTIFY_API_KEY; // optional

async function notifyPush(address, title, body, data = {}) {
  const res = await fetch(`${NOTIFY_URL}/notify/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "X-Api-Key": API_KEY } : {}),
    },
    body: JSON.stringify({ address, title, body, data }),
  });
  return res.json();
}

await notifyPush("0xabc123...", "Funds received", "0.5 ETH sent to you.");
```

From the frontend, subscribe a browser to push:

```js
const { key } = await fetch(`${NOTIFY_URL}/vapid-public-key`).then(r => r.json());
const registration = await navigator.serviceWorker.ready;
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: key,
});

await fetch(`${NOTIFY_URL}/subscribe`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ address: walletAddress, subscription }),
});
```

---

## Testing with curl

```bash
# Health
curl http://localhost:4000/health

# Get VAPID public key
curl http://localhost:4000/vapid-public-key

# Subscribe (subscription object comes from the browser's Push API)
curl -X POST http://localhost:4000/subscribe \
  -H "Content-Type: application/json" \
  -d '{"address":"0xabc123","subscription":{"endpoint":"https://...","keys":{"p256dh":"...","auth":"..."}}}'

# Send a push notification
curl -X POST http://localhost:4000/notify/push \
  -H "Content-Type: application/json" \
  -d '{"address":"0xabc123","title":"Test","body":"Hello from notification service"}'
```

---

## Project Structure

```
notification-service/
  server.js                     — Express entry point, health check, VAPID key endpoint
  generate-vapid-keys.js        — One-off script to generate VAPID key pair
  src/
    channels/
      push.js                   — web-push sender (VAPID)
    routes/
      subscribe.js               — POST/DELETE /subscribe
      notify.js                  — POST /notify/push
    store/
      subscriptions.js          — In-memory address → PushSubscription map
    middleware/
      validate.js               — API key guard, field validation
  .env                          — PORT, VAPID_*, API_KEY
  package.json
```
