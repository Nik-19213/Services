const { Router } = require("express");
const { save, remove } = require("../store/subscriptions");

const router = Router();

// ── POST /subscribe ───────────────────────────────────────────────────────────
// Called by the React app after the user grants notification permission.
// Body: { address: "0x...", subscription: { endpoint, keys: { p256dh, auth } } }
router.post("/", (req, res) => {
  const { address, subscription } = req.body;

  if (!address || typeof address !== "string") {
    return res.status(400).json({ success: false, error: "address is required" });
  }
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ success: false, error: "invalid subscription object" });
  }

  save(address, subscription);
  console.log(`[subscribe] registered push for ${address}`);
  res.json({ success: true, message: "Subscribed" });
});

// ── DELETE /subscribe ─────────────────────────────────────────────────────────
// Called when the user revokes notification permission.
// Body: { address: "0x..." }
router.delete("/", (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ success: false, error: "address is required" });
  remove(address);
  console.log(`[subscribe] removed push for ${address}`);
  res.json({ success: true, message: "Unsubscribed" });
});

module.exports = router;
