import { Router } from "express";
import { startKyb, getKybStatus } from "../services/kybService.js";

export const organizationsRouter = Router();

// Starts a hosted Didit KYB session for a business and returns the URL the
// frontend should redirect the user to.
organizationsRouter.post("/:orgAddress/kyb", async (req, res) => {
  const { orgAddress } = req.params;
  const { companyName, registrationNumber, countryCode } = req.body ?? {};

  try {
    const result = await startKyb({ orgAddress, companyName, registrationNumber, countryCode });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

organizationsRouter.get("/:orgAddress/kyb", async (req, res) => {
  const sessions = await getKybStatus(req.params.orgAddress);
  res.json({ sessions });
});
