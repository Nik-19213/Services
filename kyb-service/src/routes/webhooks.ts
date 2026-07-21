import { Router } from "express";
import { verifyDiditWebhook } from "../didit/webhook.js";
import { processSessionUpdate } from "../services/kybService.js";
import type { DiditWebhookEnvelope } from "../didit/types.js";

export const webhooksRouter = Router();

webhooksRouter.post("/didit", async (req, res) => {
  const body = req.body as DiditWebhookEnvelope;

  if (!body.session_id) {
    // Non-session webhook types (e.g. future account-level events) -- ack
    // and ignore rather than erroring the whole endpoint.
    res.status(200).json({ received: true, ignored: true });
    return;
  }

  const verification = verifyDiditWebhook({
    signatureHeader: req.header("X-Signature-Simple"),
    timestampHeader: req.header("X-Timestamp"),
    sessionId: body.session_id,
    status: body.status,
    webhookType: body.webhook_type,
  });

  if (!verification.valid) {
    console.warn(`Rejected Didit webhook for session ${body.session_id}: ${verification.reason}`);
    res.status(401).json({ error: "invalid signature" });
    return;
  }

  try {
    const result = await processSessionUpdate(body.session_id, body.status);
    res.status(200).json({ received: true, ...result });
  } catch (err: any) {
    console.error(`Failed to process webhook for session ${body.session_id}:`, err.message);
    // Still 200 -- Didit will otherwise retry indefinitely for an error that
    // won't resolve itself (e.g. an org address we never registered).
    res.status(200).json({ received: true, error: err.message });
  }
});
