/** Alinhado com supabase/functions/_shared/ai-v3.ts */

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
