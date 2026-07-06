export interface SendOtpRequest {
  phoneNumber: string; // E.164 format, e.g. +14155552671
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  status?: string; // 'pending' | 'approved' | 'canceled' etc (from Twilio)
}

export interface VerifyOtpRequest {
  phoneNumber: string;
  code: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  verified: boolean;
  message: string;
}

export interface VerificationStatusResponse {
  success: boolean;
  phoneNumber: string;
  verified: boolean;
  verifiedAt?: string; // ISO timestamp of when the phone was last verified
}

// ---- Didit identity verification (KYC) ----

// https://docs.didit.me/reference/verification-statuses
export type DiditSessionStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'DECLINED'
  | 'RESUBMITTED'
  | 'ABANDONED'
  | 'EXPIRED';

export interface CreateKycSessionRequest {
  phoneNumber: string; // used as vendor_data to link this session back to the OTP-verified user
}

export interface CreateKycSessionResponse {
  success: boolean;
  message: string;
  sessionId?: string;
  url?: string; // hosted Didit verification URL to redirect the user to
  status?: DiditSessionStatus;
}

export interface KycStatusResponse {
  success: boolean;
  phoneNumber: string;
  status: DiditSessionStatus | 'NOT_STARTED';
  sessionId?: string;
  updatedAt?: string;
}

// Envelope Didit posts to the configured webhook URL on session/data updates.
export interface DiditWebhookPayload {
  event_id: string;
  webhook_type: string; // e.g. 'status.updated' | 'data.updated'
  timestamp: number;
  created_at: string;
  application_id: string;
  environment: 'live' | 'sandbox' | string;
  session_id: string;
  status: DiditSessionStatus;
  workflow_id?: string;
  workflow_version?: string;
  vendor_data?: string;
  metadata?: Record<string, unknown>;
  decision?: Record<string, unknown>;
}
