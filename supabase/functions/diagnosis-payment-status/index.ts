import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";

const DIAGNOSIS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "GET")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const d = url.searchParams.get("d") ?? "";
  const s = url.searchParams.get("s") ?? "";
  if (!DIAGNOSIS_ID_RE.test(d) || !s) {
    return jsonResponse({ error: "parâmetros inválidos" }, 400);
  }

  const sb = diagnosisServiceClient();
  const { data } = await sb
    .from("diagnoses")
    .select("status, secret_slug")
    .eq("id", d)
    .maybeSingle();

  if (!data || data.secret_slug !== s) {
    return jsonResponse({ error: "não encontrado" }, 404);
  }

  // If payment confirmed, surface the one-shot auto-login token (then clear it).
  let autoLoginToken: string | null = null;
  if (data.status && data.status !== "awaiting_payment") {
    const { data: sec } = await sb
      .from("diagnosis_secrets")
      .select("auto_login_token, auto_login_expires_at")
      .eq("diagnosis_id", d)
      .maybeSingle();
    if (sec?.auto_login_token && sec.auto_login_expires_at) {
      const exp = new Date(sec.auto_login_expires_at).getTime();
      if (exp > Date.now()) {
        autoLoginToken = sec.auto_login_token as string;
        // single-use: clear so reload doesn't replay
        await sb
          .from("diagnosis_secrets")
          .update({ auto_login_token: null, auto_login_expires_at: null })
          .eq("diagnosis_id", d);
      }
    }
  }

  return jsonResponse({ status: data.status, auto_login_token: autoLoginToken });
});
