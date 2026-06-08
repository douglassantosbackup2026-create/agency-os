/** Tipos e helpers do console Diagnóstico Meta em /platform-admin */

export type DiagnosisOpsSnapshot = {
  total_all_time: number;
  processing: number;
  stale_processing: number;
  awaiting_payment: number;
  awaiting_connection: number;
  awaiting_account_selection: number;
  completed_24h: number;
  failed_24h: number;
  management_paid_24h: number;
  captured_at: string;
};

export type DiagnosisFunnelRow = { status: string; cnt: number };

export type DiagnosisRecentRow = {
  id: string;
  secret_slug: string;
  status: string;
  management_status: string;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  payment_method: string | null;
  amount_cents: number;
  management_amount_cents: number;
  payer_email_masked: string | null;
  prompt_version: string | null;
  failed_reason_short: string | null;
  meta_connected: boolean;
  cta_clicked: boolean;
  funnel_age_minutes: number;
};

export type DiagnosisRevenueSummary = {
  days: number;
  checkout_started_count: number;
  diagnosis_paid_count: number;
  diagnosis_revenue_cents: number;
  management_paid_count: number;
  management_revenue_cents: number;
  completed_count: number;
  conversion_checkout_to_paid_pct: number;
  conversion_paid_to_completed_pct: number;
};

export type DiagnosisFailureCategory = {
  category: string;
  count: number;
  sample: string | null;
};

export type DiagnosisFailuresSummary = {
  days: number;
  categories: DiagnosisFailureCategory[];
  total_failed: number;
};

export type DiagnosisEnvStatus = {
  public_site_url_ok: boolean;
  mercadopago_access_token_ok: boolean;
  mercadopago_webhook_secret_ok: boolean;
  mercadopago_public_key_ok: boolean;
  meta_app_id_ok: boolean;
  meta_app_secret_ok: boolean;
  oauth_state_secret_ok: boolean;
  cron_secret_ok: boolean;
  anthropic_api_key_ok: boolean;
  gemini_api_key_ok: boolean;
};

export const DIAGNOSIS_STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  awaiting_connection: "Aguardando Meta",
  awaiting_account_selection: "Escolher conta",
  processing: "Processando",
  completed: "Concluído",
  failed: "Falhou",
};

export const FUNNEL_STATUS_ORDER = [
  "awaiting_payment",
  "awaiting_connection",
  "awaiting_account_selection",
  "processing",
  "completed",
  "failed",
] as const;

export const FAILURE_CATEGORY_LABELS: Record<string, string> = {
  meta_token: "Token Meta",
  meta_no_accounts: "Sem contas Meta",
  ai_providers: "IA / providers",
  operational_timeout: "Timeout operacional",
  payment: "Pagamento",
  other: "Outro",
};

export function diagnosisStatusLabel(status: string): string {
  return DIAGNOSIS_STATUS_LABELS[status] ?? status;
}

export function failureCategoryLabel(category: string): string {
  return FAILURE_CATEGORY_LABELS[category] ?? category;
}

export function centsToBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function diagnosisReportUrl(
  siteBase: string,
  id: string,
  secretSlug: string,
): string {
  const base = siteBase.replace(/\/+$/, "");
  return `${base}/diagnostico/${encodeURIComponent(id)}?s=${encodeURIComponent(secretSlug)}`;
}

export function categorizeFailureClient(reason: string | null | undefined): string {
  const r = reason ?? "";
  if (/token meta|reconect/i.test(r)) return "meta_token";
  if (/noadaccounts|conta meta|ad account/i.test(r)) return "meta_no_accounts";
  if (/providers ia falharam|orçamento diário de ia|configuração de ia/i.test(r)) {
    return "ai_providers";
  }
  if (/processamento expirou|timeout operacional/i.test(r)) {
    return "operational_timeout";
  }
  if (/pagamento|mercado pago|mp_/i.test(r)) return "payment";
  return "other";
}

export function canRetryDiagnosis(row: DiagnosisRecentRow): boolean {
  if (row.status !== "failed") return false;
  const cat = categorizeFailureClient(row.failed_reason_short);
  if (cat === "meta_token" || cat === "ai_providers") return false;
  return row.meta_connected;
}

export function exportDiagnosisCsv(rows: DiagnosisRecentRow[]): string {
  const header = [
    "id",
    "status",
    "management_status",
    "created_at",
    "payment_method",
    "amount_cents",
    "prompt_version",
    "meta_connected",
    "failed_reason",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.id,
      r.status,
      r.management_status,
      r.created_at,
      r.payment_method ?? "",
      String(r.amount_cents),
      r.prompt_version ?? "",
      r.meta_connected ? "yes" : "no",
      `"${(r.failed_reason_short ?? "").replace(/"/g, '""')}"`,
    ].join(","),
  );
  return [header, ...lines].join("\n");
}
