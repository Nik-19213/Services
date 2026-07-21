import express from "express";
import { config } from "./config.js";
import { organizationsRouter } from "./routes/organizations.js";
import { webhooksRouter } from "./routes/webhooks.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/organizations", organizationsRouter);
app.use("/webhooks", webhooksRouter);

app.listen(config.port, () => {
  console.log(`KYB service listening on :${config.port}`);
});
