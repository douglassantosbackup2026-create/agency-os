import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  baseGovernance,
  normalizeConfidence,
  parseAiJson,
  type PromptKey,
} from "../_shared/ai-v3.ts";
import { assertUserCanAccessClient } from "../_shared/membership.ts";
import {
  addDaysYMD,
  campaignAuditAggRankScore,
  clampRecommendations,
  extractJsonFromModelText,
  formatYMD,
  mapTrackingHealthForAudit,
  matchScore,
  type AuditCampaignFlags,
} from "../_shared/campaign-audit-helpers.ts";
import { BodyTooLargeError, readJsonBody } from "../_shared/edge-json-body.ts";
import {
  clampCampaignAuditPeriodDays,
  contentFromGatewayChatCompletion,
  textFromAnthropicMessagesPayload,
} from "../_shared/ai-response-parse.ts";
import { edgeLog, edgeLogDone, truncateError } from "../_shared/edge-log.ts";
import { fetchWithTimeout } from "../_shared/fetch-with-timeout.ts";
import { aiBudgetExceeded } from "../_shared/ai-budget.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROMPT_KEY = "07-auditoria-campanhas" as PromptKey;
const PROMPT_VERSION = "07-v1";

type CampaignAgg = {
  campaign_id: string;
  name: string;
  platform: string;
  status: string;
  objective: string | null;
  spend_30d: number;
  revenue_30d: number;
  conv_30d: number;
  impressions_30d: number;
  clicks_30d: number;
  spend_7d: number;
  conv_7d: number;
  spend_prev7: number;
  conv_prev7: number;
  roas_30d: number;
  cpa_30d: number;
  tracking_match: "matched" | "partial" | "unmatched" | "unavailable";
  ga4_attribution_method: "ga4_campaign_dimension" | "spend_share_heuristic";
  ga4_sessions_attributed: number;
  ga4_conversions_attributed: number;
  ga4_revenue_attributed: number;
  match_score: number | null;
  matched_ga4_campaign_name: string | null;
  flags: AuditCampaignFlags;
};

