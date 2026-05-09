import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4?dts";
import {
  baseGovernance,
  normalizeConfidence,
  parseAiJson,
} from "../_shared/ai-v3.ts";
import { contentFromGatewayChatCompletion } from "../_shared/ai-response-parse.ts";
import { assertUserCanAccessClient } from "../_shared/membership.ts";
import { BodyTooLargeError, readJsonBody } from "../_shared/edge-json-body.ts";
import { edgeLogDone, edgeLog, truncateError } from "../_shared/edge-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type MetricsRow = {
  date?: string;
  spend?: number | string | null;
  revenue?: number | string | null;
  conversions?: number | string | null;
  roas?: number | string | null;
};

function sumMetrics(rows: MetricsRow[]) {
  const spend = rows.reduce((a, b) => a + Number(b.spend ?? 0), 0);
  const revenue = rows.reduce((a, b) => a + Number(b.revenue ?? 0), 0);
  const conv = rows.reduce((a, b) => a + Number(b.conversions ?? 0), 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = conv > 0 ? spend / conv : 0;
  return { spend, revenue, conv, roas, cpa };
}

function stringifyQuestions(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).join("\n");
  const s = String(raw ?? "").trim();
  return s;
}

function buildDeterministicMeeting({
  spend,
  revenue,
  conv,
  roas,
  cpa,
  prevSpend,
  prevRevenue,
  mode,
  tom,
}: {
  spend: number;
  revenue: number;
  conv: number;
  roas: number;
  cpa: number;
  prevSpend: number;
  prevRevenue: number;
  mode: string;
  tom: string;
}) {
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
  const deltaRev =
    prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

  const aiOutputJson: Record<string, unknown> = {
    modo_reuniao: mode,
    risco_churn: mode === "crise" ? "alto" : "medio",
    tom_recomendado: tom,
    tempo_total_minutos: 30,
    principais_pontos: [
      "Resultado principal do período",
      "O que funcionou com evidência",
      "Ajustes para próximo ciclo",
    ],
    perguntas_cliente: strategicQuestions
      .split("?")
      .map((x) => x.trim())
      .filter(Boolean),
    proximo_passo_recomendado: nextMonthPlan,
    requer_preparacao_extra: mode === "crise" || mode === "renovacao",
    versao_curta_5_minutos: shortVersion,
    confianca_analise: normalizeConfidence(conv > 20 ? "alta" : "media"),
    confianca: normalizeConfidence(conv > 20 ? "alta" : "media"),
    fonte: "deterministic",
    comparacao_resumo: `Investimento período anterior R$ ${prevSpend.toFixed(2)}, receita anterior R$ ${prevRevenue.toFixed(2)}, variação receita ${deltaRev.toFixed(1)}%.`,
  };

  return {
    agenda,
    whatWorked,
    whatToImprove,
    nextMonthPlan,
    strategicQuestions,
    shortVersion,
    aiOutputJson,
    confianca: normalizeConfidence(aiOutputJson.confianca),
    parseOk: true as boolean,
  };
}

