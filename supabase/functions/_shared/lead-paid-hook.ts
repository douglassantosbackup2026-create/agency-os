import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type LeadPaidRow = {
  id: string;
  status: string;
  ops_notified_at: string | null;
  amount_cents: number | null;
  store_name: string;
  name: string;
  email: string;
  phone: string;
  monthly_ad_budget_range: string;
  website: string;
};

/**
 * Idempotent post-payment hook for /gestao-trafego leads.
 */
export async function notifyLeadPaid(
  sb: SupabaseClient,
  leadId: string,
): Promise<{ notified: boolean; skipped?: string }> {
  const { data: lead, error: lErr } = await sb
    .from("ecommerce_leads")
    .select(
      "id, status, ops_notified_at, amount_cents, store_name, name, email, phone, monthly_ad_budget_range, website",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (lErr || !lead) {
    console.error("notifyLeadPaid: lead fetch failed", lErr);
    return { notified: false, skipped: "not_found" };
  }

  const row = lead as LeadPaidRow;
  if (row.status !== "paid") {
    return { notified: false, skipped: "not_paid" };
  }
  if (row.ops_notified_at) {
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
  const amountCents = row.amount_cents ?? 499700;
  const amountBrl = (amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const businessName = row.store_name?.trim() || row.name?.trim() || "Lead e-commerce";

  if (funnelAgencyId) {
    const title = `Gestão lead paga: ${businessName} (${amountBrl})`;
    const descParts = [
      `Pagamento confirmado — funil /gestao-trafego (lead ${leadId}).`,
      `Contato: ${row.name}.`,
      `E-mail: ${row.email}.`,
      `WhatsApp: ${row.phone}.`,
      `Investimento declarado: ${row.monthly_ad_budget_range}.`,
      row.website ? `Site: ${row.website}.` : null,
      "Provisionar cliente no Platform Admin → Leads E-commerce.",
    ].filter(Boolean);

    const taskTitle = `Onboarding gestão lead — ${businessName}`;

    const { error: alertErr } = await sb.from("alerts").insert({
      agency_id: funnelAgencyId,
      type: "ecommerce_lead_paid",
      title,
      description: descParts.join(" "),
      priority: "high",
      recommended_action:
        "Provisionar cliente no Platform Admin; contactar em até 24h úteis.",
      should_create_task: true,
      task_title: taskTitle,
      time_to_act: "Próximas 24h",
      why_line: "Lead pagou gestão de tráfego pelo funil direto.",
    });

    if (alertErr) {
      console.error(
        JSON.stringify({
          evt: "notifyLeadPaid.alert_failed",
          lead_id: leadId,
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
          lead_id: leadId,
          kind: "lead_paid_onboarding",
          alert_type: "ecommerce_lead_paid",
        },
      });
      if (actionErr) {
        console.error(
          JSON.stringify({
            evt: "notifyLeadPaid.action_center_failed",
            lead_id: leadId,
            err: String(actionErr.message ?? actionErr),
          }),
        );
      }
    }
  } else {
    console.warn(
      JSON.stringify({
        evt: "notifyLeadPaid.alert_skipped_no_agency",
        lead_id: leadId,
      }),
    );
  }

  const { error: upErr } = await sb
    .from("ecommerce_leads")
    .update({ ops_notified_at: now })
    .eq("id", leadId)
    .is("ops_notified_at", null);

  if (upErr) {
    console.error("notifyLeadPaid: status update failed", upErr);
    return { notified: false, skipped: "update_failed" };
  }

  return { notified: true };
}
