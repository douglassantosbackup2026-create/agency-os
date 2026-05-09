import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug ?? "").trim();
    const creativeId = String(body?.creative_id ?? "").trim();
    const decision = String(body?.decision ?? "").trim();
    const feedback = body?.feedback ? String(body.feedback) : null;
    const reviewerName = body?.reviewer_name
      ? String(body.reviewer_name)
      : "Cliente";

    if (!slug || !creativeId || !["approved", "rejected"].includes(decision)) {
      return new Response(JSON.stringify({ error: "payload inválido" }), {
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
      .select("id, agency_id")
      .eq("portal_slug", slug)
      .maybeSingle();
    if (!client) {
      return new Response(JSON.stringify({ error: "portal não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: creative } = await admin
      .from("creative_assets")
      .select("id, agency_id, client_id, status")
      .eq("id", creativeId)
      .maybeSingle();
    if (!creative || creative.client_id !== client.id) {
      return new Response(JSON.stringify({ error: "criativo inválido" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upErr } = await admin
      .from("creative_assets")
      .update({
        status: decision,
        updated_at: new Date().toISOString(),
      })
      .eq("id", creative.id);
    if (upErr) throw upErr;

    const { error: revErr } = await admin.from("creative_reviews").insert({
      agency_id: client.agency_id,
      creative_asset_id: creative.id,
      decision,
      feedback,
      reviewer_name: reviewerName,
      source: "portal",
    });
    if (revErr) throw revErr;

    return new Response(JSON.stringify({ ok: true, decision }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
