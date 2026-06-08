import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";

const DIAGNOSIS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function reconcileManagementWithMp(
  sb: ReturnType<typeof diagnosisServiceClient>,
  diagnosisId: string,
  mpPaymentId: string,
): Promise<string | null> {
  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) return null;
  try {
    const r = await fetch(
      `https://api.mercadopago.com/v1/payments/${mpPaymentId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { status?: string };
    if (j.status !== "approved") return null;

    await sb
      .from("diagnoses")
      .update({
        management_status: "paid",
        management_paid_at: new Date().toISOString(),
      })
      .eq("id", diagnosisId)
      .eq("management_status", "awaiting_payment");

    return "paid";
  } catch (e) {
    console.error("management-payment-status: MP reconcile failed", e);
    return null;
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "management_payment_status");
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const d = url.searchParams.get("d") ?? "";
  const s = url.searchParams.get("s") ?? "";
  if (!DIAGNOSIS_ID_RE.test(d) || !s) {
    return jsonResponse({ error: "parâmetros inválidos" }, 400);
  }

  const sb = diagnosisServiceClient();
  const { data } = await sb
    .from("diagnoses")
    .select(
      "secret_slug, management_status, management_mp_payment_id, management_business_name",
    )
    .eq("id", d)
    .maybeSingle();

  if (!data || data.secret_slug !== s) {
    return jsonResponse({ error: "não encontrado" }, 404);
  }

  let managementStatus = data.management_status as string | null;
  if (
    managementStatus === "awaiting_payment" &&
    data.management_mp_payment_id
  ) {
    const reconciled = await reconcileManagementWithMp(
      sb,
      d,
      String(data.management_mp_payment_id),
    );
    if (reconciled) managementStatus = reconciled;
  }

  trace.done({ management_status: managementStatus });
  return jsonResponse({
    management_status: managementStatus,
    management_business_name: data.management_business_name ?? null,
  });
});
