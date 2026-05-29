/**
 * Dispara evaluate-alerts e compute-health-scores por agência (evita timeout global).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  isCronAuthenticated,
  resolveCronBearerForDispatch,
} from "../_shared/cron-agency-scope.ts";
import { edgeLog, edgeLogDone } from "../_shared/edge-log.ts";
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type JobName = "evaluate-alerts" | "compute-health-scores" | "process-ai-jobs";

async function invokeAgencyJob(
  baseUrl: string,
  cronSecret: string,
  job: JobName,
  agencyId: string,
): Promise<{ ok: boolean; status: number }> {
  const url = `${baseUrl}/functions/v1/${job}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cronSecret}`,
    },
    body: JSON.stringify({ agency_id: agencyId }),
  });
  return { ok: r.ok, status: r.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const baseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  const admin = createClient(
    baseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (!(await isCronAuthenticated(req, admin))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const traceId = traceIdFromRequest(req);
  const t0 = Date.now();
  const cronSecret = await resolveCronBearerForDispatch(admin);
  if (!cronSecret) {
    return new Response(
      JSON.stringify({ error: "Cron bearer não configurado" }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const jobsParam = typeof body.jobs === "string"
    ? body.jobs
    : "evaluate-alerts,compute-health-scores";
  const jobs = jobsParam.split(",").map((j) => j.trim()).filter(Boolean) as JobName[];

  const batchSize = Math.max(
    1,
    Math.min(20, Number(Deno.env.get("CRON_AGENCY_BATCH_SIZE") ?? "5") || 5),
  );
  const agencyLimit = Math.max(
    1,
    Math.min(
      200,
      Number(Deno.env.get("CRON_DISPATCH_AGENCIES_LIMIT") ?? "50") || 50,
    ),
  );

  let ids: string[] = [];
  const singleAgency = typeof body.agency_id === "string" &&
    body.agency_id.trim();
  if (singleAgency) {
    ids = [body.agency_id.trim()];
  } else {
    const jobKey = jobs.join("+") || "default";
    const { data: batch, error: batchErr } = await admin.rpc(
      "get_cron_dispatch_agency_batch",
      { p_job_key: jobKey, p_limit: agencyLimit },
    );
    if (batchErr) {
      return new Response(JSON.stringify({ error: batchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = (batch ?? {}) as { agency_ids?: unknown[] };
    ids = (parsed.agency_ids ?? []).map((id) => String(id)).filter(Boolean);
  }

  let dispatched = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (agencyId) => {
        for (const job of jobs) {
          if (
            job !== "evaluate-alerts" &&
            job !== "compute-health-scores" &&
            job !== "process-ai-jobs"
          ) {
            continue;
          }
          const res = await invokeAgencyJob(
            baseUrl,
            cronSecret,
            job,
            agencyId,
          );
          if (res.ok) dispatched++;
          else {
            failed++;
            edgeLog("cron_dispatch.failed", {
              agency_id: agencyId,
              job,
              status: res.status,
            });
          }
        }
      }),
    );
  }

  traceLog(
    "cron_dispatch.done",
    { agencies: ids.length, jobs, dispatched, failed },
    traceId,
  );
  edgeLogDone("cron_dispatch.done", t0, {
    agencies: ids.length,
    jobs,
    dispatched,
    failed,
    trace_id: traceId,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      agencies: ids.length,
      jobs,
      dispatched,
      failed,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
