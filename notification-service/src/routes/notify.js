const { Router } = require("express");
const { sendPush }  = require("../channels/push");
const { sendEmail } = require("../channels/email");
const { get: getSubscription, remove } = require("../store/subscriptions");
const { requireFields } = require("../middleware/validate");

const router = Router();

// ── POST /notify/push ─────────────────────────────────────────────────────────
// Body: { address: "0x...", title: "...", body: "..." }
router.post("/push", requireFields(["address", "title", "body"]), async (req, res) => {
  const { address, title, body, data } = req.body;

  const subscription = getSubscription(address);
  if (!subscription) {
    return res.status(404).json({ success: false, error: `No push subscription for ${address}` });
  }

  try {
    await sendPush(subscription, title, body, data || {});
    console.log(`[push] sent to ${address}`);
    res.json({ success: true, channel: "push", address });
  } catch (err) {
    console.error("[push]", err.message);
    if (err.statusCode === 410) {
      remove(address);
      return res.status(410).json({ success: false, error: "Subscription expired, removed" });
    }
    res.status(500).json({ success: false, channel: "push", error: err.message });
  }
});

// ── POST /notify/email ────────────────────────────────────────────────────────
// Body: { to: "alice@example.com", subject: "...", message: "...", html: "..." }
router.post("/email", requireFields(["to", "subject", "message"]), async (req, res) => {
  const { to, subject, message, html } = req.body;
  try {
    const result = await sendEmail(to, subject, message, html);
    console.log(`[email] sent to ${to}`);
    res.json({ success: true, channel: "email", ...result });
  } catch (err) {
    console.error("[email]", err.message);
    res.status(500).json({ success: false, channel: "email", error: err.message });
  }
});

module.exports = router;
