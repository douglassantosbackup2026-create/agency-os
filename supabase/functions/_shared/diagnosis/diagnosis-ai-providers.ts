import { SYSTEM_PROMPT_V4 } from "./diagnosis-prompt-v4.ts";
import { buildUserPromptSlim } from "./build-ai-prompt.ts";
import {
  validateAnalysis,
  validateAnalysisBasics,
} from "./diagnosis-validate-analysis.ts";
import type { AiAttempt } from "./ai-failure-messages.ts";
import { isAnthropicRateLimitError } from "./ai-failure-messages.ts";
import { sleep } from "../meta-graph-throttle.ts";

export type DiagnosisProviderName = "anthropic" | "openai" | "gemini";

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
};

export type DiagnosisAiSuccess = {
  ok: true;
  analysis: Record<string, unknown>;
  provider: DiagnosisProviderName;
  model: string;
  usage: TokenUsage;
  attempts: AiAttempt[];
  narrative_source: "ai";
};

export type DiagnosisAiFailure = {
  ok: false;
  reason: "validation_failed" | "all_providers_failed";
  attempts: AiAttempt[];
};

export type DiagnosisAiResult = DiagnosisAiSuccess | DiagnosisAiFailure;

const AI_TIMEOUT_MS = Math.max(
  30_000,
  Number(Deno.env.get("DIAGNOSIS_AI_TIMEOUT_MS") ?? "120000") || 120_000,
);

export function diagnosisAiMaxTokens(): number {
  return Math.max(
    1024,
    Math.min(
      8192,
      Number(Deno.env.get("DIAGNOSIS_AI_MAX_TOKENS") ?? "6144") || 6144,
    ),
  );
}

function primaryProvider(): DiagnosisProviderName {
  const p = (Deno.env.get("DIAGNOSIS_AI_PRIMARY") ?? "anthropic").toLowerCase();
  if (p === "openai" || p === "gemini") return p;
  return "anthropic";
}

function primaryModel(provider: DiagnosisProviderName): string {
  if (provider === "anthropic") {
    return Deno.env.get("DIAGNOSIS_AI_PRIMARY_MODEL") ??
      Deno.env.get("CLAUDE_MODEL") ??
      "claude-sonnet-4-20250514";
  }
  if (provider === "openai") {
    return Deno.env.get("DIAGNOSIS_AI_PRIMARY_MODEL") ??
      Deno.env.get("OPENAI_MODEL") ??
      "gpt-4o";
  }
  return Deno.env.get("DIAGNOSIS_AI_PRIMARY_MODEL") ??
    Deno.env.get("GEMINI_MODEL") ??
    "gemini-2.5-pro";
}

function fallbackModel(provider: DiagnosisProviderName): string {
  if (provider === "anthropic") {
    return Deno.env.get("DIAGNOSIS_AI_FALLBACK_MODEL") ??
      "claude-sonnet-4-20250514";
  }
  if (provider === "openai") {
    return Deno.env.get("DIAGNOSIS_AI_FALLBACK_MODEL") ?? "gpt-4o";
  }
  return Deno.env.get("DIAGNOSIS_AI_FALLBACK_MODEL") ?? "gemini-2.5-pro";
}

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const m = model.toLowerCase();
  let inputPerM = 3;
  let outputPerM = 15;
  if (m.includes("haiku")) {
    inputPerM = 0.25;
    outputPerM = 1.25;
  } else if (m.includes("flash") || m.includes("4o-mini")) {
    inputPerM = 0.15;
    outputPerM = 0.6;
  } else if (m.includes("sonnet")) {
    inputPerM = 3;
    outputPerM = 15;
  } else if (m.includes("gpt-4o") && !m.includes("mini")) {
    inputPerM = 2.5;
    outputPerM = 10;
  } else if (m.includes("gemini-2.5-pro")) {
    inputPerM = 1.25;
    outputPerM = 5;
  }
  return (promptTokens * inputPerM + completionTokens * outputPerM) / 1_000_000;
}

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms = AI_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

type ProviderCallResult = {
  analysis: unknown;
  usage: TokenUsage;
};

async function callAnthropicModel(
  facts: Record<string, unknown>,
  model: string,
): Promise<ProviderCallResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");

  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: diagnosisAiMaxTokens(),
      system: SYSTEM_PROMPT_V4,
      messages: [{ role: "user", content: buildUserPromptSlim(facts) }],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = body.content?.find((c) => c.type === "text")?.text ?? "";
  const promptTokens = body.usage?.input_tokens ?? 0;
  const completionTokens = body.usage?.output_tokens ?? 0;
  return {
    analysis: extractJsonFromText(text),
    usage: {
      promptTokens,
      completionTokens,
      estimatedCostUsd: estimateCostUsd(model, promptTokens, completionTokens),
    },
  };
}

