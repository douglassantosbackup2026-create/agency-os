import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { assertDiagnosisSecret } from "../_shared/diagnosis/validate-diagnosis-access.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";

type Body = {
  diagnosis_id?: string;
  secret_slug?: string;
  context?: {
    niche?: string;
    avg_ticket_brl?: number | string | null;
    margin_pct?: number | string | null;
    monthly_goal_brl?: number | string | null;
    target_roas?: number | string | null;
    notes?: string;
  };
};

const toNumberOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const clamp = (n: number | null, min: number, max: number): number | null => {
  if (n === null) return null;
  if (n < min) return min;
  if (n > max) return max;
  return n;
};

const sanitizeText = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "diagnosis_context");
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed" }, 405);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const d = body.diagnosis_id ?? "";
  const s = body.secret_slug ?? "";
  const gate = await assertDiagnosisSecret(d, s);
  if (!gate.ok) return jsonResponse({ error: gate.message }, gate.status);

  const ctx = body.context ?? {};
  const cleaned = {
    niche: sanitizeText(ctx.niche, 120),
    avg_ticket_brl: clamp(toNumberOrNull(ctx.avg_ticket_brl), 0, 1_000_000),
    margin_pct: clamp(toNumberOrNull(ctx.margin_pct), 0, 100),
    monthly_goal_brl: clamp(toNumberOrNull(ctx.monthly_goal_brl), 0, 100_000_000),
    target_roas: clamp(toNumberOrNull(ctx.target_roas), 1, 50),
    notes: sanitizeText(ctx.notes, 600),
    saved_at: new Date().toISOString(),
  };

  const hasAny =
    cleaned.niche ||
    cleaned.avg_ticket_brl !== null ||
    cleaned.margin_pct !== null ||
    cleaned.monthly_goal_brl !== null ||
    cleaned.target_roas !== null ||
    cleaned.notes;

  const sb = diagnosisServiceClient();
  const { error } = await sb
    .from("diagnoses")
    .update({ business_context: hasAny ? cleaned : null })
    .eq("id", d);

  if (error) {
    trace.done({ error: error.message });
    return jsonResponse({ error: "Falha ao salvar contexto" }, 500);
  }

  trace.done({ diagnosis_id: d, saved: Boolean(hasAny) });
  return jsonResponse({ ok: true, context: hasAny ? cleaned : null });
});
