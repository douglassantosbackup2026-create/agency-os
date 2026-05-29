/**
 * Geração síncrona de relatório IA (partilhada por generate-report e process-ai-jobs).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  baseGovernance,
  normalizeConfidence,
  parseAiJson,
  sanitizePromptField,
} from "./ai-v3.ts";
import { contentFromGatewayChatCompletion } from "./ai-response-parse.ts";
import { fetchWithTimeout } from "./fetch-with-timeout.ts";
import { aiBudgetExceeded } from "./ai-budget.ts";

export type ReportMode =
  | "monthly_manager"
  | "monthly_client"
  | "on_demand";

export class ReportRunnerHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ReportRunnerHttpError";
  }
}

export type ExecuteReportParams = {
  admin: SupabaseClient;
  client: Record<string, unknown>;
  client_id: string;
  userId: string;
  mode: ReportMode;
  clickContext: string;
};

export async function executeReportGeneration(
  p: ExecuteReportParams,
): Promise<Record<string, unknown>> {
  const { admin, client, client_id, userId, mode, clickContext } = p;
  const agencyId = String(client.agency_id ?? "");

  if (await aiBudgetExceeded(admin, agencyId, 12000)) {
    throw new ReportRunnerHttpError(
      429,
      "Orçamento diário de IA da agência atingido. Tente amanhã ou faça upgrade do plano.",
    );
  }

  console.info(
    JSON.stringify({
      evt: "generate_report.start",
      client_id,
      agency_id: agencyId,
      mode,
      click_context: clickContext,
    }),
  );

  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const sincePrev = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const [
    { data: metrics },
    { data: ga4Daily },
    { data: ga4Funnel },
    { data: ga4Channels },
    { data: ga4Tracking },
  ] = await Promise.all([
    admin
      .from("metrics_daily")
      .select("*")
      .eq("client_id", client_id)
      .is("campaign_id", null)
      .gte("date", sincePrev)
      .order("date"),
    admin
      .from("ga4_daily")
      .select(
        "date, sessions, conversions, revenue, conversion_rate, avg_ticket",
      )
      .eq("client_id", client_id)
      .gte("date", sincePrev)
      .order("date"),
    admin
      .from("ga4_funnel_daily")
      .select(
        "date, view_item, add_to_cart, begin_checkout, purchase, add_to_cart_rate, checkout_rate, purchase_rate",
      )
      .eq("client_id", client_id)
      .gte("date", sincePrev)
      .order("date"),
    admin
      .from("ga4_channel_daily")
      .select(
        "date, channel, sessions, conversions, revenue, revenue_per_session",
      )
      .eq("client_id", client_id)
      .gte("date", since)
      .order("date"),
    admin
      .from("ga4_tracking_health_daily")
      .select("status, notes")
      .eq("client_id", client_id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const mAll = metrics ?? [];
  const m = mAll.filter((x) => String(x.date) >= since);
  const mPrev = mAll.filter((x) => String(x.date) < since);
  const spend = m.reduce((a, b) => a + Number(b.spend ?? 0), 0);
  const revenue = m.reduce((a, b) => a + Number(b.revenue ?? 0), 0);
  const conv = m.reduce((a, b) => a + Number(b.conversions ?? 0), 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = conv > 0 ? spend / conv : 0;
  const prevSpend = mPrev.reduce((a, b) => a + Number(b.spend ?? 0), 0);
  const prevRevenue = mPrev.reduce((a, b) => a + Number(b.revenue ?? 0), 0);
  const half = Math.floor(m.length / 2);
  const firstHalfRoas =
    m.slice(0, half).reduce((a, b) => a + Number(b.roas ?? 0), 0) /
    Math.max(1, half);
  const secondHalfRoas =
    m.slice(half).reduce((a, b) => a + Number(b.roas ?? 0), 0) /
    Math.max(1, m.length - half);
  const deltaRevenuePct =
    prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

  const gAll = ga4Daily ?? [];
  const g = gAll.filter((x) => String(x.date) >= since);
  const gPrev = gAll.filter((x) => String(x.date) < since);
  const ga4Sessions = g.reduce((a, b) => a + Number(b.sessions ?? 0), 0);
  const ga4Conv = g.reduce((a, b) => a + Number(b.conversions ?? 0), 0);
  const ga4Revenue = g.reduce((a, b) => a + Number(b.revenue ?? 0), 0);
  const ga4PrevSessions = gPrev.reduce(
    (a, b) => a + Number(b.sessions ?? 0),
    0,
  );
  const ga4PrevConv = gPrev.reduce(
    (a, b) => a + Number(b.conversions ?? 0),
    0,
  );
  const ga4PrevRevenue = gPrev.reduce(
    (a, b) => a + Number(b.revenue ?? 0),
    0,
  );
  const ga4Cvr = ga4Sessions > 0 ? ga4Conv / ga4Sessions : 0;
  const ga4PrevCvr = ga4PrevSessions > 0 ? ga4PrevConv / ga4PrevSessions : 0;
  const ga4Ticket = ga4Conv > 0 ? ga4Revenue / ga4Conv : 0;

  const topChannelMap = new Map<
    string,
    { revenue: number; sessions: number }
  >();
  for (const ch of ga4Channels ?? []) {
    const key = String(ch.channel ?? "Unassigned");
    const cur = topChannelMap.get(key) ?? { revenue: 0, sessions: 0 };
    cur.revenue += Number(ch.revenue ?? 0);
    cur.sessions += Number(ch.sessions ?? 0);
    topChannelMap.set(key, cur);
  }
  const topChannel = [...topChannelMap.entries()].sort(
    (a, b) => b[1].revenue - a[1].revenue,
  )[0];
  const funnelRecent = (ga4Funnel ?? []).slice(-7);
  const avgFunnel = (key: string) =>
    funnelRecent.length
      ? funnelRecent.reduce(
          (a: number, b: Record<string, unknown>) => a + Number(b[key] ?? 0),
          0,
        ) / funnelRecent.length
      : 0;

  const summary = `Cliente: ${client.name}
Segmento: ${client.segment ?? "—"}
Últimos 30 dias:
- Investimento: R$ ${spend.toFixed(2)}
- Receita: R$ ${revenue.toFixed(2)}
- ROAS médio: ${roas.toFixed(2)}x
- CPA médio: R$ ${cpa.toFixed(2)}
- Conversões: ${conv}
- ROAS primeira metade: ${firstHalfRoas.toFixed(2)}x
- ROAS segunda metade: ${secondHalfRoas.toFixed(2)}x
Comparativo com 30 dias anteriores:
- Investimento anterior: R$ ${prevSpend.toFixed(2)}
- Receita anterior: R$ ${prevRevenue.toFixed(2)}
- Variação de receita: ${deltaRevenuePct.toFixed(1)}%
GA4 (site/funil - últimos 30 dias):
- Sessões: ${ga4Sessions}
- Conversões no site: ${ga4Conv}
- Receita GA4: R$ ${ga4Revenue.toFixed(2)}
- Taxa de conversão: ${(ga4Cvr * 100).toFixed(2)}% (anterior ${(ga4PrevCvr * 100).toFixed(2)}%)
- Ticket médio: R$ ${ga4Ticket.toFixed(2)}
- Top canal por receita: ${topChannel ? `${topChannel[0]} (R$ ${topChannel[1].revenue.toFixed(2)})` : "não disponível"}
- Funil recente (média 7d): view_item ${avgFunnel("view_item").toFixed(1)} | add_to_cart ${avgFunnel("add_to_cart").toFixed(1)} | begin_checkout ${avgFunnel("begin_checkout").toFixed(1)} | purchase ${avgFunnel("purchase").toFixed(1)}
- Tracking Health: ${String(ga4Tracking?.status ?? "não disponível")} (${sanitizePromptField(ga4Tracking?.notes)})
Contexto do clique: ${clickContext}`;

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) {
    throw new ReportRunnerHttpError(500, "LOVABLE_API_KEY não configurada");
  }

  const modeConfig = {
    monthly_manager: {
      promptKey: "01-analise-mensal-gestor",
      requiresReview: false,
      system:
        "Você é especialista sênior em tráfego pago. Não invente dados. Diferencie inferência de evidência e responda em JSON válido.",
      user: `Gere análise mensal para gestor com base nos dados abaixo.\n${summary}\n\nFormato JSON obrigatório:\n{
  "executive_summary": "",
  "positives": "",
  "problems": "",
  "opportunities": "",
  "next_steps": "",
  "client_friendly_summary": "",
  "confianca_analise": "alta|media|baixa",
  "principais_problemas": [{"problema":"","evidencia":"","causa_provavel":"","impacto":"baixo|medio|alto"}],
  "acoes_recomendadas": [{"acao":"","onde":"","impacto_esperado":"","prazo":"","prioridade":"baixa|media|alta","requer_revisao_humana":true}]
}`,
    },
    monthly_client: {
      promptKey: "02-analise-mensal-cliente",
      requiresReview: true,
      system:
        "Você escreve para cliente final em linguagem de negócio, sem siglas técnicas (CTR, CPL, CPC, CPA, ROAS, CPM). Nunca prometa resultado garantido. Responda JSON válido.",
      user: `Gere análise mensal para cliente final com revisão humana obrigatória.\n${summary}\n\nFormato JSON obrigatório:\n{
  "executive_summary": "",
  "positives": "",
  "problems": "",
  "opportunities": "",
  "next_steps": "",
  "client_friendly_summary": "",
  "confianca_analise": "alta|media|baixa",
  "status_cliente": "positivo|atencao|critico",
  "pode_enviar_sem_revisao": false,
  "pontos_sensiveis": [""],
  "acoes_comunicadas": [""]
}`,
    },
    on_demand: {
      promptKey: "03-analise-sob-demanda",
      requiresReview: true,
      system:
        "Você analisa o momento atual da conta. Responda de forma curta, acionável e em JSON válido.",
      user: `Analise agora esta conta no contexto "${clickContext}".\n${summary}\n\nFormato JSON obrigatório:\n{
  "executive_summary": "",
  "problems": "",
  "next_steps": "",
  "confianca_analise": "alta|media|baixa",
  "status_agora": "saudavel|atencao|risco|critico",
  "maior_risco": "",
  "oportunidade_visivel": "",
  "acao_recomendada": {
    "acao": "",
    "onde": "",
    "impacto_esperado": "",
    "prazo": "",
    "prioridade": "baixa|media|alta"
  },
  "requer_revisao_humana": true
}`,
    },
  }[mode];

  console.info("prompt_v3.generate_report", {
    mode,
    client_id,
    prompt_key: modeConfig.promptKey,
  });

  const aiResp = await fetchWithTimeout(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: modeConfig.system },
          { role: "user", content: modeConfig.user },
        ],
      }),
    },
  );

  if (!aiResp.ok) {
    const text = await aiResp.text();
    console.error("AI error", aiResp.status, text);
    if (aiResp.status === 429) {
      throw new ReportRunnerHttpError(
        429,
        "Limite de uso da IA atingido. Tente novamente em alguns minutos.",
      );
    }
    if (aiResp.status === 402) {
      throw new ReportRunnerHttpError(
        402,
        "Créditos de IA esgotados. Adicione créditos no workspace.",
      );
    }
    throw new Error(`AI error ${aiResp.status}`);
  }

  const aiJson = await aiResp.json();
  const content: string = contentFromGatewayChatCompletion(aiJson);
  const parsedContent = parseAiJson(content);
  const parsed: Record<string, unknown> = parsedContent.parseOk
    ? parsedContent.json
    : {
        executive_summary: parsedContent.text,
        client_friendly_summary: null,
      };
  const confianca = normalizeConfidence(
    parsed.confianca_analise ?? parsed.confianca ?? parsed.confidence,
  );
  const governance = baseGovernance(
    modeConfig.promptKey,
    modeConfig.requiresReview,
  );

  const usage = aiJson.usage as
    | { prompt_tokens?: number; completion_tokens?: number }
    | undefined;
  const pt = Math.round(Number(usage?.prompt_tokens ?? 0));
  const ct = Math.round(Number(usage?.completion_tokens ?? 0));
  if (pt + ct > 0) {
    const estimatedCost = ((pt + ct) / 1_000_000) * 0.35;
    const { error: uErr } = await admin.from("ai_usage_events").insert({
      agency_id: agencyId,
      day: new Date().toISOString().slice(0, 10),
      function_name: "generate-report",
      prompt_tokens: pt,
      completion_tokens: ct,
      estimated_cost_usd: Number(estimatedCost.toFixed(8)),
    });
    if (uErr) console.warn("ai_usage_events", uErr);
  }

  const { data: report } = await admin
    .from("reports")
    .insert({
      agency_id: agencyId,
      client_id,
      generated_by: userId,
      period_start: since,
      period_end: new Date().toISOString().slice(0, 10),
      executive_summary: String(parsed.executive_summary ?? "") || null,
      positives: String(parsed.positives ?? "") || null,
      problems: String(parsed.problems ?? "") || null,
      opportunities: String(parsed.opportunities ?? "") || null,
      next_steps: String(parsed.next_steps ?? "") || null,
      client_friendly_summary:
        String(parsed.client_friendly_summary ?? "") || null,
      ai_output_text: parsedContent.text,
      ai_output_json: parsed,
      confianca,
      ...governance,
      raw_data: {
        spend,
        revenue,
        roas,
        cpa,
        conv,
        prev_spend: prevSpend,
        prev_revenue: prevRevenue,
        ga4_sessions: ga4Sessions,
        ga4_conversions: ga4Conv,
        ga4_revenue: ga4Revenue,
        ga4_prev_sessions: ga4PrevSessions,
        ga4_prev_conversions: ga4PrevConv,
        ga4_prev_revenue: ga4PrevRevenue,
        ga4_cvr: ga4Cvr,
        ga4_prev_cvr: ga4PrevCvr,
        ga4_avg_ticket: ga4Ticket,
        ga4_tracking_status: ga4Tracking?.status ?? null,
        ga4_tracking_notes: ga4Tracking?.notes ?? null,
        mode,
        click_context: clickContext,
        parse_ok: parsedContent.parseOk,
      },
    })
    .select()
    .maybeSingle();

  const actionTitle =
    mode === "monthly_client"
      ? `Revisar comunicação para cliente — ${client.name}`
      : mode === "on_demand"
        ? `Executar ação recomendada (análise sob demanda) — ${client.name}`
        : `Executar próximos passos do relatório — ${client.name}`;
  const actionDesc = String(
    parsed.next_steps ?? parsed.executive_summary ?? "",
  ).slice(0, 1000);
  if (actionDesc) {
    await admin.from("action_center").insert({
      agency_id: agencyId,
      client_id,
      source_type: "relatorio_ia",
      source_ref_id: report?.id ?? null,
      title: actionTitle.slice(0, 220),
      description: actionDesc,
      priority: mode === "on_demand" ? "alta" : "media",
      status: "pendente",
      due_date: new Date().toISOString().slice(0, 10),
      created_by: userId,
      metadata: {
        mode,
        prompt_key: governance.prompt_key,
        prompt_version: governance.prompt_version,
        confianca,
      },
    });
  }

  await admin.from("activities").insert({
    agency_id: agencyId,
    client_id,
    user_id: userId,
    type: "report_generated",
    title: `Relatório IA gerado para ${client.name}`,
  });

  return (report ?? {}) as Record<string, unknown>;
}
