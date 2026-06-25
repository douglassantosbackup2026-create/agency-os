import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { isCronAuthenticated } from "../_shared/cron-agency-scope.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { diagnosisAiBudgetExceeded } from "../_shared/ai-budget.ts";
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";
import {
  attachCommercialToFacts,
  buildFactsEnrichment,
  deriveFunnelGuidanceForAi,
  mergeBusinessContextIntoFacts,
  normalizeAnalysisV2,
} from "../_shared/diagnosis/derive-analysis.ts";
import { recordDiagnosisFollowup } from "../_shared/diagnosis/record-diagnosis-followup.ts";
import {
  enrichFactsWithMetaSeniorFetch,
} from "../_shared/diagnosis/derive-meta-senior.ts";
import { PROMPT_VERSION } from "../_shared/diagnosis/diagnosis-prompt-v4.ts";
import {
  isSmallAccountSpend,
  parseAccountSpendBrl,
} from "../_shared/diagnosis/build-ai-prompt.ts";
import { runDiagnosisAi } from "../_shared/diagnosis/diagnosis-ai-providers.ts";
import { buildDeterministicAnalysis } from "../_shared/diagnosis/build-deterministic-analysis.ts";
import {
  fetchLimitsForAccount,
  isFactsEnrichmentComplete,
  shouldSkipMetaRefetch,
} from "../_shared/diagnosis/diagnosis-facts-cache.ts";
import { userFacingDiagnosisError } from "../_shared/diagnosis/ai-failure-messages.ts";
import {
  createMetaGraphSession,
  metaFetchMaxRetries,
  metaGraphFetchJson,
  type MetaGraphSession,
} from "../_shared/meta-graph-throttle.ts";

const AD_INSIGHTS_FIELDS_FULL =
  "ad_id,ad_name,campaign_name,impressions,clicks,spend,ctr,cpm,actions,action_values,outbound_clicks,outbound_clicks_ctr,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions";
const AD_INSIGHTS_FIELDS_MIN =
  "ad_id,ad_name,campaign_name,impressions,clicks,spend,ctr,cpm,actions,action_values,outbound_clicks,outbound_clicks_ctr";


async function fetchAccountInsights(
  actId: string,
  token: string,
): Promise<Record<string, unknown>> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  u.searchParams.set(
    "fields",
    "impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,action_values",
  );
  u.searchParams.set("date_preset", "last_30d");
  u.searchParams.set("access_token", token);

  const r = await fetch(u.toString());
  const j = (await r.json()) as {
    data?: Record<string, unknown>[];
    error?: { message: string };
  };
  if (j.error) throw new Error(j.error.message);
  return j.data?.[0] ?? {};
}

