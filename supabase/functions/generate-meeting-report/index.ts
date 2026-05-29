import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4?dts";
import { assertUserCanAccessClient } from "../_shared/membership.ts";
import { BodyTooLargeError, readJsonBody } from "../_shared/edge-json-body.ts";
import { edgeLogDone, edgeLog, truncateError } from "../_shared/edge-log.ts";
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";
import { aiBudgetExceeded } from "../_shared/ai-budget.ts";
import {
  checkMeetingReportRateLimits,
  executeMeetingReportGeneration,
  MeetingReportRunnerError,
} from "../_shared/meeting-report-runner.ts";

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
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
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
    const clientId = String(body?.client_id ?? "");
    const requestedMode = String(body?.mode ?? "").trim();
    if (!clientId) {
      return new Response(JSON.stringify({ error: "client_id obrigatório" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: client } = await admin
      .from("clients")
      .select("id, agency_id, name, segment")
      .eq("id", clientId)
      .maybeSingle();
    if (!client)
      return new Response(JSON.stringify({ error: "client not found" }), {
        status: 404,
        headers: corsHeaders,
      });

    const allowed = await assertUserCanAccessClient(admin, u.user.id, {
      id: client.id as string,
      agency_id: client.agency_id as string,
    });
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      Deno.env.get("MEETING_REPORT_SYNC_MODE") !== "true" &&
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
          client_id: clientId,
          job_type: "meeting_report",
          status: "pending",
          payload: {
            client_id: clientId,
            mode: requestedMode,
            pct_meta_atingida: body?.pct_meta_atingida,
            generated_by: u.user.id,
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
      traceLog(
        "generate_meeting_report.enqueued",
        { job_id: job.id, client_id: clientId },
        traceId,
      );
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

    await checkMeetingReportRateLimits(admin, clientId);

    const row = await executeMeetingReportGeneration({
      admin,
      client: client as {
        id: string;
        agency_id: string;
        name: string;
        segment?: string | null;
      },
      clientId,
      userId: u.user.id,
      requestedMode,
      pctMeta: Number(body?.pct_meta_atingida ?? 0),
    });

    edgeLogDone("generate_meeting_report.ok", t0, {
      client_id: clientId,
      agency_id: client.agency_id,
      meeting_report_id: row.id,
    });
    traceLog(
      "generate_meeting_report.done",
      { client_id: clientId, meeting_report_id: row.id },
      traceId,
    );
    return new Response(JSON.stringify({ ok: true, id: row.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof MeetingReportRunnerError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    edgeLog("generate_meeting_report.error", {
      latency_ms: Math.max(0, Date.now() - t0),
      error_trunc: truncateError((e as Error).message),
    });
    traceLog(
      "generate_meeting_report.error",
      { error: truncateError((e as Error).message) },
      traceId,
    );
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
