import { callDiagnosisApi } from "@/lib/diagnosis-api";

export type LeadPaymentStatus = {
  status: string;
  amount_cents: number | null;
  paid_at: string | null;
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