async function fetchCampaigns(
  actId: string,
  token: string,
  limit = 40,
): Promise<Record<string, unknown>[]> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/campaigns`);
  u.searchParams.set("fields", "name,status,effective_status,objective,daily_budget,lifetime_budget");
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("access_token", token);
  const r = await fetch(u.toString());
  const j = (await r.json()) as {
    data?: Record<string, unknown>[];
    error?: { message: string };
  };
  if (j.error) throw new Error(j.error.message);
  return j.data ?? [];
}

// P1 — Profundidade analítica: insights por campanha (últimos 30d)
async function fetchCampaignInsights(
  actId: string,
  token: string,
  metaSession: MetaGraphSession,
): Promise<Record<string, unknown>[]> {
  if (metaSession.skipOptional()) return [];
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  u.searchParams.set("level", "campaign");
  u.searchParams.set(
    "fields",
    "campaign_id,campaign_name,impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,action_values,cost_per_action_type,inline_link_click_ctr,cost_per_inline_link_click",
  );
  u.searchParams.set("date_preset", "last_30d");
  u.searchParams.set("limit", "100");
  u.searchParams.set("access_token", token);
  const j = await metaGraphFetchJson<{
    data?: Record<string, unknown>[];
    error?: { message: string };
  }>(u, metaSession);
  return j.data ?? [];
}

// P1 — Insights por anúncio (top spenders) com criativo
/** Fase 2 — insights por ad set (reach, frequency) para overlap com evidência */
async function fetchAdSetInsights(
  actId: string,
  token: string,
  metaSession: MetaGraphSession,
  limit = 80,
): Promise<Record<string, unknown>[]> {
  if (metaSession.skipOptional()) return [];
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  u.searchParams.set("level", "adset");
  u.searchParams.set(
    "fields",
    "adset_id,adset_name,campaign_id,campaign_name,impressions,reach,frequency,spend,ctr,inline_link_clicks,cpm,cpc,actions,action_values,cost_per_result,purchase_roas",
  );
  u.searchParams.set("date_preset", "last_30d");
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("access_token", token);
  const j = await metaGraphFetchJson<{
    data?: Record<string, unknown>[];
    error?: { message: string };
  }>(u, metaSession);
  return j.data ?? [];
}

/** Fase 2 — targeting resumido (top campanhas por recorte). */
async function fetchAdSetsTargetingSample(
  campaigns: Record<string, unknown>[],
  token: string,
  metaSession: MetaGraphSession,
  maxCampaigns = 3,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (const c of campaigns.slice(0, maxCampaigns)) {
    if (metaSession.skipOptional()) break;
    const cid = String(c.id ?? "");
    if (!cid) continue;
    const u = new URL(`https://graph.facebook.com/v21.0/${cid}/adsets`);
    u.searchParams.set("fields", "id,name,campaign_id,targeting");
    u.searchParams.set("limit", "25");
    u.searchParams.set("access_token", token);
    try {
      await metaSession.beforeFetch();
      const r = await fetch(u.toString());
      const j = (await r.json()) as {
        data?: Record<string, unknown>[];
        error?: { message: string };
      };
      if (j.error) {
        metaSession.recordError(j.error.message);
        console.warn(
          `[process-diagnosis] adsets targeting ${cid}: ${j.error.message.slice(0, 120)}`,
        );
        continue;
      }
      if (j.data?.length) out.push(...j.data);
    } catch (e) {
      const msg = String(e);
      metaSession.recordError(msg);
      console.warn(`[process-diagnosis] adsets targeting fetch: ${msg.slice(0, 120)}`);
    }
  }
  return out.slice(0, 60);
}

async function fetchTopAdsInsights(
  actId: string,
  token: string,
  metaSession: MetaGraphSession,
  limit = 25,
): Promise<Record<string, unknown>[]> {
  const fieldSets = [AD_INSIGHTS_FIELDS_FULL, AD_INSIGHTS_FIELDS_MIN].slice(
    0,
    metaFetchMaxRetries(),
  );
  for (const fields of fieldSets) {
    if (metaSession.skipOptional()) return [];
    const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
    u.searchParams.set("level", "ad");
    u.searchParams.set("fields", fields);
    u.searchParams.set("date_preset", "last_30d");
    u.searchParams.set("sort", "spend_descending");
    u.searchParams.set("limit", String(limit));
    u.searchParams.set("access_token", token);
    try {
      await metaSession.beforeFetch();
      const r = await fetch(u.toString());
      const j = (await r.json()) as {
        data?: Record<string, unknown>[];
        error?: { message: string };
      };
      if (j.error) {
        metaSession.recordError(j.error.message);
        if (fields === AD_INSIGHTS_FIELDS_MIN) {
          console.warn(
            `[process-diagnosis] ad insights falhou: ${j.error.message.slice(0, 200)}`,
          );
          return [];
        }
        continue;
      }
      return j.data ?? [];
    } catch (e) {
      const msg = String(e);
      metaSession.recordError(msg);
      if (fields === AD_INSIGHTS_FIELDS_MIN) {
        console.warn(`[process-diagnosis] ad insights falhou: ${msg.slice(0, 200)}`);
        return [];
      }
    }
  }
  return [];
}

// ── Tendências temporais (14d vs 14d anteriores) ─────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildTrendWindows(): {
  current: { since: string; until: string };
  previous: { since: string; until: string };
} {
  const today = new Date();
  // "ontem" como until — evita janela parcial do dia corrente
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const currentSince = new Date(yesterday);
  currentSince.setUTCDate(currentSince.getUTCDate() - 13);
  const previousUntil = new Date(currentSince);
  previousUntil.setUTCDate(previousUntil.getUTCDate() - 1);
  const previousSince = new Date(previousUntil);
  previousSince.setUTCDate(previousSince.getUTCDate() - 13);
  return {
    current: { since: isoDate(currentSince), until: isoDate(yesterday) },
    previous: { since: isoDate(previousSince), until: isoDate(previousUntil) },
  };
}

