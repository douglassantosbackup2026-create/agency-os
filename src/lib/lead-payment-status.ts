import { callDiagnosisApi } from "@/lib/diagnosis-api";

export type LeadPaymentStatus = {
  status: string;
  amount_cents: number | null;
  paid_at: string | null;
  payment_method?: string | null;
  lead?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    payer_cpf?: string | null;
    store_name?: string | null;
    website?: string | null;
  };
  pix?: {
    qr_code: string;
    qr_code_base64: string;
    expires_at?: string | null;
  } | null;
  subscription?: {
    status: string;
    next_payment_date: string | null;
    cancelled_at: string | null;
  } | null;
};

export async function fetchLeadPaymentStatus(
  leadId: string,
  accessSlug: string,
): Promise<LeadPaymentStatus> {
  const res = await callDiagnosisApi<LeadPaymentStatus>("lead-payment-status", {
    method: "GET",
    query: { lead: leadId, s: accessSlug },
  });
  return res;
}
