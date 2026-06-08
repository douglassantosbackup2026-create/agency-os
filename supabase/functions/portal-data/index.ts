// Public endpoint — returns sanitized client portal data given a portal_slug.
// No auth required; uses service role on the server side.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { portalClientIp, portalGlobalIpRateLimitExceeded, portalRateLimitExceeded } from "../_shared/portal-rate-limit.ts";
import {
  buildPortalGa4Tracking,
  buildPortalHealth,
  buildPortalReportHistory,
  buildPortalReportSafe,
} from "../_shared/portal-payload.ts";
import {
  portalReviewSecret,
  signPortalReviewToken,
} from "../_shared/portal-review-token.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";

function corsFor(req: Request): Record<string, string> {
  const allowList = Deno.env
    .get("PORTAL_ALLOWED_ORIGINS")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.get("origin");
  const allow =
    allowList?.length && origin && allowList.includes(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  const trace = beginEdgeTrace(req, "portal_data");
  try {
    const url = new URL(req.url);
    const slugRaw = url.searchParams.get("slug");
    const slug = slugRaw ? slugRaw.trim().slice(0, 160) : "";
    const slugMin = Math.max(
      1,
      Math.min(64, Number(Deno.env.get("PORTAL_SLUG_MIN_LENGTH") ?? "8") || 8),
    );
    if (!slug) {
      return new Response(JSON.stringify({ error: "slug required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (slug.length < slugMin || !/^[a-z0-9_-]+$/i.test(slug)) {
      return new Response(JSON.stringify({ error: "invalid slug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = portalClientIp(req);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (await portalGlobalIpRateLimitExceeded(admin, ip)) {
      return new Response(JSON.stringify({ error: "too_many_requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (
      await portalRateLimitExceeded(
        admin,
        `portal:${ip}:${slug}`,
      )
    ) {
      return new Response(JSON.stringify({ error: "too_many_requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: client } = await admin
      .from("clients")
      .select("id, name, segment, agency_id, portal_slug")
      .eq("portal_slug", slug)
      .maybeSingle();
    if (!client) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: agency } = await admin
      .from("agencies")
      .select("name, logo_url, primary_color")
      .eq("id", client.agency_id)
      .maybeSingle();
    const since = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    const [
      { data: metrics },
      { data: campaigns },
      { data: reportsRecent },
      { data: health },
      { data: pendingCreatives },
      { data: ga4Daily },
      { data: ga4Tracking },
      { data: actions },
    ] = await Promise.all([
      admin
        .from("metrics_daily")
        .select("date, spend, revenue, conversions, roas, cpa")
        .eq("client_id", client.id)
        .is("campaign_id", null)
        .gte("date", since)
        .order("date"),
      admin
        .from("campaigns")
        .select("name, platform, status, daily_budget, objective")
        .eq("client_id", client.id)
        .limit(20),
      admin
        .from("reports")
        .select(
          "client_friendly_summary, executive_summary, created_at, period_start, period_end",
        )
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("health_scores")
        .select("score, risk, recorded_at, score_explanation")
        .eq("client_id", client.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("creative_assets")
        .select("id, title, description, preview_url, status, created_at")
        .eq("client_id", client.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("ga4_daily")
        .select(
          "date, sessions, conversions, revenue, conversion_rate, avg_ticket",
        )
        .eq("client_id", client.id)
        .gte("date", since)
        .order("date"),
      admin
        .from("ga4_tracking_health_daily")
        .select("status, notes, date")
        .eq("client_id", client.id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("action_center")
        .select("title, description, status, priority, due_date")
        .eq("client_id", client.id)
        .in("status", ["pendente", "enviado_cliente", "revisar_depois"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const reportsRaw = (reportsRecent ?? []) as Array<Record<string, unknown>>;
    const report = buildPortalReportSafe(reportsRaw[0]);
    const reports_history = buildPortalReportHistory(reportsRaw);

    let review_token: string | null = null;
    const reviewSecret = portalReviewSecret();
    if (reviewSecret && client.portal_slug) {
      const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
      review_token = await signPortalReviewToken(
        client.id as string,
        client.portal_slug as string,
        exp,
        reviewSecret,
      );
    }

    return new Response(
      JSON.stringify({
        client: { name: client.name, segment: client.segment },
        agency,
        metrics: metrics ?? [],
        campaigns: campaigns ?? [],
        report,
        reports_history,
        health: buildPortalHealth(health as Record<string, unknown> | null),
        pending_creatives: pendingCreatives ?? [],
        ga4_daily: ga4Daily ?? [],
        ga4_tracking: buildPortalGa4Tracking(
          ga4Tracking as Record<string, unknown> | null,
        ),
        actions: actions ?? [],
        review_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
    trace.done({ slug });
  } catch (e) {
    trace.fail(e);
    console.error("[portal-data]", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
