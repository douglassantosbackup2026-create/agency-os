import { assertDiagnosisSecret } from "./diagnosis/validate-diagnosis-access.ts";
import { diagnosisServiceClient } from "./diagnosis/service.ts";
import { isManagementCtaEligible } from "./diagnosis/management-eligibility.ts";
import { managementPriceCents } from "./mp-transparent-payment.ts";

export function trimStr(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return null;
  const t = typeof v === "string" ? v.trim() : String(v).trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

export type ManagementCheckoutGate =
  | { ok: true; diagnosisId: string; secretSlug: string }
  | { ok: false; status: number; message: string };

export async function assertManagementCheckoutReady(
  diagnosisId: string,
  secretSlug: string,
  businessName: string | null,
  website: string | null,
  instagram: string | null,
): Promise<ManagementCheckoutGate> {
  if (!businessName || !website || !instagram) {
    return {
      ok: false,
      status: 400,
      message: "Nome da loja, site e Instagram são obrigatórios",
    };
  }

  const gate = await assertDiagnosisSecret(diagnosisId, secretSlug);
  if (!gate.ok) {
    return { ok: false, status: gate.status, message: gate.message };
  }

  const sb = diagnosisServiceClient();
  const { data: diag, error: dErr } = await sb
    .from("diagnoses")
    .select("id, secret_slug, status, management_status")
    .eq("id", diagnosisId)
    .maybeSingle();

  if (dErr || !diag) {
    console.error(dErr);
    return { ok: false, status: 404, message: "Diagnóstico não encontrado" };
  }

  if ((diag.status as string) !== "completed") {
    return { ok: false, status: 403, message: "Diagnóstico ainda não concluído" };
  }

  if ((diag.management_status as string | null) === "paid") {
    return { ok: false, status: 400, message: "Gestão já paga neste diagnóstico" };
  }

  const { data: rep } = await sb
    .from("diagnosis_reports")
    .select("facts_json")
    .eq("diagnosis_id", diagnosisId)
    .maybeSingle();

  if (!isManagementCtaEligible(rep?.facts_json)) {
    return { ok: false, status: 403, message: "Conta não elegível para gestão" };
  }

  return { ok: true, diagnosisId, secretSlug };
}

export function managementStartUpdateFields(
  businessName: string,
  website: string,
  instagram: string,
): Record<string, unknown> {
  return {
    management_business_name: businessName,
    management_website: website,
    management_instagram: instagram,
    management_status: "awaiting_payment",
    management_amount_cents: managementPriceCents(),
    management_mp_payment_id: null,
    management_mp_preference_id: null,
    management_pix_qr_code: null,
    management_pix_qr_code_base64: null,
    management_pix_expires_at: null,
    management_payment_method: null,
  };
}