async function callOpenAIModel(
  facts: Record<string, unknown>,
  model: string,
): Promise<ProviderCallResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente");

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT_V4 },
          { role: "user", content: buildUserPromptSlim(facts) },
        ],
        response_format: { type: "json_object" },
      }),
    },
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = body.choices?.[0]?.message?.content ?? "";
  const promptTokens = body.usage?.prompt_tokens ?? 0;
  const completionTokens = body.usage?.completion_tokens ?? 0;
  return {
    analysis: extractJsonFromText(text),
    usage: {
      promptTokens,
      completionTokens,
      estimatedCostUsd: estimateCostUsd(model, promptTokens, completionTokens),
    },
  };
}

async function callGeminiModel(
  facts: Record<string, unknown>,
  model: string,
): Promise<ProviderCallResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT_V4 }] },
      contents: [
        { role: "user", parts: [{ text: buildUserPromptSlim(facts) }] },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: diagnosisAiMaxTokens(),
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const promptTokens = body.usageMetadata?.promptTokenCount ?? 0;
  const completionTokens = body.usageMetadata?.candidatesTokenCount ?? 0;
  return {
    analysis: extractJsonFromText(text),
    usage: {
      promptTokens,
      completionTokens,
      estimatedCostUsd: estimateCostUsd(model, promptTokens, completionTokens),
    },
  };
}

async function callProviderModel(
  provider: DiagnosisProviderName,
  facts: Record<string, unknown>,
  model: string,
): Promise<ProviderCallResult> {
  if (provider === "anthropic") return callAnthropicModel(facts, model);
  if (provider === "openai") return callOpenAIModel(facts, model);
  return callGeminiModel(facts, model);
}

async function tryModel(
  provider: DiagnosisProviderName,
  model: string,
  facts: Record<string, unknown>,
  attempts: AiAttempt[],
): Promise<DiagnosisAiSuccess | null> {
  let retried = false;
  while (true) {
    const t0 = Date.now();
    try {
      const { analysis, usage } = await callProviderModel(provider, facts, model);
      const ms = Date.now() - t0;
      if (!validateAnalysisBasics(analysis)) {
        attempts.push({
          provider: `${provider}:${model}`,
          ok: false,
          ms,
          error: "validation_failed",
        });
        return null;
      }
      if (!validateAnalysis(analysis, facts)) {
        attempts.push({
          provider: `${provider}:${model}`,
          ok: false,
          ms,
          error: "validation_quality_failed",
        });
        return null;
      }
      attempts.push({ provider: `${provider}:${model}`, ok: true, ms });
      return {
        ok: true,
        analysis: analysis as Record<string, unknown>,
        provider,
        model,
        usage,
        attempts,
        narrative_source: "ai",
      };
    } catch (e) {
      const ms = Date.now() - t0;
      const err = String(e).slice(0, 300);
      if (
        provider === "anthropic" &&
        isAnthropicRateLimitError(err) &&
        !retried
      ) {
        retried = true;
        await sleep(3000);
        continue;
      }
      attempts.push({
        provider: `${provider}:${model}`,
        ok: false,
        ms,
        error: err,
      });
      throw e;
    }
  }
}

function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    estimatedCostUsd: a.estimatedCostUsd + b.estimatedCostUsd,
  };
}

/** Consultor sênior: tenta primário (Sonnet) e fallback em falha de validação ou HTTP. */
export async function runDiagnosisAi(
  facts: Record<string, unknown>,
): Promise<DiagnosisAiResult> {
  const attempts: AiAttempt[] = [];
  const provider = primaryProvider();
  const models = [
    ...new Set([
      primaryModel(provider),
      fallbackModel(provider),
    ]),
  ];
  let usageAcc: TokenUsage | null = null;

  for (const model of models) {
    try {
      const result = await tryModel(provider, model, facts, attempts);
      if (result) {
        usageAcc = usageAcc
          ? mergeUsage(usageAcc, result.usage)
          : result.usage;
        return { ...result, usage: usageAcc };
      }
    } catch {
      /* HTTP/timeout — tenta próximo modelo */
    }
  }

  const validationFailed = attempts.some((a) =>
    String(a.error ?? "").includes("validation")
  );
  return {
    ok: false,
    reason: validationFailed ? "validation_failed" : "all_providers_failed",
    attempts,
  };
}
