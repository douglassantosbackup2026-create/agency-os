import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  baseGovernance,
  normalizeConfidence,
  parseAiJson,
} from "../_shared/ai-v3.ts";

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
    const { client_id } = body;
    const mode = String(body?.mode ?? "monthly_manager") as
      | "monthly_manager"
      | "monthly_client"
      | "on_demand";
    const clickContext = String(body?.click_context ?? "checkin_rotina");
    if (!client_id)
      return new Response(JSON.stringify({ error: "client_id required" }), {
        status: 400,
        headers: corsHeaders,
      });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
        Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      },
    );
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes.user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: client } = await admin
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .maybeSingle();
    if (!client)
      return new Response(JSON.stringify({ error: "Cliente não encontrado" }), {
        status: 404,
        headers: corsHeaders,
      });

    const since = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    const sincePrev = new Date(Date.now() - 60 * 86400000)
      .toISOString()
      .slice(0, 10);
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
            (a: number, b: any) => a + Number(b[key] ?? 0),
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
- Tracking Health: ${String(ga4Tracking?.status ?? "não disponível")} (${String(ga4Tracking?.notes ?? "sem observações")})
Contexto do clique: ${clickContext}`;

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey)
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: corsHeaders },
      );

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

    const aiResp = await fetch(
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
            {
              role: "system",
              content: modeConfig.system,
            },
            {
              role: "user",
              content: modeConfig.user,
            },
          ],
        }),
      },
    );

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI error", aiResp.status, text);
      if (aiResp.status === 429)
        return new Response(
          JSON.stringify({
            error:
              "Limite de uso da IA atingido. Tente novamente em alguns minutos.",
          }),
          { status: 429, headers: corsHeaders },
        );
      if (aiResp.status === 402)
        return new Response(
          JSON.stringify({
            error: "Créditos de IA esgotados. Adicione créditos no workspace.",
          }),
          { status: 402, headers: corsHeaders },
        );
      throw new Error(`AI error ${aiResp.status}`);
    }

    const aiJson = await aiResp.json();
    const content: string = aiJson.choices?.[0]?.message?.content ?? "{}";
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

    const { data: report } = await admin
      .from("reports")
      .insert({
        agency_id: client.agency_id,
        client_id,
        generated_by: userRes.user.id,
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

    await admin.from("activities").insert({
      agency_id: client.agency_id,
      client_id,
      user_id: userRes.user.id,
      type: "report_generated",
      title: `Relatório IA gerado para ${client.name}`,
    });

    return new Response(JSON.stringify({ ok: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
