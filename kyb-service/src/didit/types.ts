// Field names below are taken from Didit's public docs (docs.didit.me) as of
// this writing. Two fields are flagged as unconfirmed in their raw JSON
// shape -- the create-session response's redirect-URL field name, and the
// sub-fields of `expected_details`. CreateSessionResponse and the parsing in
// client.ts handle both plausible spellings defensively; if Didit's actual
// response differs, only client.ts needs to change.

export type DiditSessionStatus =
  | "Not Started"
  | "In Progress"
  | "In Review"
  | "Approved"
  | "Declined"
  | "Awaiting User"
  | "Expired"
  | "Abandoned"
  | "Kyc Expired"
  | "Resubmitted";

export interface CreateKybSessionRequest {
  workflow_id: string;
  vendor_data: string;
  callback_url: string;
  expected_details?: {
    company_name?: string;
    registration_number?: string;
    country_code?: string;
  };
}

export interface CreateKybSessionResponse {
  session_id: string;
  url?: string;
  verification_url?: string;
}

export interface RegistryCheckCompany {
  company_name: string;
  registration_number: string;
  country_code: string;
  company_type?: string;
  incorporation_date?: string;
  registered_address?: string;
  risk_level?: string;
  officers?: unknown[];
  beneficial_owners?: unknown[];
}

export interface SessionDecision {
  session_id: string;
  session_kind: "user" | "business";
  session_number?: string;
  status: DiditSessionStatus;
  workflow_id: string;
  vendor_data?: string;
  metadata?: Record<string, unknown>;
  registry_checks?: Array<{
    node_id: string;
    status: string;
    company: RegistryCheckCompany;
  }>;
  key_people_checks?: Array<{
    node_id: string;
    status: string;
    ubo_kyc_summary?: { total: number; approved: number; flagged: number; pending: number };
  }>;
  aml_screenings?: unknown[];
}

export interface DiditWebhookEnvelope {
  event_id: string;
  webhook_type: string;
  timestamp: number;
  created_at: string;
  application_id: string;
  environment: string;
  status: DiditSessionStatus;
  session_id?: string;
  workflow_id?: string;
  vendor_data?: string;
  metadata?: Record<string, unknown>;
}
