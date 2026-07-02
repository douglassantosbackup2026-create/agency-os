import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";
import { getLeadSlotSnapshot } from "../_shared/lead-slots-shared.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "lead_available_slots");

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const sb = diagnosisServiceClient();
  const ip = publicClientIp(req);
  if (await publicRateLimitExceeded(sb, `lead-slots:${ip}`)) {
    return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429);
  }

  const slots = await getLeadSlotSnapshot(sb);
  trace.done({ available: slots.available, used: slots.used });
  return jsonResponse(slots);
});
