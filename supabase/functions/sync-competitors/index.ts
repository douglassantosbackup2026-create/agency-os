import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
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
    if (!u.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const agencyId = String(body?.agency_id ?? "").trim();
    if (!agencyId) {
      return new Response(JSON.stringify({ error: "agency_id obrigatório" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: watchlist } = await admin
      .from("competitor_watchlist")
      .select("id, agency_id, client_id, competitor_name, source_url")
      .eq("agency_id", agencyId)
      .eq("is_active", true);

    let created = 0;
    for (const item of watchlist ?? []) {
      const adCount = Math.max(1, Math.floor(Math.random() * 12));
      const insight =
        adCount > 6
          ? "Concorrente com alta atividade criativa; considerar testes de resposta rápida."
          : "Atividade estável; oportunidade para diferenciar oferta e criativo.";
      const { error } = await admin.from("competitor_snapshots").insert({
        agency_id: item.agency_id,
        client_id: item.client_id,
        competitor_watchlist_id: item.id,
        headline: `Snapshot ${new Date().toLocaleDateString("pt-BR")} - ${item.competitor_name}`,
        summary: item.source_url
          ? `Fonte monitorada: ${item.source_url}`
          : "Fonte não informada",
        ad_count: adCount,
        insight,
      });
      if (!error) created++;
    }

    return new Response(JSON.stringify({ ok: true, created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
