export type Confidence = "alta" | "media" | "baixa";

export type PromptKey =
  | "01-analise-mensal-gestor"
  | "02-analise-mensal-cliente"
  | "03-analise-sob-demanda"
  | "04-alerta-whatsapp"
  | "05-pauta-reuniao"
  | "06-inteligencia-concorrentes";

export function parseAiJson(content: string): {
  text: string;
  json: Record<string, unknown>;
  parseOk: boolean;
} {
  const cleaned = content
    .replace(/```json\n?/g, "")
    .replace(/```/g, "")
    .trim();
  try {
    return { text: cleaned, json: JSON.parse(cleaned), parseOk: true };
  } catch {
    return { text: cleaned, json: { raw_text: cleaned }, parseOk: false };
  }
}

export function normalizeConfidence(value: unknown): Confidence {
  const v = String(value ?? "")
    .toLowerCase()
    .trim();
  if (v === "alta") return "alta";
  if (v === "baixa") return "baixa";
  return "media";
}

export function baseGovernance(promptKey: PromptKey, requiresReview: boolean) {
  return {
    prompt_version: "v3",
    prompt_key: promptKey,
    requer_revisao_humana: requiresReview,
    status_envio: requiresReview ? "pendente_revisao" : "aprovado",
  };
}
