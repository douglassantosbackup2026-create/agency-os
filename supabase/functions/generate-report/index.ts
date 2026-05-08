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

    const { client_id } = await req.json();
    if (!client_id) return new Response(JSON.stringify({ error: "client_id required" }), { status: 400, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: client } = await admin.from("clients").select("*").eq("id", client_id).maybeSingle();
    if (!client) return new Response(JSON.stringify({ error: "Cliente não encontrado" }), { status: 404, headers: corsHeaders });

    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data: metrics } = await admin.from("metrics_daily").select("*").eq("client_id", client_id).gte("date", since).order("date");
    const m = metrics ?? [];
    const spend = m.reduce((a, b) => a + Number(b.spend ?? 0), 0);
    const revenue = m.reduce((a, b) => a + Number(b.revenue ?? 0), 0);
    const conv = m.reduce((a, b) => a + Number(b.conversions ?? 0), 0);
    const roas = spend > 0 ? revenue / spend : 0;
    const cpa = conv > 0 ? spend / conv : 0;
    const half = Math.floor(m.length / 2);
    const firstHalfRoas = m.slice(0, half).reduce((a, b) => a + Number(b.roas ?? 0), 0) / Math.max(1, half);
    const secondHalfRoas = m.slice(half).reduce((a, b) => a + Number(b.roas ?? 0), 0) / Math.max(1, m.length - half);

    const summary = `Cliente: ${client.name}\nSegmento: ${client.segment ?? "—"}\nÚltimos 30 dias:\n- Investimento: R$ ${spend.toFixed(2)}\n- Receita: R$ ${revenue.toFixed(2)}\n- ROAS médio: ${roas.toFixed(2)}x\n- CPA médio: R$ ${cpa.toFixed(2)}\n- Conversões: ${conv}\n- ROAS primeira metade: ${firstHalfRoas.toFixed(2)}x\n- ROAS segunda metade: ${secondHalfRoas.toFixed(2)}x`;

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), { status: 500, headers: corsHeaders });

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um analista sênior de tráfego pago de uma agência de performance. Analise os dados do cliente e responda em JSON estruturado, em português brasileiro, claro, humano, sem jargão técnico desnecessário." },
          { role: "user", content: `Dados:\n${summary}\n\nResponda APENAS com JSON válido neste formato:\n{\n  "executive_summary": "...",\n  "positives": "...",\n  "problems": "...",\n  "opportunities": "...",\n  "next_steps": "...",\n  "client_friendly_summary": "..."\n}` },
        ],
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI error", aiResp.status, text);
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em alguns minutos." }), { status: 429, headers: corsHeaders });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), { status: 402, headers: corsHeaders });
      throw new Error(`AI error ${aiResp.status}`);
    }

    const aiJson = await aiResp.json();
    const content: string = aiJson.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch {
      parsed = { executive_summary: cleaned };
    }

    const { data: report } = await admin.from("reports").insert({
      agency_id: client.agency_id,
      client_id,
      generated_by: userRes.user.id,
      period_start: since,
      period_end: new Date().toISOString().slice(0, 10),
      executive_summary: parsed.executive_summary ?? null,
      positives: parsed.positives ?? null,
      problems: parsed.problems ?? null,
      opportunities: parsed.opportunities ?? null,
      next_steps: parsed.next_steps ?? null,
      client_friendly_summary: parsed.client_friendly_summary ?? null,
      raw_data: { spend, revenue, roas, cpa, conv },
    }).select().maybeSingle();

    await admin.from("activities").insert({
      agency_id: client.agency_id,
      client_id,
      user_id: userRes.user.id,
      type: "report_generated",
      title: `Relatório IA gerado para ${client.name}`,
    });

    return new Response(JSON.stringify({ ok: true, report }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
