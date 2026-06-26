import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const EXISTING_PAID_DIAGNOSIS_CODE = "existing_paid_diagnosis";

export const DEFAULT_STALE_UNPAID_MS = 24 * 60 * 60 * 1000;

export type DiagnosisEligibilityRow = {
  id: string;
  secret_slug: string;
  status: string;
  mp_payment_id: string | null;
  payer_email: string | null;
  created_at?: string;
};

export type DiagnosisReportRow = {
  analysis_json: unknown | null;
};

export type ExistingPaidDiagnosisPayload = {
  code: typeof EXISTING_PAID_DIAGNOSIS_CODE;
  error: string;
  diagnosis_id: string;
  secret_slug: string;
  status: string;
  resume_path: string;
};

export function normalizePayerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isDiagnosisFulfilled(
  row: Pick<DiagnosisEligibilityRow, "status">,
  report: DiagnosisReportRow | null | undefined,
): boolean {
  return row.status === "completed" && report?.analysis_json != null;
}

/** Pick the newest paid diagnosis for this email that still owes a report. */
export function pickOpenPaidDiagnosis(
  rows: DiagnosisEligibilityRow[],
  reportsByDiagnosisId: Map<string, DiagnosisReportRow | null>,
): DiagnosisEligibilityRow | null {
  for (const row of rows) {
    if (!row.mp_payment_id) continue;
    const report = reportsByDiagnosisId.get(row.id) ?? null;
    if (!isDiagnosisFulfilled(row, report)) return row;
  }
  return null;
}

export function buildExistingPaidDiagnosisPayload(
  row: Pick<DiagnosisEligibilityRow, "id" | "secret_slug" | "status">,
): ExistingPaidDiagnosisPayload {
  return {
    code: EXISTING_PAID_DIAGNOSIS_CODE,
    error:
      "Você já tem um diagnóstico pago em andamento. Continue de onde parou sem pagar novamente.",
    diagnosis_id: row.id,
    secret_slug: row.secret_slug,
    status: row.status,
    resume_path: `/obrigado?d=${row.id}&s=${row.secret_slug}`,
  };
}

async function fetchReportsMap(
  sb: SupabaseClient,
  diagnosisIds: string[],
): Promise<Map<string, DiagnosisReportRow | null>> {
  const map = new Map<string, DiagnosisReportRow | null>();
  if (diagnosisIds.length === 0) return map;

  const { data, error } = await sb
    .from("diagnosis_reports")
    .select("diagnosis_id, analysis_json")
    .in("diagnosis_id", diagnosisIds);

  if (error) {
    console.error("buyer-diagnosis-eligibility: reports lookup failed", error);
    for (const id of diagnosisIds) map.set(id, null);
    return map;
  }

  for (const id of diagnosisIds) map.set(id, null);
  for (const row of data ?? []) {
    const id = (row as { diagnosis_id: string }).diagnosis_id;
    map.set(id, {
      analysis_json: (row as { analysis_json: unknown | null }).analysis_json,
    });
  }
  return map;
}

export async function findOpenPaidDiagnosisForEmail(
  sb: SupabaseClient,
  email: string,
): Promise<DiagnosisEligibilityRow | null> {
  const normalized = normalizePayerEmail(email);
  if (!normalized) return null;

  const { data, error } = await sb
    .from("diagnoses")
    .select("id, secret_slug, status, mp_payment_id, payer_email, created_at")
    .not("mp_payment_id", "is", null)
    .ilike("payer_email", normalized)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("buyer-diagnosis-eligibility: paid lookup failed", error);
    return null;
  }

  const rows = (data ?? []) as DiagnosisEligibilityRow[];
  if (rows.length === 0) return null;

  const reports = await fetchReportsMap(
    sb,
    rows.map((r) => r.id),
  );
  return pickOpenPaidDiagnosis(rows, reports);
}

export async function findStaleUnpaidDiagnosis(
  sb: SupabaseClient,
  email: string,
  maxAgeMs: number = DEFAULT_STALE_UNPAID_MS,
): Promise<DiagnosisEligibilityRow | null> {
  const normalized = normalizePayerEmail(email);
  if (!normalized) return null;

  const since = new Date(Date.now() - maxAgeMs).toISOString();
  const { data, error } = await sb
    .from("diagnoses")
    .select("id, secret_slug, status, mp_payment_id, payer_email, created_at")
    .eq("status", "awaiting_payment")
    .is("mp_payment_id", null)
    .ilike("payer_email", normalized)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("buyer-diagnosis-eligibility: stale unpaid lookup failed", error);
    return null;
  }

  return (data as DiagnosisEligibilityRow | null) ?? null;
}

export async function assertNoConflictingOpenPaidDiagnosis(
  sb: SupabaseClient,
  email: string,
  diagnosisId: string,
): Promise<ExistingPaidDiagnosisPayload | null> {
  const open = await findOpenPaidDiagnosisForEmail(sb, email);
  if (!open || open.id === diagnosisId) return null;
  return buildExistingPaidDiagnosisPayload(open);
}
