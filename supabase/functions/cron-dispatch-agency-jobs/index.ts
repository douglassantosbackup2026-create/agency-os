/**
 * Dispara evaluate-alerts e compute-health-scores por agência (evita timeout global).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { isCronAuthenticated } from "../_shared/cron-agency-scope.ts";
import { edgeLog, edgeLogDone } from "../_shared/edge-log.ts";

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
  if (!isCronAuthenticated(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const t0 = Date.now();
  const cronSecret = Deno.env.get("CRON_SECRET")!;
  const baseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  const admin = createClient(
    baseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

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

  let agencyQuery = admin.from("agencies").select("id");
  if (typeof body.agency_id === "string" && body.agency_id.trim()) {
    agencyQuery = agencyQuery.eq("id", body.agency_id.trim());
  }
  const { data: agencies, error } = await agencyQuery;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ids = (agencies ?? []).map((a) => String(a.id)).filter(Boolean);
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

  edgeLogDone("cron_dispatch.done", t0, {
    agencies: ids.length,
    jobs,
    dispatched,
    failed,
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
