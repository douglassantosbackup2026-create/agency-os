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

    const { client_id, recipient, message, template } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin.from("profiles").select("agency_id").eq("id", u.user.id).maybeSingle();
    if (!profile?.agency_id) return new Response(JSON.stringify({ error: "no agency" }), { status: 400, headers: corsHeaders });

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    let status: "sent" | "failed" | "queued" = "queued";
    let error: string | null = null;

    if (evolutionUrl && evolutionKey) {
      try {
        const resp = await fetch(`${evolutionUrl}/message/sendText`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": evolutionKey },
          body: JSON.stringify({ number: recipient, text: message }),
        });
        if (!resp.ok) { status = "failed"; error = `HTTP ${resp.status}`; }
        else status = "sent";
      } catch (e) { status = "failed"; error = (e as Error).message; }
    } else {
      // Mock mode
      status = "sent";
    }

    const { data: log } = await admin.from("whatsapp_logs").insert({
      agency_id: profile.agency_id,
      client_id: client_id ?? null,
      recipient, message, template: template ?? null,
      status, error, sent_at: status === "sent" ? new Date().toISOString() : null,
    }).select().maybeSingle();

    return new Response(JSON.stringify({ ok: status === "sent", log }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
