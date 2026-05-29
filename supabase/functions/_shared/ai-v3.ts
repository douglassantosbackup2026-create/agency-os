export type Confidence = "alta" | "media" | "baixa";

export const ALLOWED_CLICK_CONTEXTS = new Set([
  "reuniao",
  "pos_ajuste",
  "suspeita_problema",
  "checkin_rotina",
]);

export function normalizeClickContext(raw: unknown): string | null {
  const v = String(raw ?? "checkin_rotina").trim();
  if (!ALLOWED_CLICK_CONTEXTS.has(v)) return null;
  return v;
}

/** Sanitiza texto livre antes de injetar em prompts LLM. */
export function sanitizePromptField(
  value: unknown,
  maxLen = 500,
): string {
  const s = String(value ?? "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "sem observações";
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

export type PromptKey =
  | "01-analise-mensal-gestor"
  | "02-analise-mensal-cliente"
  | "03-analise-sob-demanda"
  | "04-alerta-whatsapp"
  | "05-pauta-reuniao"
  | "06-inteligencia-concorrentes"
  | "07-auditoria-campanhas";

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
