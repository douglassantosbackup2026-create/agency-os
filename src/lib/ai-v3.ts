export type AiV3Confidence = "alta" | "media" | "baixa";

export function parseAiV3Json(content: string): {
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

export function normalizeAiV3Confidence(v: unknown): AiV3Confidence {
  const value = String(v ?? "")
    .toLowerCase()
    .trim();
  if (value === "alta") return "alta";
  if (value === "baixa") return "baixa";
  return "media";
}
