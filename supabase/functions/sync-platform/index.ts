// Generic sync stub — accepts a provider and simulates fetching metrics.
// In production, replace `simulateMetrics` with real OAuth calls per provider.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { provider, client_id } = await req.json();
    if (!provider || !client_id) return new Response(JSON.stringify({ error: "provider and client_id required" }), { status: 400, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: client } = await admin.from("clients").select("agency_id, monthly_budget").eq("id", client_id).maybeSingle();
    if (!client) return new Response(JSON.stringify({ error: "client not found" }), { status: 404, headers: corsHeaders });

    const { data: integ } = await admin.from("integrations").select("*").eq("agency_id", client.agency_id).eq("provider", provider).maybeSingle();
    if (!integ || integ.status !== "connected") {
      return new Response(JSON.stringify({ error: `Integração ${provider} não conectada` }), { status: 400, headers: corsHeaders });
    }

    // Simulated fetch — last 7 days of metrics for the client
    const today = new Date();
    const dailyBudget = Number(client.monthly_budget ?? 0) / 30;
    const rows = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);
      const spend = +(dailyBudget * (0.8 + Math.random() * 0.4)).toFixed(2);
      const roas = +(2 + Math.random() * 2.5).toFixed(2);
      const revenue = +(spend * roas).toFixed(2);
      const conv = Math.max(1, Math.round(spend / 30));
      rows.push({
        agency_id: client.agency_id, client_id, date,
        spend, revenue, conversions: conv,
        impressions: Math.round(spend * 250), clicks: Math.round(spend * 8),
        roas, cpa: +(spend / conv).toFixed(2),
        ctr: +(2 + Math.random() * 2).toFixed(2),
      });
    }
    await admin.from("metrics_daily").upsert(rows, { onConflict: "client_id,date" }).select();
    await admin.from("integrations").update({ last_sync_at: new Date().toISOString() }).eq("id", integ.id);
    await admin.from("activities").insert({
      agency_id: client.agency_id, client_id, user_id: u.user.id,
      type: "sync", title: `Sincronização ${provider} concluída`,
    });

    return new Response(JSON.stringify({ ok: true, rows: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
