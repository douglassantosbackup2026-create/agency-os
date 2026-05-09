import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { baseGovernance, normalizeConfidence } from "../_shared/ai-v3.ts";
import { assertUserCanAccessClient } from "../_shared/membership.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const body = await req.json().catch(() => ({}));
    const clientId = String(body?.client_id ?? "");
    const requestedMode = String(body?.mode ?? "").trim();
    if (!clientId) {
      return new Response(JSON.stringify({ error: "client_id obrigatório" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: client } = await admin
      .from("clients")
      .select("id, agency_id, name")
      .eq("id", clientId)
      .maybeSingle();
    if (!client)
      return new Response(JSON.stringify({ error: "client not found" }), {
        status: 404,
        headers: corsHeaders,
      });

    const allowed = await assertUserCanAccessClient(admin, u.user.id, {
      id: client.id as string,
      agency_id: client.agency_id as string,
    });
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    const { data: metrics } = await admin
      .from("metrics_daily")
      .select("spend, revenue, conversions, roas, cpa")
      .eq("client_id", clientId)
      .is("campaign_id", null)
      .gte("date", since);

    const spend = (metrics ?? []).reduce((a, b) => a + Number(b.spend ?? 0), 0);
    const revenue = (metrics ?? []).reduce(
      (a, b) => a + Number(b.revenue ?? 0),
      0,
    );
    const conv = (metrics ?? []).reduce(
      (a, b) => a + Number(b.conversions ?? 0),
      0,
    );
    const roas = spend > 0 ? revenue / spend : 0;
    const cpa = conv > 0 ? spend / conv : 0;
    const pctMeta = Number(body?.pct_meta_atingida ?? 0);
    const mode =
      requestedMode ||
      (pctMeta > 120
        ? "upsell"
        : pctMeta > 0 && pctMeta < 65
          ? "crise"
          : "revisao_padrao");
    const tom =
      mode === "crise"
        ? "cuidadoso"
        : mode === "upsell"
          ? "celebrativo"
          : "consultivo";

    const agenda = [
      `1) Revisão do período: investimento ${spend.toFixed(2)} e receita ${revenue.toFixed(2)}.`,
      `2) Diagnóstico: ROAS ${roas.toFixed(2)}x e CPA ${cpa.toFixed(2)}.`,
      "3) Ajustes táticos para os próximos 30 dias.",
      "4) Aprovação de próximos criativos e prioridades.",
    ].join("\n");

    const whatWorked =
      roas >= 2
        ? "Eficiência de mídia acima do alvo para escala controlada."
        : "Volume de dados já permite ajustes mais objetivos de campanha.";
    const whatToImprove =
      conv < 10
        ? "Aumentar volume de conversões com expansão de públicos e criativos."
        : "Reduzir CPA com testes de segmentação e refinamento de oferta.";
    const nextMonthPlan =
      "Rodar 2-3 novos testes criativos por semana, revisar funil semanalmente e reequilibrar orçamento por desempenho.";
    const strategicQuestions =
      "Quais ofertas têm maior margem? Qual objetivo comercial prioritário do próximo mês? Há sazonalidade relevante no período?";
    const shortVersion = `Resultado principal: investimento R$ ${spend.toFixed(2)}, receita R$ ${revenue.toFixed(2)}, ROAS ${roas.toFixed(2)}x. Maior ajuste: ${whatToImprove}. Próximo passo: validar plano de 30 dias e responsáveis.`;
    const aiOutputJson = {
      modo_reuniao: mode,
      risco_churn: mode === "crise" ? "alto" : "medio",
      tom_recomendado: tom,
      tempo_total_minutos: 30,
      principais_pontos: [
        "Resultado principal do período",
        "O que funcionou com evidência",
        "Ajustes para próximo ciclo",
      ],
      perguntas_cliente: strategicQuestions.split("?").filter(Boolean),
      proximo_passo_recomendado: nextMonthPlan,
      requer_preparacao_extra: mode === "crise" || mode === "renovacao",
      versao_curta_5_minutos: shortVersion,
      confianca: normalizeConfidence(conv > 20 ? "alta" : "media"),
    };
    console.info("prompt_v3.meeting_report", {
      client_id: clientId,
      mode,
      confidence: aiOutputJson.confianca,
    });
    const governance = baseGovernance("05-pauta-reuniao", true);

    const { error: insErr } = await admin.from("meeting_reports").insert({
      agency_id: client.agency_id,
      client_id: client.id,
      generated_by: u.user.id,
      period_start: since,
      period_end: new Date().toISOString().slice(0, 10),
      agenda,
      what_worked: whatWorked,
      what_to_improve: whatToImprove,
      next_month_plan: nextMonthPlan,
      strategic_questions: strategicQuestions,
      ai_output_text: `${agenda}\n\nVERSÃO CURTA — 5 MINUTOS\n${shortVersion}`,
      ai_output_json: aiOutputJson,
      confianca: aiOutputJson.confianca,
      ...governance,
    });
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
