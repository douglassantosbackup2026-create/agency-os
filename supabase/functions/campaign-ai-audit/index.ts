import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  baseGovernance,
  normalizeConfidence,
  parseAiJson,
  type PromptKey,
} from "../_shared/ai-v3.ts";
import { assertUserCanAccessClient } from "../_shared/membership.ts";
import { isCronAuthenticated } from "../_shared/cron-agency-scope.ts";
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
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";
import { fetchWithTimeout } from "../_shared/fetch-with-timeout.ts";
import { aiBudgetExceeded } from "../_shared/ai-budget.ts";
import {
  CampaignAuditRunnerError,
  executeCampaignAudit,
} from "../_shared/campaign-audit-runner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-ai-job-id",
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
  const traceId = traceIdFromRequest(req);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);
  const jobIdHeader = req.headers.get("x-ai-job-id")?.trim() ?? "";
  const isJobRunner =
    !!jobIdHeader && (await isCronAuthenticated(req, admin));
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader && !isJobRunner) {
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

    if (isJobRunner) {
      const { data: jobRow } = await admin
        .from("ai_jobs")
        .select("id, status, payload")
        .eq("id", jobIdHeader)
        .maybeSingle();
      if (!jobRow || jobRow.status !== "processing") {
        return new Response(JSON.stringify({ error: "Job inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      body = { ...(jobRow.payload as Record<string, unknown>), ...body };
    }

    const client_id = body?.client_id as string | undefined;
    const period_days = clampCampaignAuditPeriodDays(body?.period_days);

    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userId: string;
    if (isJobRunner) {
      userId = String((body as Record<string, unknown>).created_by ?? "");
      if (!userId) {
        return new Response(JSON.stringify({ error: "Job sem created_by" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
          Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader! } } },
      );
      const { data: userRes } = await userClient.auth.getUser();
      if (!userRes.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = userRes.user.id;
    }

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

    if (!isJobRunner) {
      const allowed = await assertUserCanAccessClient(admin, userId, {
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
    }

    if (
      !isJobRunner &&
      Deno.env.get("CAMPAIGN_AUDIT_SYNC_MODE") !== "true"
    ) {
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
      const { data: job, error: jobErr } = await admin
        .from("ai_jobs")
        .insert({
          agency_id: client.agency_id,
          client_id,
          job_type: "campaign_audit",
          status: "pending",
          payload: {
            client_id,
            period_days,
            created_by: userId,
          },
          attempts: 0,
        })
        .select("id, status")
        .single();
      if (jobErr) {
        return new Response(JSON.stringify({ error: jobErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          job_id: job.id,
          status: job.status,
          async: true,
        }),
        {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    try {
      const audit = await executeCampaignAudit({
        admin,
        client,
        client_id,
        userId,
        period_days,
      });
      edgeLogDone("campaign_ai_audit.ok", t0, {
        client_id,
        agency_id: client.agency_id,
        period_days,
        trace_id: traceId,
      });
      traceLog("campaign_ai_audit.ok", { client_id, period_days }, traceId);
      return new Response(JSON.stringify({ ok: true, audit }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      if (e instanceof CampaignAuditRunnerError) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: e.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }
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