function purchasesFromActions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  let total = 0;
  for (const a of actions as { action_type?: string; value?: string }[]) {
    if (/^purchase$|^omni_purchase$/i.test(a.action_type ?? "")) {
      total += Number(a.value ?? 0);
    }
  }
  return total;
}

function purchaseValueFromActionValues(actionValues: unknown): number {
  if (!Array.isArray(actionValues)) return 0;
  let total = 0;
  for (const a of actionValues as { action_type?: string; value?: string }[]) {
    if (/^purchase$|^omni_purchase$/i.test(a.action_type ?? "")) {
      total += Number(a.value ?? 0);
    }
  }
  return total;
}

type TrendSnapshot = {
  roas?: { current: number | null; previous: number | null; deltaPct: number | null };
  ctr?: { current: number | null; previous: number | null; deltaPct: number | null };
  cpm?: { current: number | null; previous: number | null; deltaPct: number | null };
  cpa?: { current: number | null; previous: number | null; deltaPct: number | null };
  spend?: { current: number | null; previous: number | null; deltaPct: number | null };
};

function deltaPct(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function snapshotFromRow(row: Record<string, unknown> | undefined): {
  roas: number | null;
  ctr: number | null;
  cpm: number | null;
  cpa: number | null;
  spend: number | null;
} {
  if (!row) return { roas: null, ctr: null, cpm: null, cpa: null, spend: null };
  const spend = Number(row.spend ?? 0) || null;
  const purchases = purchasesFromActions(row.actions);
  const revenue = purchaseValueFromActionValues(row.action_values);
  const roas = spend && revenue > 0 ? revenue / spend : null;
  const ctr = row.ctr != null ? Number(row.ctr) : null;
  const cpm = row.cpm != null ? Number(row.cpm) : null;
  const cpa = spend && purchases > 0 ? spend / purchases : null;
  return { roas, ctr, cpm, cpa, spend };
}

function buildSnapshot(
  curr: Record<string, unknown> | undefined,
  prev: Record<string, unknown> | undefined,
): TrendSnapshot {
  const c = snapshotFromRow(curr);
  const p = snapshotFromRow(prev);
  return {
    roas: { current: c.roas, previous: p.roas, deltaPct: deltaPct(c.roas, p.roas) },
    ctr: { current: c.ctr, previous: p.ctr, deltaPct: deltaPct(c.ctr, p.ctr) },
    cpm: { current: c.cpm, previous: p.cpm, deltaPct: deltaPct(c.cpm, p.cpm) },
    cpa: { current: c.cpa, previous: p.cpa, deltaPct: deltaPct(c.cpa, p.cpa) },
    spend: { current: c.spend, previous: p.spend, deltaPct: deltaPct(c.spend, p.spend) },
  };
}

async function fetchInsightsWindow(
  actId: string,
  token: string,
  metaSession: MetaGraphSession,
  level: "account" | "adset",
  range: { since: string; until: string },
  limit = 80,
): Promise<Record<string, unknown>[]> {
  if (metaSession.skipOptional()) return [];
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  if (level === "adset") {
    u.searchParams.set("level", "adset");
    u.searchParams.set(
      "fields",
      "adset_id,adset_name,spend,ctr,cpm,actions,action_values",
    );
    u.searchParams.set("limit", String(limit));
  } else {
    u.searchParams.set(
      "fields",
      "spend,ctr,cpm,actions,action_values",
    );
  }
  u.searchParams.set("time_range", JSON.stringify(range));
  u.searchParams.set("access_token", token);
  try {
    const j = await metaGraphFetchJson<{
      data?: Record<string, unknown>[];
      error?: { message: string };
    }>(u, metaSession);
    return j.data ?? [];
  } catch (e) {
    console.warn(
      `[process-diagnosis] trend fetch (${level}) falhou: ${String(e).slice(0, 200)}`,
    );
    return [];
  }
}

async function fetchTrendsBundle(
  actId: string,
  token: string,
  metaSession: MetaGraphSession,
): Promise<Record<string, unknown> | null> {
  const windows = buildTrendWindows();
  try {
    const [accountCurr, accountPrev, adsetCurr, adsetPrev] = await Promise.all([
      fetchInsightsWindow(actId, token, metaSession, "account", windows.current),
      fetchInsightsWindow(actId, token, metaSession, "account", windows.previous),
      fetchInsightsWindow(actId, token, metaSession, "adset", windows.current, 80),
      fetchInsightsWindow(actId, token, metaSession, "adset", windows.previous, 80),
    ]);
    const account = buildSnapshot(accountCurr[0], accountPrev[0]);
    const adsetsCurrMap = new Map<string, Record<string, unknown>>();
    for (const r of adsetCurr) adsetsCurrMap.set(String(r.adset_id ?? ""), r);
    const adsetsPrevMap = new Map<string, Record<string, unknown>>();
    for (const r of adsetPrev) adsetsPrevMap.set(String(r.adset_id ?? ""), r);
    const adsets: Record<string, TrendSnapshot> = {};
    const ids = new Set<string>([
      ...adsetsCurrMap.keys(),
      ...adsetsPrevMap.keys(),
    ]);
    for (const id of ids) {
      if (!id) continue;
      adsets[id] = buildSnapshot(adsetsCurrMap.get(id), adsetsPrevMap.get(id));
    }
    return { windows, account, adsets };
  } catch (e) {
    console.warn(`[process-diagnosis] fetchTrendsBundle: ${String(e).slice(0, 200)}`);
    return null;
  }
}

async function recordDiagnosisAiUsage(
  sb: ReturnType<typeof diagnosisServiceClient>,
  usage: { promptTokens: number; completionTokens: number; estimatedCostUsd: number },
): Promise<void> {
  const usageAgency = Deno.env.get("DIAGNOSIS_AI_AGENCY_ID")?.trim();
  if (!usageAgency) return;
  await sb.from("ai_usage_events").insert({
    agency_id: usageAgency,
    day: new Date().toISOString().slice(0, 10),
    function_name: "process-diagnosis",
    prompt_tokens: usage.promptTokens,
    completion_tokens: usage.completionTokens,
    estimated_cost_usd: usage.estimatedCostUsd,
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const traceId = traceIdFromRequest(req);
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const sb = diagnosisServiceClient();
  if (!(await isCronAuthenticated(req, sb))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { data: cleaned } = await sb.rpc("cleanup_stale_diagnosis_processing", {
    p_stale_minutes: 30,
  });
  if (cleaned && Number(cleaned) > 0) {
    traceLog("process_diagnosis.stale_cleaned", { count: cleaned }, traceId);
  }

  const { data: rows } = await sb
    .from("diagnoses")
    .select("id, meta_ad_account_id, status, business_context")
    .eq("status", "processing")
    .limit(
      Math.max(
        1,
        Math.min(
          25,
          Number(Deno.env.get("PROCESS_DIAGNOSIS_BATCH_SIZE") ?? "10") || 10,
        ),
      ),
    );

  if (!rows?.length) return jsonResponse({ processed: 0 });

  let processed = 0;
  for (const row of rows) {
    const id = row.id as string;
    const actId = row.meta_ad_account_id as string | null;
    if (!actId) continue;

    const { data: sec } = await sb
      .from("diagnosis_secrets")
      .select("access_token, token_expires_at")
      .eq("diagnosis_id", id)
      .maybeSingle();
    const token = sec?.access_token as string | undefined;
    if (!token) {
      await sb
        .from("diagnoses")
        .update({ status: "failed", failed_reason: "Token Meta ausente" })
        .eq("id", id);
      continue;
    }

    const expiresAt = sec?.token_expires_at as string | null | undefined;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      await sb
        .from("diagnoses")
        .update({
          status: "failed",
          failed_reason: "Token Meta expirado. Reconecta a conta Meta.",
        })
        .eq("id", id);
      continue;
    }

    const { data: rep } = await sb
      .from("diagnosis_reports")
      .select("facts_json, analysis_json, prompt_version")
      .eq("diagnosis_id", id)
      .maybeSingle();

    let factsForAnalysis = rep?.facts_json as Record<string, unknown> | null;
    // Invalida análise antiga quando o prompt mudou (re-roda IA com facts atualizados).
    const analysisExisting =
      rep?.prompt_version === PROMPT_VERSION ? rep?.analysis_json : null;

    try {
      const metaSession = createMetaGraphSession();
      const needsEnrichment =
        !shouldSkipMetaRefetch(factsForAnalysis) &&
        !isFactsEnrichmentComplete(factsForAnalysis);

      if (needsEnrichment) {
        const account_insights = await fetchAccountInsights(actId, token);
        const spendBrl = parseAccountSpendBrl(account_insights);
        const smallAccount = isSmallAccountSpend(spendBrl);
        const limits = fetchLimitsForAccount(smallAccount);
        const cachedSample =
          factsForAnalysis?.campaigns_sample as Record<string, unknown>[] | undefined;
        const cachedSampleHasObjective =
          Array.isArray(cachedSample) &&
          cachedSample.some((c) => typeof c?.objective === "string" && c.objective.length > 0);
        const campaigns = cachedSampleHasObjective
          ? cachedSample!
          : await fetchCampaigns(actId, token, limits.campaignSample);
        let campaigns_insights: Record<string, unknown>[] = [];
        let ads_insights_top: Record<string, unknown>[] = [];
        let adsets_insights: Record<string, unknown>[] = [];
        let adsets_targeting_sample: Record<string, unknown>[] = [];
        try {
          campaigns_insights = await fetchCampaignInsights(actId, token, metaSession);
        } catch (e) {
          console.warn(`[process-diagnosis] campaign insights falhou: ${String(e).slice(0, 200)}`);
        }
        try {
          adsets_insights = await fetchAdSetInsights(
            actId,
            token,
            metaSession,
            limits.adsetInsights,
          );
        } catch (e) {
          console.warn(`[process-diagnosis] adset insights falhou: ${String(e).slice(0, 200)}`);
        }
        try {
          adsets_targeting_sample = await fetchAdSetsTargetingSample(
            campaigns.slice(0, limits.targetingCampaigns),
            token,
            metaSession,
            3,
          );
        } catch (e) {
          console.warn(
            `[process-diagnosis] adset targeting falhou: ${String(e).slice(0, 200)}`,
          );
        }
        try {
          ads_insights_top = await fetchTopAdsInsights(
            actId,
            token,
            metaSession,
            limits.adsTop,
          );
        } catch (e) {
          console.warn(`[process-diagnosis] ad insights falhou: ${String(e).slice(0, 200)}`);
        }
        let trends: Record<string, unknown> | null = null;
        if (!smallAccount) {
          try {
            trends = await fetchTrendsBundle(actId, token, metaSession);
          } catch (e) {
            console.warn(`[process-diagnosis] trends falhou: ${String(e).slice(0, 200)}`);
          }
        }
        const { campaigns_enriched, objective_spend_mix } = buildFactsEnrichment(
          campaigns.slice(0, limits.campaignSample),
          campaigns_insights.slice(0, limits.campaignInsights),
        );
        const factsBase = {
          meta_ad_account_id: actId,
          date_preset: "last_30d",
          account_insights,
          campaigns_sample: campaigns.slice(0, limits.campaignSample),
          campaigns_insights: campaigns_insights.slice(0, limits.campaignInsights),
          campaigns_enriched,
          objective_spend_mix,
          ads_insights_top: ads_insights_top.slice(0, limits.adsTop),
          adsets_insights: adsets_insights.slice(0, limits.adsetInsights),
          adsets_targeting_sample: adsets_targeting_sample.slice(0, 60),
          trends,
          generated_at: new Date().toISOString(),
          fetch_profile: smallAccount ? "lite" : "full",
        };
        const facts = {
          ...factsBase,
          funnel_guidance: deriveFunnelGuidanceForAi(factsBase),
        };
        await sb.from("diagnosis_reports").upsert({
          diagnosis_id: id,
          facts_json: facts,
          updated_at: new Date().toISOString(),
        });
        factsForAnalysis = facts as unknown as Record<string, unknown>;
      }

      const accountInsights = factsForAnalysis?.account_insights as
        | Record<string, unknown>
        | undefined;
      const smallAccount = isSmallAccountSpend(parseAccountSpendBrl(accountInsights));

      if (factsForAnalysis && token) {
        const hasLearningData =
          Array.isArray(factsForAnalysis.adsets_config) &&
          (factsForAnalysis.adsets_config as Record<string, unknown>[]).some(
            (a) => "learning_stage_info" in (a as Record<string, unknown>),
          );
        const needsMetaSenior =
          !factsForAnalysis.meta_senior ||
          !Array.isArray(factsForAnalysis.ads_insights_auction) ||
          !hasLearningData;
        if (needsMetaSenior) {
          try {
            await enrichFactsWithMetaSeniorFetch(
              factsForAnalysis,
              actId,
              token,
              metaSession,
              { lite: smallAccount },
            );
          } catch (e) {
            console.warn(
              `[process-diagnosis] meta-senior fetch: ${String(e).slice(0, 200)}`,
            );
          }
        }
      }

      if (factsForAnalysis) {
        mergeBusinessContextIntoFacts(
          factsForAnalysis,
          row.business_context as Record<string, unknown> | null,
        );
        attachCommercialToFacts(factsForAnalysis);
        await sb
          .from("diagnosis_reports")
          .update({
            facts_json: factsForAnalysis,
            updated_at: new Date().toISOString(),
          })
          .eq("diagnosis_id", id);
      }

      if (!analysisExisting && factsForAnalysis) {
        const budgetExceeded = await diagnosisAiBudgetExceeded(sb, 12000);
        let analysis: Record<string, unknown>;
        let analysisMeta: Record<string, unknown>;

        if (budgetExceeded) {
          traceLog("process_diagnosis.deterministic_budget", { diagnosis_id: id }, traceId);
          analysis = buildDeterministicAnalysis(factsForAnalysis);
          analysisMeta = {
            provider: "deterministic",
            narrative_source: "deterministic",
            consultative_quality: "deferred",
            attempts: [{ provider: "deterministic", ok: true, error: "budget_exceeded" }],
            generated_at: new Date().toISOString(),
            prompt_version: PROMPT_VERSION,
          };
        } else {
          const aiResult = await runDiagnosisAi(factsForAnalysis);
          if (aiResult.ok) {
            analysis = normalizeAnalysisV2(aiResult.analysis, factsForAnalysis);
            analysisMeta = {
              provider: aiResult.provider,
              model: aiResult.model,
              narrative_source: "ai",
              attempts: aiResult.attempts,
              generated_at: new Date().toISOString(),
              prompt_version: PROMPT_VERSION,
              usage: aiResult.usage,
            };
            await recordDiagnosisAiUsage(sb, aiResult.usage);
            console.log(
              `[process-diagnosis] ${aiResult.provider}/${aiResult.model} OK`,
            );
          } else {
            traceLog(
              "process_diagnosis.deterministic_fallback",
              { reason: aiResult.reason, attempts: aiResult.attempts },
              traceId,
            );
            analysis = buildDeterministicAnalysis(factsForAnalysis);
            analysisMeta = {
              provider: "deterministic",
              narrative_source: "deterministic",
            consultative_quality: "deferred",
              attempts: aiResult.attempts,
              fallback_reason: aiResult.reason,
              generated_at: new Date().toISOString(),
              prompt_version: PROMPT_VERSION,
            };
          }
        }

        const analysisWithMeta = {
          ...analysis,
          __meta: analysisMeta,
        };
        await sb
          .from("diagnosis_reports")
          .update({
            analysis_json: analysisWithMeta,
            prompt_version: PROMPT_VERSION,
            updated_at: new Date().toISOString(),
          })
          .eq("diagnosis_id", id);
      }

      const { data: finalRep } = await sb
        .from("diagnosis_reports")
        .select("facts_json, analysis_json")
        .eq("diagnosis_id", id)
        .maybeSingle();

      await sb
        .from("diagnoses")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);

      try {
        await recordDiagnosisFollowup(
          sb,
          id,
          finalRep?.facts_json as Record<string, unknown> | null,
          finalRep?.analysis_json as Record<string, unknown> | null,
        );
      } catch (followErr) {
        console.warn(
          `[process-diagnosis] followup snapshot: ${String(followErr).slice(0, 200)}`,
        );
      }

      processed++;
    } catch (e) {
      const raw = String(e);
      console.error(raw);
      const failedReason = userFacingDiagnosisError(raw).slice(0, 500);
      await sb
        .from("diagnoses")
        .update({
          status: "failed",
          failed_reason: failedReason,
        })
        .eq("id", id);
    }
  }

  traceLog("process_diagnosis.done", { processed }, traceId);
  return jsonResponse({ processed });
});
