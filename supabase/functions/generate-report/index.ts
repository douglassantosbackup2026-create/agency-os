import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { normalizeClickContext } from "../_shared/ai-v3.ts";
import { BodyTooLargeError, readJsonBody } from "../_shared/edge-json-body.ts";
import { edgeLogDone, truncateError, edgeLog } from "../_shared/edge-log.ts";
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";
import { assertUserCanAccessClient } from "../_shared/membership.ts";
import { isCronAuthenticated } from "../_shared/cron-agency-scope.ts";
import { aiBudgetExceeded } from "../_shared/ai-budget.ts";
import {
  executeReportGeneration,
  ReportRunnerHttpError,
  type ReportMode,
} from "../_shared/report-runner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  const traceId = traceIdFromRequest(req);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const authHeader = req.headers.get("Authorization");
    const jobIdHeader = req.headers.get("x-ai-job-id")?.trim() ?? "";
    const isJobRunner =
      !!jobIdHeader && (await isCronAuthenticated(req, admin));

    if (!authHeader && !isJobRunner)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return new Response(
          JSON.stringify({ error: "payload demasiado grande" }),
          {
            status: 413,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      body = {};
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    let userId: string;
    if (isJobRunner) {
      const { data: jobRow } = await admin
        .from("ai_jobs")
        .select("id, status, payload, agency_id, client_id")
        .eq("id", jobIdHeader)
        .maybeSingle();
      if (!jobRow || jobRow.status !== "processing") {
        return new Response(JSON.stringify({ error: "Job inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const pl = (jobRow.payload ?? {}) as Record<string, unknown>;
      body = { ...pl, ...body };
      userId = String(pl.generated_by ?? "");
      if (!userId) {
        return new Response(JSON.stringify({ error: "Job sem generated_by" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
          Deno.env.get("SUPABASE_ANON_KEY")!,
        {
          global: { headers: { Authorization: authHeader! } },
        },
      );
      const { data: userRes } = await userClient.auth.getUser();
      if (!userRes.user)
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      userId = userRes.user.id;
    }

    const client_id = String(body.client_id ?? "").trim();
    const mode = String(body?.mode ?? "monthly_manager") as
      | "monthly_manager"
      | "monthly_client"
      | "on_demand";
    const clickContext = normalizeClickContext(body?.click_context);
    if (!clickContext) {
      return new Response(
        JSON.stringify({ error: "click_context inválido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!client_id)
      return new Response(JSON.stringify({ error: "client_id required" }), {
        status: 400,
        headers: corsHeaders,
      });

    const { data: client } = await admin
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .maybeSingle();
    if (!client)
      return new Response(JSON.stringify({ error: "Cliente não encontrado" }), {
        status: 404,
        headers: corsHeaders,
      });

    if (!isJobRunner) {
      const allowed = await assertUserCanAccessClient(admin, userId, {
        id: client.id as string,
        agency_id: client.agency_id as string,
      });
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: "Sem permissão para este cliente" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    if (
      !isJobRunner &&
      Deno.env.get("REPORT_SYNC_MODE") !== "true" &&
      !body._async_job
    ) {
      if (await aiBudgetExceeded(admin, client.agency_id as string, 12000)) {
        return new Response(
          JSON.stringify({
            error:
              "Orçamento diário de IA da agência atingido. Tente amanhã ou faça upgrade do plano.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const { data: job, error: jobErr } = await admin
        .from("ai_jobs")
        .insert({
          agency_id: client.agency_id,
          client_id,
          job_type: "report",
          status: "pending",
          payload: {
            client_id,
            mode,
            click_context: clickContext,
            generated_by: userId,
          },
          attempts: 0,
        })
        .select("id, status")
        .single();
      if (jobErr) {
        return new Response(JSON.stringify({ error: jobErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          job_id: job.id,
          status: job.status,
          async: true,
        }),
        {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const reportCooldownMin = Number(
      Deno.env.get("GENERATE_REPORT_COOLDOWN_MINUTES") ?? "20",
    );
    const reportMaxPerDay = Number(
      Deno.env.get("GENERATE_REPORT_MAX_PER_DAY_PER_CLIENT") ?? "12",
    );

    if (Number.isFinite(reportCooldownMin) && reportCooldownMin > 0) {
      const { data: lastRep } = await admin
        .from("reports")
        .select("created_at")
        .eq("client_id", client_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastRep?.created_at) {
        const elapsedMin =
          (Date.now() - new Date(String(lastRep.created_at)).getTime()) /
          60_000;
        if (elapsedMin < reportCooldownMin) {
          const wait = Math.ceil(reportCooldownMin - elapsedMin);
          console.warn(
            JSON.stringify({
              evt: "generate_report.rate_limited_cooldown",
              client_id,
              agency_id: client.agency_id,
              wait_minutes: wait,
            }),
          );
          return new Response(
            JSON.stringify({
              error: `Relatório em cooldown. Tente novamente em ~${wait} min.`,
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    if (Number.isFinite(reportMaxPerDay) && reportMaxPerDay > 0) {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const { count, error: cErr } = await admin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client_id)
        .gte("created_at", dayStart.toISOString());
      if (!cErr && (count ?? 0) >= reportMaxPerDay) {
        console.warn(
          JSON.stringify({
            evt: "generate_report.rate_limited_daily",
            client_id,
            agency_id: client.agency_id,
            count: count ?? 0,
            limit: reportMaxPerDay,
          }),
        );
        return new Response(
          JSON.stringify({
            error:
              "Limite diário de relatórios gerados para este cliente foi atingido.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    try {
      const report = await executeReportGeneration({
        admin,
        client,
        client_id,
        userId,
        mode: mode as ReportMode,
        clickContext,
      });
      edgeLogDone("generate_report.ok", t0, {
        client_id,
        agency_id: client.agency_id,
        mode,
        trace_id: traceId,
      });
      traceLog("generate_report.ok", { client_id, mode }, traceId);
      return new Response(JSON.stringify({ ok: true, report }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      if (e instanceof ReportRunnerHttpError) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: e.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }
  } catch (e) {
    console.error(e);
    edgeLog("generate_report.error", {
      latency_ms: Math.max(0, Date.now() - t0),
      error_trunc: truncateError((e as Error).message),
    });
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
