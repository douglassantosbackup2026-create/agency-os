import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type DiagnosisPaidRow = {
  id: string;
  management_status: string | null;
  management_ops_notified_at: string | null;
  management_amount_cents: number | null;
  management_business_name: string | null;
  management_instagram: string | null;
  management_website: string | null;
  payer_name: string | null;
  payer_email: string | null;
  payer_phone: string | null;
  meta_ad_account_id: string | null;
};

/**
 * Idempotent post-payment hook: internal alert + onboarding status.
 * Safe to call from PIX webhook, card payment, and poll reconciliation.
 */
export async function notifyManagementPaid(
  sb: SupabaseClient,
  diagnosisId: string,
): Promise<{ notified: boolean; skipped?: string }> {
  const { data: diag, error: dErr } = await sb
    .from("diagnoses")
    .select(
      "id, management_status, management_ops_notified_at, management_amount_cents, management_business_name, management_instagram, management_website, payer_name, payer_email, payer_phone, meta_ad_account_id",
    )
    .eq("id", diagnosisId)
    .maybeSingle();

  if (dErr || !diag) {
    console.error("notifyManagementPaid: diagnosis fetch failed", dErr);
    return { notified: false, skipped: "not_found" };
  }

  const row = diag as DiagnosisPaidRow;
  if (row.management_status !== "paid") {
    return { notified: false, skipped: "not_paid" };
  }
  if (row.management_ops_notified_at) {
    return { notified: false, skipped: "already_notified" };
  }

  const { data: cfg } = await sb
    .from("retentio_ops_config")
    .select("diagnosis_funnel_agency_id")
    .eq("id", 1)
    .maybeSingle();

  const funnelAgencyId =
    (cfg as { diagnosis_funnel_agency_id?: string | null } | null)
      ?.diagnosis_funnel_agency_id ?? null;

  const now = new Date().toISOString();
  const amountCents = row.management_amount_cents ?? 199700;
  const amountBrl = (amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const businessName = row.management_business_name ?? null;

  if (funnelAgencyId) {
    const title = businessName
      ? `Gestão paga: ${businessName} (${amountBrl})`
      : `Gestão paga: novo cliente (${amountBrl})`;
    const descParts = [
      `Pagamento confirmado para o diagnóstico ${diagnosisId}.`,
      row.payer_name ? `Comprador: ${row.payer_name}.` : null,
      row.payer_email ? `E-mail: ${row.payer_email}.` : null,
      row.payer_phone ? `Telefone: ${row.payer_phone}.` : null,
      row.meta_ad_account_id
        ? `Conta Meta ligada: ${row.meta_ad_account_id}.`
        : null,
      row.management_instagram
        ? `Instagram: ${row.management_instagram}.`
        : null,
      row.management_website ? `Site: ${row.management_website}.` : null,
    ].filter(Boolean);

    const taskTitle = businessName
      ? `Onboarding gestão — ${businessName}`
      : `Onboarding gestão — diagnóstico ${diagnosisId.slice(0, 8)}`;

    const { error: alertErr } = await sb.from("alerts").insert({
      agency_id: funnelAgencyId,
      type: "diagnosis_management_paid",
      title,
      description: descParts.join(" "),
      priority: "high",
      recommended_action:
        "Provisionar cliente no cockpit; confirmar se preencheu o formulário de onboarding.",
      should_create_task: true,
      task_title: taskTitle,
      time_to_act: "Próximas 24h",
      why_line: "Cliente acabou de pagar a gestão de tráfego.",
    });
    if (alertErr) {
      console.error(
        JSON.stringify({
          evt: "notifyManagementPaid.alert_failed",
          diagnosis_id: diagnosisId,
          err: String(alertErr.message ?? alertErr),
        }),
      );
    } else {
      const { error: actionErr } = await sb.from("action_center").insert({
        agency_id: funnelAgencyId,
        client_id: null,
        source_type: "manual",
        title: taskTitle,
        description: descParts.join(" "),
        priority: "alta",
        status: "pendente",
        metadata: {
          diagnosis_id: diagnosisId,
          kind: "management_paid_onboarding",
          alert_type: "diagnosis_management_paid",
        },
      });
      if (actionErr) {
        console.error(
          JSON.stringify({
            evt: "notifyManagementPaid.action_center_failed",
            diagnosis_id: diagnosisId,
            err: String(actionErr.message ?? actionErr),
          }),
        );
      }
    }
  } else {
    console.warn(
      JSON.stringify({
        evt: "notifyManagementPaid.alert_skipped_no_agency",
        diagnosis_id: diagnosisId,
      }),
    );
  }

  const { error: upErr } = await sb
    .from("diagnoses")
    .update({
      management_onboarding_status: "awaiting_client",
      management_ops_notified_at: now,
    })
    .eq("id", diagnosisId)
    .is("management_ops_notified_at", null);

  if (upErr) {
    console.error("notifyManagementPaid: status update failed", upErr);
    return { notified: false, skipped: "update_failed" };
  }

  return { notified: true };
}
