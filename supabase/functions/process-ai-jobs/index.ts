import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { isCronAuthenticated } from "../_shared/cron-agency-scope.ts";
import { edgeLog, edgeLogDone } from "../_shared/edge-log.ts";
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";
import { normalizeClickContext } from "../_shared/ai-v3.ts";
import {
  executeReportGeneration,
  ReportRunnerHttpError,
  type ReportMode,
} from "../_shared/report-runner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (!isCronAuthenticated(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const traceId = traceIdFromRequest(req);
  const t0 = Date.now();
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const limit = Math.max(
    1,
    Math.min(10, Number(Deno.env.get("AI_JOBS_BATCH_SIZE") ?? "5") || 5),
  );

  let agencyFilter: string | undefined;
  if (typeof body.agency_id === "string" && body.agency_id.trim()) {
    agencyFilter = body.agency_id.trim();
  }

  const { data: jobs, error } = await admin.rpc("claim_ai_jobs", {
    p_limit: limit,
  });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    if (agencyFilter && String(job.agency_id) !== agencyFilter) continue;
    const jobId = String(job.id);
    const payload = (job.payload ?? {}) as Record<string, unknown>;

    if (job.job_type === "report") {
      const client_id = String(job.client_id ?? payload.client_id ?? "").trim();
      const clickContext = normalizeClickContext(payload.click_context);
      const userId = String(payload.generated_by ?? "").trim();
      const mode = String(payload.mode ?? "monthly_manager") as ReportMode;

      if (!client_id || !clickContext || !userId) {
        failed++;
        await admin
          .from("ai_jobs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            last_error: "payload inválido (client_id, click_context ou generated_by)",
          })
          .eq("id", jobId);
        continue;
      }

      const { data: client } = await admin
        .from("clients")
        .select("*")
        .eq("id", client_id)
        .maybeSingle();

      if (!client) {
        failed++;
        await admin
          .from("ai_jobs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            last_error: "cliente não encontrado",
          })
          .eq("id", jobId);
        continue;
      }

      try {
        const report = await executeReportGeneration({
          admin,
          client,
          client_id,
          userId,
          mode,
          clickContext,
        });
        processed++;
        await admin
          .from("ai_jobs")
          .update({
            status: "done",
            finished_at: new Date().toISOString(),
            result_ref: (report as { id?: string }).id ?? null,
          })
          .eq("id", jobId);
      } catch (e) {
        failed++;
        const errText =
          e instanceof ReportRunnerHttpError
            ? e.message
            : String((e as Error).message ?? e);
        await admin
          .from("ai_jobs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            last_error: errText.slice(0, 500),
          })
          .eq("id", jobId);
      }
      continue;
    }

    await admin
      .from("ai_jobs")
      .update({
        status: "failed",
        last_error: `unsupported job_type: ${job.job_type}`,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    failed++;
  }

  traceLog(
    "process_ai_jobs.done",
    { processed, failed, claimed: (jobs ?? []).length },
    traceId,
  );
  edgeLogDone("process_ai_jobs.ok", t0, { processed, failed });

  return new Response(
    JSON.stringify({ ok: true, processed, failed, claimed: (jobs ?? []).length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