function mergeParsedMeeting(
  parsed: Record<string, unknown>,
  deterministic: ReturnType<typeof buildDeterministicMeeting>,
  mode: string,
  tom: string,
  parseOk: boolean,
) {
  const perguntasRaw =
    parsed.perguntas_cliente ?? parsed.perguntas_estrategicas;
  const strategicFromAi = stringifyQuestions(
    parsed.strategic_questions ?? perguntasRaw,
  );

  const agenda = String(parsed.agenda ?? "").trim() || deterministic.agenda;
  const whatWorked =
    String(parsed.what_worked ?? "").trim() || deterministic.whatWorked;
  const whatToImprove =
    String(parsed.what_to_improve ?? "").trim() || deterministic.whatToImprove;
  const nextMonthPlan =
    String(parsed.next_month_plan ?? "").trim() || deterministic.nextMonthPlan;
  const strategicQuestions =
    strategicFromAi || deterministic.strategicQuestions;
  const shortVersion =
    String(parsed.versao_curta_5_minutos ?? "").trim() ||
    deterministic.shortVersion;

  const modo =
    String(parsed.modo_reuniao ?? "").trim() === ""
      ? mode
      : String(parsed.modo_reuniao);
  const effectiveMode = [
    "revisao_padrao",
    "crise",
    "upsell",
    "renovacao",
  ].includes(modo)
    ? modo
    : mode;

  const confianca = normalizeConfidence(
    parsed.confianca_analise ?? parsed.confianca,
  );

  const perguntasCliente = Array.isArray(perguntasRaw)
    ? perguntasRaw.map((x) => String(x))
    : strategicQuestions
        .split(/[\n?]/)
        .map((x) => x.trim())
        .filter(Boolean);

  const aiOutputJson: Record<string, unknown> = {
    ...deterministic.aiOutputJson,
    ...parsed,
    modo_reuniao: effectiveMode,
    tom_recomendado: String(parsed.tom_recomendado ?? "").trim() || tom,
    versao_curta_5_minutos: shortVersion,
    perguntas_cliente: perguntasCliente.length
      ? perguntasCliente
      : deterministic.aiOutputJson.perguntas_cliente,
    confianca_analise: confianca,
    confianca,
    fonte: parseOk ? "lovable_gateway" : "fallback_partial",
    parse_ok: parseOk,
  };

  return {
    agenda,
    whatWorked,
    whatToImprove,
    nextMonthPlan,
    strategicQuestions,
    shortVersion,
    aiOutputJson,
    confianca,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return new Response(
          JSON.stringify({ error: "payload demasiado grande" }),
          {
            status: 413,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      body = {};
    }
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
      .select("id, agency_id, name, segment")
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

    const reportCooldownMin = Number(
      Deno.env.get("GENERATE_REPORT_COOLDOWN_MINUTES") ?? "20",
    );
    const reportMaxPerDay = Number(
      Deno.env.get("GENERATE_REPORT_MAX_PER_DAY_PER_CLIENT") ?? "12",
    );

    if (Number.isFinite(reportCooldownMin) && reportCooldownMin > 0) {
      const { data: lastMr } = await admin
        .from("meeting_reports")
        .select("created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastMr?.created_at) {
        const elapsedMin =
          (Date.now() - new Date(String(lastMr.created_at)).getTime()) / 60_000;
        if (elapsedMin < reportCooldownMin) {
          const wait = Math.ceil(reportCooldownMin - elapsedMin);
          return new Response(
            JSON.stringify({
              error: `Pauta de reunião em cooldown. Tente novamente em ~${wait} min.`,
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    if (Number.isFinite(reportMaxPerDay) && reportMaxPerDay > 0) {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const { count, error: cErr } = await admin
        .from("meeting_reports")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .gte("created_at", dayStart.toISOString());
      if (!cErr && (count ?? 0) >= reportMaxPerDay) {
        return new Response(
          JSON.stringify({
            error:
              "Limite diário de pautas de reunião para este cliente foi atingido.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const since30 = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    const since60 = new Date(Date.now() - 60 * 86400000)
      .toISOString()
      .slice(0, 10);

    const { data: metricsAll } = await admin
      .from("metrics_daily")
      .select("date, spend, revenue, conversions, roas")
      .eq("client_id", clientId)
      .is("campaign_id", null)
      .gte("date", since60);

    const rows = (metricsAll ?? []) as MetricsRow[];
    const mCurr = rows.filter((x) => String(x.date ?? "") >= since30);
    const mPrev = rows.filter((x) => {
      const d = String(x.date ?? "");
      return d >= since60 && d < since30;
    });

    const cur = sumMetrics(mCurr);
    const prev = sumMetrics(mPrev);

    const spend = cur.spend;
    const revenue = cur.revenue;
    const conv = cur.conv;
    const roas = cur.roas;
    const cpa = cur.cpa;
    const prevSpend = prev.spend;
    const prevRevenue = prev.revenue;

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

    const deltaRevPct =
      prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

    const mesRef = new Date().toLocaleString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    const proxMes = new Date(Date.now() + 28 * 86400000).toLocaleString(
      "pt-BR",
      {
        month: "long",
        year: "numeric",
      },
    );

    const resultadosMes = `Últimos 30 dias: investimento R$ ${spend.toFixed(2)}, receita R$ ${revenue.toFixed(2)}, ROAS ${roas.toFixed(2)}x, CPA R$ ${cpa.toFixed(2)}, conversões ${conv}.`;
    const comparacaoMes = `Janela anterior (~30d): investimento R$ ${prevSpend.toFixed(2)}, receita R$ ${prevRevenue.toFixed(2)}. Variação receita vs anterior: ${deltaRevPct.toFixed(1)}%.`;

    const deterministic = buildDeterministicMeeting({
      spend,
      revenue,
      conv,
      roas,
      cpa,
      prevSpend,
      prevRevenue,
      mode,
      tom,
    });

    const governance = baseGovernance("05-pauta-reuniao", true);

    let final = {
      agenda: deterministic.agenda,
      whatWorked: deterministic.whatWorked,
      whatToImprove: deterministic.whatToImprove,
      nextMonthPlan: deterministic.nextMonthPlan,
      strategicQuestions: deterministic.strategicQuestions,
      shortVersion: deterministic.shortVersion,
      aiOutputJson: deterministic.aiOutputJson,
      confianca: deterministic.confianca,
      aiRawText: "",
      usedAi: false,
    };

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const meetingModel =
      Deno.env.get("MEETING_REPORT_MODEL") ?? "google/gemini-3-flash-preview";

    if (lovableKey) {
      const system =
        "Você é estrategista de marketing digital preparando pauta de reunião entre gestor e cliente. O gestor deve sair com roteiro prático, sem parecer operador de plataforma. Use apenas números dos dados fornecidos; não invente métricas. Evite jargão técnico excessivo. Duração total da reunião entre 20 e 35 minutos. Responda APENAS com um objeto JSON válido UTF-8, sem markdown.";
      const user = `Gere a pauta completa de reunião com base nos dados abaixo.

CLIENTE: ${client.name}
SEGMENTO: ${client.segment ?? "—"}
MÊS DA REUNIÃO: ${mesRef}
PRÓXIMO MÊS: ${proxMes}
META ATINGIDA EM: ${pctMeta}%
MODO DA REUNIÃO (usar como base): ${mode}

RESULTADOS DO MÊS
${resultadosMes}

COMPARAÇÃO COM PERÍODO ANTERIOR
${comparacaoMes}

Formato JSON obrigatório (um único objeto):
{
  "agenda": "(texto completo da pauta com linhas numeradas: abertura, resultado principal, o que funcionou, o que melhorar, plano próximo mês, perguntas estratégicas)",
  "what_worked": "",
  "what_to_improve": "",
  "next_month_plan": "",
  "strategic_questions": "(string com perguntas, pode usar quebras de linha)",
  "versao_curta_5_minutos": "",
  "modo_reuniao": "revisao_padrao|crise|upsell|renovacao",
  "risco_churn": "baixo|medio|alto",
  "tom_recomendado": "consultivo|cuidadoso|celebrativo|firme",
  "tempo_total_minutos": 30,
  "principais_pontos": [""],
  "perguntas_cliente": [""],
  "proximo_passo_recomendado": "",
  "requer_preparacao_extra": false,
  "confianca_analise": "alta|media|baixa"
}`;

      const aiResp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
          },
          body: JSON.stringify({
            model: meetingModel,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        },
      );

      if (!aiResp.ok) {
        const text = await aiResp.text();
        console.error("AI meeting error", aiResp.status, text);
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
              error:
                "Créditos de IA esgotados. Adicione créditos no workspace.",
            }),
            { status: 402, headers: corsHeaders },
          );
        console.warn("generate-meeting-report AI failure, using deterministic");
      } else {
        const aiJson = await aiResp.json();
        const content: string = contentFromGatewayChatCompletion(aiJson);
        final.aiRawText = content;
        const parsedContent = parseAiJson(content);
        const parsed: Record<string, unknown> = parsedContent.parseOk
          ? parsedContent.json
          : { raw_text: parsedContent.text };

        const merged = mergeParsedMeeting(
          parsed,
          deterministic,
          mode,
          tom,
          parsedContent.parseOk,
        );
        final = {
          agenda: merged.agenda,
          whatWorked: merged.whatWorked,
          whatToImprove: merged.whatToImprove,
          nextMonthPlan: merged.nextMonthPlan,
          strategicQuestions: merged.strategicQuestions,
          shortVersion: merged.shortVersion,
          aiOutputJson: merged.aiOutputJson,
          confianca: merged.confianca,
          aiRawText: parsedContent.text,
          usedAi: true,
        };

        const usage = aiJson.usage as
          | { prompt_tokens?: number; completion_tokens?: number }
          | undefined;
        const pt = Math.round(Number(usage?.prompt_tokens ?? 0));
        const ct = Math.round(Number(usage?.completion_tokens ?? 0));
        if (pt + ct > 0) {
          const estimatedCost = ((pt + ct) / 1_000_000) * 0.35;
          const { error: uErr } = await admin.from("ai_usage_events").insert({
            agency_id: client.agency_id,
            day: new Date().toISOString().slice(0, 10),
            function_name: "generate-meeting-report",
            prompt_tokens: pt,
            completion_tokens: ct,
            estimated_cost_usd: Number(estimatedCost.toFixed(8)),
          });
          if (uErr) console.warn("ai_usage_events", uErr);
        }
      }
    } else {
      console.info(
        "generate-meeting-report: sem LOVABLE_API_KEY, modo determinístico",
      );
    }

    console.info("prompt_v3.meeting_report", {
      client_id: clientId,
      mode,
      confidence: final.confianca,
      used_ai: final.usedAi,
    });

    const ai_output_text = `${final.agenda}\n\nVERSÃO CURTA — 5 MINUTOS\n${final.shortVersion}`;

    const { error: insErr } = await admin.from("meeting_reports").insert({
      agency_id: client.agency_id,
      client_id: client.id,
      generated_by: u.user.id,
      period_start: since30,
      period_end: new Date().toISOString().slice(0, 10),
      agenda: final.agenda,
      what_worked: final.whatWorked,
      what_to_improve: final.whatToImprove,
      next_month_plan: final.nextMonthPlan,
      strategic_questions: final.strategicQuestions,
      ai_output_text,
      ai_output_json: {
        ...final.aiOutputJson,
        ...(final.aiRawText ? { raw_model_text: final.aiRawText } : {}),
      },
      confianca: final.confianca,
      ...governance,
    });
    if (insErr) throw insErr;

    edgeLogDone("generate_meeting_report.ok", t0, {
      client_id: clientId,
      agency_id: client.agency_id,
      used_ai: final.usedAi,
    });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    edgeLog("generate_meeting_report.error", {
      latency_ms: Math.max(0, Date.now() - t0),
      error_trunc: truncateError((e as Error).message),
    });
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
