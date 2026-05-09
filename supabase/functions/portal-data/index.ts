// Public endpoint — returns sanitized client portal data given a portal_slug.
// No auth required; uses service role on the server side.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) {
      return new Response(JSON.stringify({ error: "slug required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: client } = await admin
      .from("clients")
      .select("id, name, segment, agency_id")
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
      { data: report },
      { data: health },
      { data: pendingCreatives },
      { data: ga4Daily },
      { data: ga4Tracking },
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
          "client_friendly_summary, executive_summary, opportunities, next_steps, created_at",
        )
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("health_scores")
        .select("score, risk, recorded_at")
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
    ]);

    return new Response(
      JSON.stringify({
        client: { name: client.name, segment: client.segment },
        agency,
        metrics: metrics ?? [],
        campaigns: campaigns ?? [],
        report,
        health,
        pending_creatives: pendingCreatives ?? [],
        ga4_daily: ga4Daily ?? [],
        ga4_tracking: ga4Tracking ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
