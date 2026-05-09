import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { assertUserCanAccessClient } from "../_shared/membership.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function buildMergeVariables(
  admin: ReturnType<typeof createClient>,
  agencyId: string,
  clientId: string | null | undefined,
): Promise<Record<string, string>> {
  const vars: Record<string, string> = {
    cliente: "Cliente",
    roas: "—",
    spend: "0",
    conv: "0",
    revenue: "0",
  };
  if (!clientId) return vars;
  const { data: cl } = await admin
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();
  if (cl?.name) vars.cliente = String(cl.name);

  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data: rows } = await admin
    .from("metrics_daily")
    .select("spend, revenue, conversions, roas")
    .eq("agency_id", agencyId)
    .eq("client_id", clientId)
    .is("campaign_id", null)
    .gte("date", since);
  let spend = 0,
    revenue = 0,
    conv = 0;
  for (const r of rows ?? []) {
    spend += Number(r.spend ?? 0);
    revenue += Number(r.revenue ?? 0);
    conv += Number(r.conversions ?? 0);
  }
  const roas = spend > 0 ? revenue / spend : 0;
  vars.spend = spend.toFixed(0);
  vars.revenue = revenue.toFixed(0);
  vars.conv = String(Math.round(conv));
  vars.roas = roas.toFixed(2);
  return vars;
}

function applyTemplate(
  body: string,
  vars: Record<string, string>,
): { text: string; usedKeys: string[] } {
  let out = body;
  const usedKeys: string[] = [];
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi");
    const before = out;
    out = out.replace(re, v);
    if (before !== out) usedKeys.push(k);
  }
  return { text: out, usedKeys };
}

async function sendEvolution(
  recipient: string,
  text: string,
): Promise<{ status: "sent" | "failed"; error: string | null }> {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  if (!evolutionUrl || !evolutionKey) {
    return { status: "sent", error: null };
  }
  try {
    const resp = await fetch(`${evolutionUrl}/message/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ number: recipient, text }),
    });
    if (!resp.ok) return { status: "failed", error: `HTTP ${resp.status}` };
    return { status: "sent", error: null };
  } catch (e) {
    return { status: "failed", error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const body = await req.json();
    const {
      client_id,
      recipient,
      message,
      template,
      requires_human_review,
      approved_by_human,
      draft,
      resend_from_log_id,
      skip_merge,
    } = body as Record<string, unknown>;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u.user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("agency_id")
      .eq("id", u.user.id)
      .maybeSingle();
    if (!profile?.agency_id)
      return new Response(JSON.stringify({ error: "no agency" }), {
        status: 400,
        headers: corsHeaders,
      });

    const agency_id = profile.agency_id as string;

    if (typeof resend_from_log_id === "string" && resend_from_log_id) {
      const { data: existing } = await admin
        .from("whatsapp_logs")
        .select("*")
        .eq("id", resend_from_log_id)
        .eq("agency_id", agency_id)
        .maybeSingle();
      if (!existing)
        return new Response(JSON.stringify({ error: "log not found" }), {
          status: 404,
          headers: corsHeaders,
        });
      const text = String(existing.message ?? "");
      const recip = String(existing.recipient ?? "");
      const ev = await sendEvolution(recip, text);
      await admin
        .from("whatsapp_logs")
        .update({
          pending_review: false,
          status: ev.status,
          error: ev.error,
          sent_at: ev.status === "sent" ? new Date().toISOString() : null,
        })
        .eq("id", resend_from_log_id);
      return new Response(
        JSON.stringify({ ok: ev.status === "sent", resent: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!recipient || message === undefined || message === null)
      return new Response(
        JSON.stringify({ error: "recipient and message required" }),
        { status: 400, headers: corsHeaders },
      );

    const cid = typeof client_id === "string" && client_id ? client_id : null;
    if (cid) {
      const { data: clRow } = await admin
        .from("clients")
        .select("id, agency_id")
        .eq("id", cid)
        .maybeSingle();
      if (!clRow) {
        return new Response(
          JSON.stringify({ error: "Cliente não encontrado" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (String(clRow.agency_id) !== agency_id) {
        return new Response(
          JSON.stringify({ error: "Cliente não pertence à sua agência" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const waAllowed = await assertUserCanAccessClient(admin, u.user.id, {
        id: cid,
        agency_id: String(clRow.agency_id),
      });
      if (!waAllowed) {
        return new Response(
          JSON.stringify({ error: "Sem permissão para este cliente" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    let mergeVars: Record<string, string> = {};
    let merged = String(message);
    if (!skip_merge) {
      mergeVars = await buildMergeVariables(admin, agency_id, cid);
      const applied = applyTemplate(String(message), mergeVars);
      merged = applied.text;
    }

    if (draft === true) {
      const { data: log } = await admin
        .from("whatsapp_logs")
        .insert({
          agency_id,
          client_id: cid,
          recipient: String(recipient),
          template: typeof template === "string" ? template : null,
          message: merged.slice(0, 3900),
          status: "queued",
          error: null,
          pending_review: true,
          merge_variables: mergeVars,
        })
        .select()
        .maybeSingle();
      return new Response(JSON.stringify({ ok: true, draft: true, log }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (requires_human_review && !approved_by_human) {
      return new Response(
        JSON.stringify({
          error:
            "Envio bloqueado: conteúdo exige revisão humana e ainda não foi aprovado.",
        }),
        { status: 400, headers: corsHeaders },
      );
    }

    const ev = await sendEvolution(String(recipient), merged.slice(0, 3900));
    const status = ev.status === "sent" ? "sent" : "failed";

    const { data: log } = await admin
      .from("whatsapp_logs")
      .insert({
        agency_id,
        client_id: cid,
        recipient: String(recipient),
        template: typeof template === "string" ? template : null,
        message: merged.slice(0, 3900),
        status,
        error: ev.error,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        pending_review: false,
        merge_variables: mergeVars,
      })
      .select()
      .maybeSingle();

    return new Response(JSON.stringify({ ok: status === "sent", log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
