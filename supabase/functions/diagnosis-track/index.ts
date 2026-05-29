import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { assertDiagnosisSecret } from "../_shared/diagnosis/validate-diagnosis-access.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "diagnosis_track");
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed" }, 405);

  let body: { diagnosis_id?: string; secret_slug?: string; event?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const d = body.diagnosis_id ?? "";
  const s = body.secret_slug ?? "";
  const ev = body.event ?? "";
  const gate = await assertDiagnosisSecret(d, s);
  if (!gate.ok) return jsonResponse({ error: gate.message }, gate.status);

  const sb = diagnosisServiceClient();
  const now = new Date().toISOString();
  if (ev === "viewed") {
    await sb
      .from("diagnoses")
      .update({ viewed_at: now })
      .eq("id", d)
      .is("viewed_at", null);
  } else if (ev === "cta") {
    await sb.from("diagnoses").update({ cta_clicked_at: now }).eq("id", d);
  } else {
    return jsonResponse({ error: "event inválido" }, 400);
  }

  trace.done({ event: ev });
  return jsonResponse({ ok: true });
});
