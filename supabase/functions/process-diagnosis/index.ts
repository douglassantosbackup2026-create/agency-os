import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { assertCronOrUser } from "../_shared/cron-auth.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";

const PROMPT_VERSION = "diagnosis-ecommerce-v1";

function extractJsonFromClaude(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

function validateAnalysis(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return typeof o.score === "number" && typeof o.summary === "string";
}

async function fetchAccountInsights(
  actId: string,
  token: string,
): Promise<Record<string, unknown>> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  u.searchParams.set(
    "fields",
    "impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions",
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
): Promise<Record<string, unknown>[]> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/campaigns`);
  u.searchParams.set("fields", "name,status,effective_status");
  u.searchParams.set("limit", "40");
  u.searchParams.set("access_token", token);
  const r = await fetch(u.toString());
  const j = (await r.json()) as {
    data?: Record<string, unknown>[];
    error?: { message: string };
  };
  if (j.error) throw new Error(j.error.message);
  return j.data ?? [];
}

async function runClaude(facts: Record<string, unknown>): Promise<unknown> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");
  const model = Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-4-20250514";

  const system = `És um auditor de Meta Ads para e-commerce em PT-BR. Responde APENAS com JSON válido (sem markdown), com a estrutura:
{
  "score": number (0-100),
  "scoreLabel": string,
  "summary": string,
  "metrics": [{ "name": string, "current": string, "reference": string, "status": "ok"|"warn"|"bad" }],
  "criticalIssues": [{ "title": string, "description": string, "priority": "high"|"medium"|"low" }],
  "budgetLeaks": [{ "title": string, "estimateNote": string, "hint": string }],
  "opportunities": [{ "title": string, "potentialNote": string, "complexity": "quick"|"medium"|"advanced" }],
  "creativesSummary": { "best": string, "worst": string, "recommendation": string },
  "audiencesSummary": { "segmentation": string, "notes": string[] },
  "structureNotes": string[],
  "actionPlan": [{ "step": number, "action": string, "impact": string, "eta": string }],
  "improvementScenario": { "note": string, "confidence": "high"|"medium"|"low" },
  "disclaimer": string
}
Usa linguagem de estimativa nos impactos financeiros. Nunca garantas ROAS.`;

  const user = `Dados normalizados (facts_json):\n${JSON.stringify(facts).slice(0, 120000)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude HTTP ${res.status}: ${t.slice(0, 500)}`);
  }
  const body = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = body.content?.find((c) => c.type === "text")?.text ?? "";
  let parsed: unknown;
  try {
    parsed = extractJsonFromClaude(text);
  } catch {
    throw new Error("JSON inválido na resposta Claude");
  }
  return parsed;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = await assertCronOrUser(req);
  if (auth) return auth;

  const sb = diagnosisServiceClient();
  const { data: rows } = await sb
    .from("diagnoses")
    .select("id, meta_ad_account_id, status")
    .eq("status", "processing")
    .limit(3);

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
        .update({
          status: "failed",
          failed_reason: "Token Meta ausente",
        })
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
      .select("facts_json, analysis_json")
      .eq("diagnosis_id", id)
      .maybeSingle();

    let factsForAnalysis = rep?.facts_json as Record<string, unknown> | null;
    const analysisExisting = rep?.analysis_json;

    try {
      if (!factsForAnalysis) {
        const account_insights = await fetchAccountInsights(actId, token);
        const campaigns = await fetchCampaigns(actId, token);
        const facts = {
          meta_ad_account_id: actId,
          date_preset: "last_30d",
          account_insights,
          campaigns_sample: campaigns.slice(0, 40),
          generated_at: new Date().toISOString(),
        };
        await sb.from("diagnosis_reports").upsert({
          diagnosis_id: id,
          facts_json: facts,
          prompt_version: PROMPT_VERSION,
          updated_at: new Date().toISOString(),
        });
        factsForAnalysis = facts as unknown as Record<string, unknown>;
      }

      if (!analysisExisting) {
        const analysis = await runClaude(factsForAnalysis);
        if (!validateAnalysis(analysis)) {
          throw new Error("Resposta Claude inválida");
        }
        await sb
          .from("diagnosis_reports")
          .update({
            analysis_json: analysis,
            prompt_version: PROMPT_VERSION,
            updated_at: new Date().toISOString(),
          })
          .eq("diagnosis_id", id);

        await sb
          .from("diagnoses")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", id);
        processed++;
        continue;
      }

      await sb
        .from("diagnoses")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);
    } catch (e) {
      console.error(e);
      await sb
        .from("diagnoses")
        .update({
          status: "failed",
          failed_reason: String(e).slice(0, 500),
        })
        .eq("id", id);
    }
  }

  return jsonResponse({ processed });
});