async function callCampaignAuditModel(
  system: string,
  user: string,
): Promise<{
  text: string;
  prompt_tokens: number;
  completion_tokens: number;
  model_label: string;
}> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const modelAnthropic =
    Deno.env.get("CAMPAIGN_AUDIT_MODEL") ?? "claude-3-5-haiku-20241022";

  if (anthropicKey) {
    const r = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelAnthropic,
        max_tokens: 8192,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Anthropic: ${r.status} ${t.slice(0, 400)}`);
    }
    const j = await r.json();
    const text = textFromAnthropicMessagesPayload(j);
    const usage = j.usage as
      | { input_tokens?: number; output_tokens?: number }
      | undefined;
    return {
      text,
      prompt_tokens: Math.round(Number(usage?.input_tokens ?? 0)),
      completion_tokens: Math.round(Number(usage?.output_tokens ?? 0)),
      model_label: modelAnthropic,
    };
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) {
    throw new Error(
      "Configure ANTHROPIC_API_KEY (preferencial) ou LOVABLE_API_KEY para auditoria.",
    );
  }
  const gatewayModel =
    Deno.env.get("CAMPAIGN_AUDIT_GATEWAY_MODEL") ??
    "anthropic/claude-3-5-haiku-20241022";
  const r = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
    },
    body: JSON.stringify({
      model: gatewayModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    if (r.status === 429) throw new Error("RATE_LIMIT");
    if (r.status === 402) throw new Error("PAYMENT_REQUIRED");
    throw new Error(`Gateway IA: ${r.status} ${text.slice(0, 400)}`);
  }
  const aiJson = await r.json();
  const content: string = contentFromGatewayChatCompletion(aiJson);
  const usage = aiJson.usage as
    | { prompt_tokens?: number; completion_tokens?: number }
    | undefined;
  return {
    text: content,
    prompt_tokens: Math.round(Number(usage?.prompt_tokens ?? 0)),
    completion_tokens: Math.round(Number(usage?.completion_tokens ?? 0)),
    model_label: gatewayModel,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = Date.now();
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const client_id = body?.client_id as string | undefined;
    const period_days = clampCampaignAuditPeriodDays(body?.period_days);

    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
        Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: client, error: clientErr } = await admin
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .maybeSingle();
    if (clientErr || !client) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = await assertUserCanAccessClient(admin, userRes.user.id, {
      id: client.id as string,
      agency_id: client.agency_id as string,
    });
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para este cliente" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (await aiBudgetExceeded(admin, client.agency_id as string, 20000)) {
      return new Response(
        JSON.stringify({
          error:
            "Orçamento diário de IA da agência atingido. Tente amanhã ou faça upgrade do plano.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const cooldownMin = Number(
      Deno.env.get("CAMPAIGN_AUDIT_COOLDOWN_MINUTES") ?? "30",
    );
    const maxPerDay = Number(
      Deno.env.get("CAMPAIGN_AUDIT_MAX_PER_DAY_PER_CLIENT") ?? "8",
    );

    if (Number.isFinite(cooldownMin) && cooldownMin > 0) {
      const { data: lastAud } = await admin
        .from("campaign_ai_audits")
        .select("created_at")
        .eq("client_id", client_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastAud?.created_at) {
        const elapsedMin =
          (Date.now() - new Date(String(lastAud.created_at)).getTime()) /
          60_000;
        if (elapsedMin < cooldownMin) {
          const wait = Math.ceil(cooldownMin - elapsedMin);
          return new Response(
            JSON.stringify({
              error: `Auditoria em cooldown. Tente novamente em ~${wait} min.`,
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    if (Number.isFinite(maxPerDay) && maxPerDay > 0) {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const { count, error: cErr } = await admin
        .from("campaign_ai_audits")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client_id)
        .gte("created_at", dayStart.toISOString());
      if (!cErr && (count ?? 0) >= maxPerDay) {
        return new Response(
          JSON.stringify({
            error:
              "Limite diário de auditorias para este cliente foi atingido.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const period_end = formatYMD(new Date());
    const period_start = addDaysYMD(period_end, -(period_days - 1));
    const prev_period_end = addDaysYMD(period_start, -1);
    const prev_period_start = addDaysYMD(prev_period_end, -(period_days - 1));
    const last7_start = addDaysYMD(period_end, -6);
    const prev7_end = addDaysYMD(last7_start, -1);
    const prev7_start = addDaysYMD(prev7_end, -6);

    const fetch_start = prev_period_start;

    const [
      { data: mdRows },
      { data: campaigns },
      { data: ga4DailyRows },
      { data: ga4CampRows },
      { data: ga4Tracking },
    ] = await Promise.all([
      admin
        .from("metrics_daily")
        .select("*")
        .eq("client_id", client_id)
        .not("campaign_id", "is", null)
        .gte("date", fetch_start)
        .lte("date", period_end)
        .order("date"),
      admin.from("campaigns").select("*").eq("client_id", client_id),
      admin
        .from("ga4_daily")
        .select("date,sessions,conversions,revenue")
        .eq("client_id", client_id)
        .gte("date", period_start)
        .lte("date", period_end),
      admin
        .from("ga4_campaign_daily")
        .select("*")
        .eq("client_id", client_id)
        .gte("date", period_start)
        .lte("date", period_end),
      admin
        .from("ga4_tracking_health_daily")
        .select("status,notes")
        .eq("client_id", client_id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const cmap = new Map(
      (campaigns ?? []).map((c: Record<string, unknown>) => [String(c.id), c]),
    );

    type Ga4Agg = {
      sessions: number;
      conversions: number;
      revenue: number;
      ga4_ids: Set<string>;
    };
    const ga4ByName = new Map<string, Ga4Agg>();
    for (const r of ga4CampRows ?? []) {
      const row = r as Record<string, unknown>;
      const name = String(row.campaign_name ?? "");
      const cur = ga4ByName.get(name) ?? {
        sessions: 0,
        conversions: 0,
        revenue: 0,
        ga4_ids: new Set<string>(),
      };
      cur.sessions += Number(row.sessions ?? 0);
      cur.conversions += Number(row.conversions ?? 0);
      cur.revenue += Number(row.revenue ?? 0);
      const gid = String(row.campaign_id_ga4 ?? "").trim();
      if (gid && gid !== "(not set)") cur.ga4_ids.add(gid);
      ga4ByName.set(name, cur);
    }

    const ga4TotalsPeriod = (ga4DailyRows ?? []).reduce(
      (acc, row) => {
        acc.sessions += Number((row as Record<string, unknown>).sessions ?? 0);
        acc.conversions += Number(
          (row as Record<string, unknown>).conversions ?? 0,
        );
        acc.revenue += Number((row as Record<string, unknown>).revenue ?? 0);
        return acc;
      },
      { sessions: 0, conversions: 0, revenue: 0 },
    );

    const hasGa4Daily = (ga4DailyRows ?? []).length > 0;
    const hasGa4Campaign = ga4ByName.size > 0;
    const ga4_tracking_health_ui = mapTrackingHealthForAudit(
      ga4Tracking?.status as string | undefined,
      hasGa4Daily,
    );

    const tracking_critical =
      String(ga4Tracking?.status ?? "").toLowerCase() === "critical";

    type Bucket = {
      spend: number;
      revenue: number;
      conv: number;
      impressions: number;
      clicks: number;
    };
    const emptyBucket = (): Bucket => ({
      spend: 0,
      revenue: 0,
      conv: 0,
      impressions: 0,
      clicks: 0,
    });

    const sumRange = (
      rows: Record<string, unknown>[],
      start: string,
      end: string,
    ): Bucket => {
      const out = emptyBucket();
      for (const row of rows) {
        const d = String(row.date ?? "");
        if (d < start || d > end) continue;
        out.spend += Number(row.spend ?? 0);
        out.revenue += Number(row.revenue ?? 0);
        out.conv += Number(row.conversions ?? 0);
        out.impressions += Number(row.impressions ?? 0);
        out.clicks += Number(row.clicks ?? 0);
      }
      return out;
    };

    const rows = (mdRows ?? []) as Record<string, unknown>[];
    const byCampaign = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const cid = String(row.campaign_id ?? "");
      if (!cid) continue;
      const arr = byCampaign.get(cid) ?? [];
      arr.push(row);
      byCampaign.set(cid, arr);
    }

    const aggs: CampaignAgg[] = [];
    const LOW_VOL = 80;

    const prep = new Map<
      string,
      {
        meta: Record<string, unknown> | undefined;
        b30: Bucket;
        b7: Bucket;
        bPrev7: Bucket;
      }
    >();

    for (const [campaign_id, crows] of byCampaign) {
      const cmeta = cmap.get(campaign_id) as
        | Record<string, unknown>
        | undefined;
      prep.set(campaign_id, {
        meta: cmeta,
        b30: sumRange(crows, period_start, period_end),
        b7: sumRange(crows, last7_start, period_end),
        bPrev7: sumRange(crows, prev7_start, prev7_end),
      });
    }

    const totalSpend30 = [...prep.values()].reduce(
      (s, p) => s + p.b30.spend,
      0,
    );

    for (const [campaign_id, { meta: cmeta, b30, b7, bPrev7 }] of prep) {
      const name = String(cmeta?.name ?? campaign_id);
      const platform = String(cmeta?.platform ?? "unknown");
      const status = String(cmeta?.status ?? "unknown");
      const objective =
        cmeta?.objective != null ? String(cmeta.objective) : null;

      let tracking_match: CampaignAgg["tracking_match"] = "unavailable";
      let ga4_method: CampaignAgg["ga4_attribution_method"] =
        "spend_share_heuristic";
      let gSess = 0;
      let gConv = 0;
      let gRev = 0;
      let match_score: number | null = null;
      let matched_name: string | null = null;

      const spendShare = totalSpend30 > 0 ? b30.spend / totalSpend30 : 0;

      const extRaw = String(cmeta?.external_id ?? "").trim();
      const extNorm = extRaw.replace(/^-+/, "").trim();

      let idMatchedName: string | null = null;
      if (extNorm && hasGa4Campaign) {
        outer_id: for (const [gn, agg] of ga4ByName) {
          for (const gid of agg.ga4_ids) {
            const gLow = gid.toLowerCase();
            const eLow = extNorm.toLowerCase();
            if (gLow === eLow || gLow.endsWith(eLow) || eLow.endsWith(gLow)) {
              idMatchedName = gn;
              break outer_id;
            }
          }
        }
      }

      let ga4_external_id_match = false;

      if (hasGa4Campaign) {
        ga4_method = "ga4_campaign_dimension";
        if (idMatchedName) {
          ga4_external_id_match = true;
          matched_name = idMatchedName;
          match_score = 1;
          tracking_match = "matched";
          const g = ga4ByName.get(idMatchedName)!;
          gSess = g.sessions;
          gConv = g.conversions;
          gRev = g.revenue;
        } else {
          let bestScore = 0;
          let bestName: string | null = null;
          for (const gn of ga4ByName.keys()) {
            const sc = matchScore(name, gn);
            if (sc > bestScore) {
              bestScore = sc;
              bestName = gn;
            }
          }
          match_score = bestName ? bestScore : null;
          matched_name = bestName;
          if (bestName && bestScore >= 0.86) {
            tracking_match = "matched";
            const g = ga4ByName.get(bestName)!;
            gSess = g.sessions;
            gConv = g.conversions;
            gRev = g.revenue;
          } else if (bestName && bestScore >= 0.38) {
            tracking_match = "partial";
            const g = ga4ByName.get(bestName)!;
            gSess = g.sessions;
            gConv = g.conversions;
            gRev = g.revenue;
          } else {
            tracking_match = "unmatched";
            gSess = ga4TotalsPeriod.sessions * spendShare;
            gConv = ga4TotalsPeriod.conversions * spendShare;
            gRev = ga4TotalsPeriod.revenue * spendShare;
            ga4_method = "spend_share_heuristic";
          }
        }
      } else if (hasGa4Daily) {
        ga4_method = "spend_share_heuristic";
        tracking_match = "partial";
        gSess = ga4TotalsPeriod.sessions * spendShare;
        gConv = ga4TotalsPeriod.conversions * spendShare;
        gRev = ga4TotalsPeriod.revenue * spendShare;
      } else {
        tracking_match = "unavailable";
      }

      const roas_30d = b30.spend > 0 ? b30.revenue / b30.spend : 0;
      const cpa_30d = b30.conv > 0 ? b30.spend / b30.conv : b30.spend;

      const ga4RoasEst = b30.spend > 5 ? gRev / b30.spend : 0;
      const strong_platform_ga4_divergence =
        b30.spend >= 50 &&
        hasGa4Daily &&
        roas_30d > 0 &&
        ga4RoasEst > 0 &&
        Math.max(roas_30d, ga4RoasEst) / Math.min(roas_30d, ga4RoasEst) >= 2;

      const low_volume = b30.spend < LOW_VOL;
      const zero_conv_with_spend = b30.conv < 0.5 && b30.spend >= 20;

      aggs.push({
        campaign_id,
        name,
        platform,
        status,
        objective,
        spend_30d: Number(b30.spend.toFixed(2)),
        revenue_30d: Number(b30.revenue.toFixed(2)),
        conv_30d: Math.round(b30.conv),
        impressions_30d: Math.round(b30.impressions),
        clicks_30d: Math.round(b30.clicks),
        spend_7d: Number(b7.spend.toFixed(2)),
        conv_7d: Math.round(b7.conv),
        spend_prev7: Number(bPrev7.spend.toFixed(2)),
        conv_prev7: Math.round(bPrev7.conv),
        roas_30d: Number(roas_30d.toFixed(4)),
        cpa_30d: Number(cpa_30d.toFixed(2)),
        tracking_match,
        ga4_attribution_method: ga4_method,
        ga4_sessions_attributed: Number(gSess.toFixed(1)),
        ga4_conversions_attributed: Number(gConv.toFixed(2)),
        ga4_revenue_attributed: Number(gRev.toFixed(2)),
        match_score,
        matched_ga4_campaign_name: matched_name,
        flags: {
          low_volume,
          zero_conv_with_spend,
          tracking_critical,
          requires_human_review:
            low_volume ||
            tracking_critical ||
            tracking_match !== "matched" ||
            strong_platform_ga4_divergence,
          strong_platform_ga4_divergence,
          ga4_external_id_match,
        },
      });
    }

    const avgRoas =
      totalSpend30 > 0
        ? aggs.reduce((s, a) => s + a.revenue_30d, 0) / totalSpend30
        : 0;
    const avgCpa =
      aggs.reduce((s, a) => s + a.conv_30d, 0) > 0
        ? totalSpend30 / aggs.reduce((s, a) => s + a.conv_30d, 0)
        : 0;

    const ranked = [...aggs].sort(
      (a, b) =>
        campaignAuditAggRankScore(b, avgRoas) -
        campaignAuditAggRankScore(a, avgRoas),
    );

    const top = ranked.slice(0, 15);

    const global_ga4_method = hasGa4Campaign
      ? "ga4_campaign_dimension_with_fallback_heuristic"
      : hasGa4Daily
        ? "spend_share_heuristic"
        : "unavailable";

    const flagsByCampaign = new Map(aggs.map((a) => [a.campaign_id, a.flags]));

    const system = `És auditor sénior de performance de media paga. Não inventes números fora do pacote JSON.
Regras obrigatórias:
- Português (PT-PT/PT-BR neutro).
- Copy sugestiva: "Sugestão: avaliar pausa", nunca ordens diretas ao cliente ("Pausar agora").
- Se flags.low_volume ou tracking_critical ou tracking_match não matched: não recomendar escalar nem cortes agressivos; preferir investigate ou fix_tracking.
- Responde APENAS com um único objeto JSON válido (sem markdown fora do JSON).`;

    const userPayload = {
      client: {
        id: client_id,
        name: client.name,
        segment: client.segment ?? null,
      },
      period: { start: period_start, end: period_end, days: period_days },
      ga4: {
        tracking_health_raw: ga4Tracking?.status ?? null,
        ga4_tracking_health_ui,
        totals_period_site: ga4TotalsPeriod,
        global_ga4_attribution_method: global_ga4_method,
      },
      account_benchmarks: {
        avg_roas_30d: Number(avgRoas.toFixed(4)),
        avg_cpa_30d: Number(avgCpa.toFixed(2)),
        total_spend_30d: Number(totalSpend30.toFixed(2)),
      },
      campaigns_ranked_for_model: top,
      governance_hints: `Campanhas não listadas também podem existir; não extrapoles além dos dados.`,
    };

    const user = `${JSON.stringify(userPayload)}

Devolve JSON com esta forma (chaves fixas):
{
  "executive_summary_markdown": "markdown curto",
  "overall_status": "healthy|attention|risk|critical",
  "tracking_issues": [{"severity":"low|medium|high","detail":"","campaign_id":null}],
  "do_not_touch": [{"campaign_id":"","reason":""}],
  "recommendations": [{
    "campaign_id":"uuid",
    "campaign_name":"",
    "platform":"",
    "suggestion_type":"investigate|creative_refresh|audience_tune|budget_shift|fix_tracking|scale|pause",
    "suggested_copy":"texto sugestivo para o gestor",
    "rationale":"",
    "confidence":"alta|media|baixa",
    "requires_human_review": true,
    "tracking_match":"matched|partial|unmatched|unavailable"
  }],
  "confianca_analise": "alta|media|baixa",
  "notes": ""
}`;

    console.info(
      JSON.stringify({
        evt: "campaign_ai_audit.invoke",
        client_id,
        agency_id: client.agency_id,
        period_days,
        campaigns_total: aggs.length,
      }),
    );

    let ai;
    try {
      ai = await callCampaignAuditModel(system, user);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "RATE_LIMIT") {
        return new Response(
          JSON.stringify({
            error:
              "Limite de uso da IA atingido. Tente novamente em alguns minutos.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (msg === "PAYMENT_REQUIRED") {
        return new Response(
          JSON.stringify({
            error: "Créditos de IA esgotados no gateway.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      throw e;
    }

    const extracted = extractJsonFromModelText(ai.text);
    const parsedContent = parseAiJson(extracted);
    const parsed: Record<string, unknown> = parsedContent.parseOk
      ? parsedContent.json
      : {
          executive_summary_markdown: parsedContent.text,
          recommendations: [],
          overall_status: "attention",
        };

    let recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : [];
    recommendations = clampRecommendations(recommendations, flagsByCampaign);

    const confianca = normalizeConfidence(
      parsed.confianca_analise ?? parsed.confidence,
    );
    const gov = baseGovernance(PROMPT_KEY, true);

    const result_json = {
      ...parsed,
      recommendations,
      confianca_analise: confianca,
      ga4_attribution_method: global_ga4_method,
      inputs_snapshot: {
        campaigns_considered: top,
        all_campaigns_count: aggs.length,
        parse_ok: parsedContent.parseOk,
      },
      ...gov,
      prompt_version: PROMPT_VERSION,
    };

    const execMd = String(
      parsed.executive_summary_markdown ?? parsed.executive_summary ?? "",
    );

    const { data: audit, error: insErr } = await admin
      .from("campaign_ai_audits")
      .insert({
        agency_id: client.agency_id,
        client_id,
        created_by: userRes.user.id,
        period_start,
        period_end,
        ga4_tracking_health: ga4_tracking_health_ui,
        executive_summary_markdown: execMd || null,
        result_json,
        model: ai.model_label,
        prompt_version: PROMPT_VERSION,
      })
      .select()
      .maybeSingle();

    if (insErr) throw new Error(insErr.message);

    const pt = ai.prompt_tokens;
    const ct = ai.completion_tokens;
    if (pt + ct > 0) {
      const estimatedCost = ((pt + ct) / 1_000_000) * 1.2;
      const { error: uErr } = await admin.from("ai_usage_events").insert({
        agency_id: client.agency_id,
        day: formatYMD(new Date()),
        function_name: "campaign-ai-audit",
        prompt_tokens: pt,
        completion_tokens: ct,
        estimated_cost_usd: Number(estimatedCost.toFixed(8)),
      });
      if (uErr) console.warn("ai_usage_events", uErr);
    }

    edgeLogDone("campaign_ai_audit.ok", t0, {
      client_id,
      agency_id: client.agency_id,
      period_days,
    });
    return new Response(JSON.stringify({ ok: true, audit }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    edgeLog("campaign_ai_audit.error", {
      latency_ms: Math.max(0, Date.now() - t0),
      error_trunc: truncateError((e as Error).message),
    });
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
