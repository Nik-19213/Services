require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const notifyRouter = require("./src/routes/notify");
const subscribeRouter = require("./src/routes/subscribe");
const { apiKeyGuard } = require("./src/middleware/validate");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(apiKeyGuard);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "notification-service",
    timestamp: new Date().toISOString(),
    channels: {
      push:  !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      email: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
    },
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
// Expose VAPID public key so the React app can subscribe
app.get("/vapid-public-key", (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(500).json({ error: "VAPID_PUBLIC_KEY not configured" });
  res.json({ key });
});

app.use("/subscribe", subscribeRouter);
app.use("/notify", notifyRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[Unhandled]", err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Notification service running on http://localhost:${PORT}`);
  console.log(`  Push channel:  ${process.env.VAPID_PUBLIC_KEY ? "configured" : "NOT configured — run node generate-vapid-keys.js"}`);
  console.log(`  API key guard: ${process.env.API_KEY ? "enabled" : "disabled (open)"}`);
});
