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
    const slugRaw = url.searchParams.get("slug");
    const slug = slugRaw ? slugRaw.trim().slice(0, 160) : "";
    const slugMin = Math.max(
      1,
      Math.min(64, Number(Deno.env.get("PORTAL_SLUG_MIN_LENGTH") ?? "4") || 4),
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
          "client_friendly_summary, executive_summary, opportunities, next_steps, positives, problems, created_at, period_start, period_end",
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

    const reports_recent = reportsRecent ?? [];
    const report = reports_recent[0] ?? null;

    let health_portal: {
      score: number | null;
      risk: string | null;
      recorded_at: string | null;
      suggested_next_step: string | null;
      penalties_preview: string[];
    } | null = null;
    if (health) {
      const base = {
        score: health.score ?? null,
        risk: health.risk ?? null,
        recorded_at: health.recorded_at ?? null,
        suggested_next_step: null as string | null,
        penalties_preview: [] as string[],
      };
      const expl = health.score_explanation;
      if (expl && typeof expl === "object") {
        const e = expl as Record<string, unknown>;
        if (typeof e.suggested_next_step === "string") {
          base.suggested_next_step = e.suggested_next_step;
        }
        const penalties = Array.isArray(e.penalties) ? e.penalties : [];
        base.penalties_preview = penalties
          .slice(0, 4)
          .map((p: unknown) => {
            const o = p as { reason?: string };
            return typeof o?.reason === "string" ? o.reason : null;
          })
          .filter((x): x is string => Boolean(x));
      }
      health_portal = base;
    }

    return new Response(
      JSON.stringify({
        client: { name: client.name, segment: client.segment },
        agency,
        metrics: metrics ?? [],
        campaigns: campaigns ?? [],
        report,
        reports_recent,
        health: health_portal,
        pending_creatives: pendingCreatives ?? [],
        ga4_daily: ga4Daily ?? [],
        ga4_tracking: ga4Tracking ?? null,
        actions: actions ?? [],
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
