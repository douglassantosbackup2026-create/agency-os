import { diagnosisServiceClient } from "./diagnosis/service.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function leadPriceCents(): number {
  const n = parseInt(
    Deno.env.get("LEAD_MANAGEMENT_PRICE_CENTS") ??
      Deno.env.get("MANAGEMENT_PRICE_CENTS") ??
      "499700",
    10,
  );
  return Number.isFinite(n) && n > 0 ? n : 499700;
}

export function leadItemTitle(): string {
  const t = Deno.env.get("MANAGEMENT_MP_ITEM_TITLE")?.trim();
  return t || "Gestão de Tráfego Meta Ads — 3 vagas/mês";
}

export type LeadCheckoutGate =
  | { ok: true; leadId: string; accessSlug: string }
  | { ok: false; status: number; message: string };

export async function assertLeadCheckoutReady(
  leadId: string,
  accessSlug: string,
): Promise<LeadCheckoutGate> {
  if (!UUID_RE.test(leadId) || !accessSlug.trim()) {
    return { ok: false, status: 400, message: "lead inválido" };
  }

  const sb = diagnosisServiceClient();
  const { data: lead, error } = await sb
    .from("ecommerce_leads")
    .select("id, access_slug, status")
    .eq("id", leadId)
    .maybeSingle();

  if (error || !lead) {
    console.error(error);
    return { ok: false, status: 404, message: "Lead não encontrado" };
  }

  if ((lead.access_slug as string) !== accessSlug) {
    return { ok: false, status: 404, message: "Lead não encontrado" };
  }

  if ((lead.status as string) === "paid") {
    return { ok: false, status: 400, message: "Pagamento já confirmado para este lead" };
  }

  return { ok: true, leadId, accessSlug };
}

export function leadStartUpdateFields(): Record<string, unknown> {
  return {
    status: "awaiting_payment",
    amount_cents: leadPriceCents(),
    mp_payment_id: null,
    mp_preapproval_id: null,
    mp_preference_id: null,
    pix_qr_code: null,
    pix_qr_code_base64: null,
    pix_expires_at: null,
    payment_method: null,
  };
}
