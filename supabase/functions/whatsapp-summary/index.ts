// Cron-triggered WhatsApp daily/weekly summaries.
// Iterates all clients across all agencies, builds a summary using recent
// metrics + the agency's matching template, and dispatches via Evolution API.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { assertCronOrOwnerAdmin } from "../_shared/cron-auth.ts";
import { resolveCronDualAuthAgencyScope } from "../_shared/cron-agency-scope.ts";
import { edgeLogDone, edgeLog, truncateError } from "../_shared/edge-log.ts";
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function render(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    String(vars[k] ?? ""),
  );
}

async function sendEvolution(recipient: string, message: string) {
  const url = Deno.env.get("EVOLUTION_API_URL");
  const key = Deno.env.get("EVOLUTION_API_KEY");
  if (!url || !key) return { status: "sent" as const, error: null }; // mock
  try {
    const r = await fetch(`${url}/message/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ number: recipient, text: message }),
    });
    return r.ok
      ? { status: "sent" as const, error: null }
      : { status: "failed" as const, error: `HTTP ${r.status}` };
  } catch (e) {
    return { status: "failed" as const, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const denied = await assertCronOrOwnerAdmin(req, supabase);
  if (denied) return denied;
  const t0 = Date.now();
  const traceId = traceIdFromRequest(req);
  try {
    const scope = await resolveCronDualAuthAgencyScope(req, supabase, corsHeaders);
    if (!scope.ok) return scope.response;

    const url = new URL(req.url);
    const period = (url.searchParams.get("period") ?? "daily") as
      | "daily"
      | "weekly";
    const days = period === "weekly" ? 7 : 1;

    const since = new Date(Date.now() - days * 86400000)
      .toISOString()
      .slice(0, 10);

    let cq = supabase
      .from("clients")
      .select("id, name, contact_phone, agency_id")
      .eq("status", "active")
      .not("contact_phone", "is", null);
    if (scope.agencyFilter) cq = cq.eq("agency_id", scope.agencyFilter);
    const { data: clients } = await cq;

    const batchSize = Math.max(
      1,
      Number(Deno.env.get("WHATSAPP_SUMMARY_BATCH_SIZE") ?? "25") || 25,
    );
    const throttleMs = Math.max(
      0,
      Number(Deno.env.get("WHATSAPP_EVOLUTION_THROTTLE_MS") ?? "300") || 300,
    );

    let sent = 0,
      skipped = 0,
      failed = 0;

    const list = clients ?? [];
    for (let i = 0; i < list.length; i += batchSize) {
      const chunk = list.slice(i, i + batchSize);
      for (const c of chunk) {
      if (!c.contact_phone) {
        skipped++;
        continue;
      }

      const { data: metrics } = await supabase
        .from("metrics_daily")
        .select("spend, revenue, conversions, roas")
        .eq("client_id", c.id)
        .is("campaign_id", null)
        .gte("date", since);

      const spend = (metrics ?? []).reduce(
        (a, m) => a + Number(m.spend ?? 0),
        0,
      );
      const revenue = (metrics ?? []).reduce(
        (a, m) => a + Number(m.revenue ?? 0),
        0,
      );
      const conv = (metrics ?? []).reduce(
        (a, m) => a + Number(m.conversions ?? 0),
        0,
      );
      const roas = spend > 0 ? (revenue / spend).toFixed(2) : "0";

      const { data: tpl } = await supabase
        .from("whatsapp_templates")
        .select("body")
        .eq("agency_id", c.agency_id)
        .eq("type", period)
        .limit(1)
        .maybeSingle();

      const fallback =
        period === "weekly"
          ? `Boa noite {{cliente}}! Resumo da semana: ROAS médio {{roas}}x, investimento {{spend}}, {{conv}} conversões.`
          : `Olá {{cliente}}! Resumo de hoje: ROAS {{roas}}x, investimento {{spend}}, {{conv}} conversões.`;

      const message = render(tpl?.body ?? fallback, {
        cliente: c.name,
        roas,
        spend: fmtBRL(spend),
        revenue: fmtBRL(revenue),
        conv,
      });

      const result = await sendEvolution(c.contact_phone, message);
      await supabase.from("whatsapp_logs").insert({
        agency_id: c.agency_id,
        client_id: c.id,
        recipient: c.contact_phone,
        message,
        template: `auto_${period}`,
        status: result.status,
        error: result.error,
        sent_at: result.status === "sent" ? new Date().toISOString() : null,
      });
      if (result.status === "sent") sent++;
      else failed++;
      if (throttleMs > 0) await new Promise((r) => setTimeout(r, throttleMs));
    }
    }

    traceLog("whatsapp_summary.ok", { period, sent, failed, skipped }, traceId);
    edgeLogDone("whatsapp_summary.ok", t0, {
      period,
      sent,
      failed,
      skipped,
      total: clients?.length ?? 0,
      trace_id: traceId,
    });
    return new Response(
      JSON.stringify({
        ok: true,
        period,
        sent,
        failed,
        skipped,
        total: clients?.length ?? 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    edgeLog("whatsapp_summary.error", {
      latency_ms: Math.max(0, Date.now() - t0),
      error_trunc: truncateError((e as Error).message),
    });
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
