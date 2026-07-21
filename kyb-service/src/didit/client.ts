import { config } from "../config.js";
import type { CreateKybSessionRequest, CreateKybSessionResponse, SessionDecision } from "./types.js";

class DiditApiError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    super(`Didit API error (${status}): ${JSON.stringify(body)}`);
  }
}

async function diditFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.didit.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.didit.apiKey,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new DiditApiError(res.status, await res.json().catch(() => null));
  }
  return res.json() as Promise<T>;
}

// Starts a hosted KYB (Business Verification) session for one organization.
// `vendorData` should be the org's on-chain address -- it round-trips through
// every webhook event so we can look the session back up without needing
// Didit's session_id ahead of time.
export async function createKybSession(params: {
  orgAddress: string;
  companyName?: string;
  registrationNumber?: string;
  countryCode?: string;
}): Promise<{ sessionId: string; verificationUrl: string }> {
  const body: CreateKybSessionRequest = {
    workflow_id: config.didit.kybWorkflowId,
    vendor_data: params.orgAddress,
    callback_url: config.didit.callbackUrl,
    expected_details:
      params.companyName || params.registrationNumber || params.countryCode
        ? {
            company_name: params.companyName,
            registration_number: params.registrationNumber,
            country_code: params.countryCode,
          }
        : undefined,
  };

  const response = await diditFetch<CreateKybSessionResponse>("/session/", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const verificationUrl = response.url ?? response.verification_url;
  if (!verificationUrl) {
    throw new Error("Didit create-session response contained no redirect URL (checked both `url` and `verification_url`)");
  }
  return { sessionId: response.session_id, verificationUrl };
}

export async function getSessionDecision(sessionId: string): Promise<SessionDecision> {
  return diditFetch<SessionDecision>(`/session/${sessionId}/decision/`);
}
