/** Parsing puro de payloads HTTP de IA — testável em Vitest sem Deno. */

export function textFromAnthropicMessagesPayload(json: unknown): string {
  const j = json as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const parts = j.content ?? [];
  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");
}

export function contentFromGatewayChatCompletion(json: unknown): string {
  const j = json as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return j?.choices?.[0]?.message?.content ?? "{}";
}

/** Igual à lógica em campaign-ai-audit para period_days. */
export function clampCampaignAuditPeriodDays(raw: unknown): number {
  const n = Number(raw ?? 30);
  const base = Number.isFinite(n) ? n : 30;
  return Math.min(90, Math.max(7, base));
}
