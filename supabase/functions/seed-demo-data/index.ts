import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SEGMENTS = [
  "E-commerce",
  "SaaS",
  "Educação",
  "Infoproduto",
  "Local",
  "Imobiliário",
  "Saúde",
  "Serviços",
];
const NAMES = [
  "Boutique Azul",
  "TechFlow",
  "EduMax",
  "FitLife Pro",
  "Casa Nova Imóveis",
  "Clínica Vita",
  "Studio Mídia",
  "Maré Cosméticos",
];
const PLATFORMS = ["Meta Ads", "Google Ads", "TikTok Ads"];
const ALERT_TYPES = [
  {
    type: "roas_drop",
    title: "ROAS caiu nas últimas 48h",
    priority: "high",
    action: "Revisar campanhas com queda > 25%",
  },
  {
    type: "cpa_up",
    title: "CPA subiu acima do alvo",
    priority: "medium",
    action: "Pausar adsets ineficientes",
  },
  {
    type: "creative_fatigue",
    title: "Criativo fadigado",
    priority: "medium",
    action: "Subir 3 novas variações",
  },
  {
    type: "campaign_paused",
    title: "Campanha parou de entregar",
    priority: "critical",
    action: "Verificar saldo e status do pixel",
  },
  {
    type: "pacing",
    title: "Pacing fora do orçamento",
    priority: "low",
    action: "Ajustar budget diário",
  },
];
const ACTIVITIES = [
  { type: "campaign_change", title: "Budget aumentado em 20%" },
  { type: "creative_added", title: "3 criativos novos publicados" },
  { type: "report_sent", title: "Relatório semanal enviado" },
  { type: "client_call", title: "Call de alinhamento realizada" },
  { type: "optimization", title: "Otimização de público aplicada" },
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
        Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      },
    );
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes.user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("agency_id")
      .eq("id", userRes.user.id)
      .maybeSingle();
    const agencyId = profile?.agency_id;
    if (!agencyId)
      return new Response(JSON.stringify({ error: "Sem agência" }), {
        status: 400,
        headers: corsHeaders,
      });

    // skip if already has clients
    const { count } = await admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId);
    if ((count ?? 0) > 0)
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // create clients
    const clientRows = NAMES.map((name, i) => ({
      agency_id: agencyId,
      name,
      segment: SEGMENTS[i],
      status: i === 7 ? "paused" : "active",
      monthly_budget: randInt(8000, 60000),
      mrr: randInt(2500, 12000),
      portal_slug:
        name.toLowerCase().replace(/[^a-z0-9]+/g, "-") +
        "-" +
        Math.random().toString(36).slice(2, 6),
      tags: [SEGMENTS[i].toLowerCase()],
    }));
    const { data: clients } = await admin
      .from("clients")
      .insert(clientRows)
      .select();
    if (!clients) throw new Error("Falha ao criar clientes");

    // campaigns first (need ids for per-campaign metrics_daily rows)
    const campaignRows: any[] = [];
    for (const c of clients) {
      campaignRows.push(
        {
          agency_id: agencyId,
          client_id: c.id,
          name: "Conversão - Frio",
          platform: rand(PLATFORMS),
          status: "active",
          daily_budget: randInt(200, 1500),
          objective: "Conversão",
        },
        {
          agency_id: agencyId,
          client_id: c.id,
          name: "Remarketing",
          platform: rand(PLATFORMS),
          status: "active",
          daily_budget: randInt(150, 800),
          objective: "Conversão",
        },
      );
    }
    const { data: insertedCampaigns, error: campInsErr } = await admin
      .from("campaigns")
      .insert(campaignRows)
      .select("id");
    if (campInsErr) throw campInsErr;

    // metrics + health + alerts + activities
    const today = new Date();
    const metricsRows: any[] = [];
    const healthRows: any[] = [];
    const alertRows: any[] = [];
    const activityRows: any[] = [];

    for (let ci = 0; ci < clients.length; ci++) {
      const c = clients[ci];
      const cidA = insertedCampaigns![ci * 2].id;
      const cidB = insertedCampaigns![ci * 2 + 1].id;

      // 30 days metrics (split across two campaigns for realistic drill-down)
      const trend = Math.random() > 0.5 ? 1 : -1;
      for (let d = 0; d < 30; d++) {
        const date = new Date(today.getTime() - d * 86400000)
          .toISOString()
          .slice(0, 10);
        const spend = randInt(300, 2000) + d * trend * 5;
        const conv = randInt(5, 60);
        const revenue = spend * (1.5 + Math.random() * 2.5);
        const clicks = randInt(200, 2500);
        const impr = clicks * randInt(20, 60);
        const campaign_id = d % 2 === 0 ? cidA : cidB;
        metricsRows.push({
          agency_id: agencyId,
          client_id: c.id,
          campaign_id,
          date,
          spend: Math.max(50, spend),
          revenue,
          impressions: impr,
          clicks,
          conversions: conv,
          roas: revenue / Math.max(50, spend),
          cpa: spend / conv,
          ctr: (clicks / impr) * 100,
        });
      }

      // health snapshots (last 7 days)
      const baseScore = randInt(35, 95);
      for (let d = 0; d < 7; d++) {
        const score = Math.max(
          10,
          Math.min(100, baseScore + randInt(-8, 8) - d * 1),
        );
        const risk = score >= 75 ? "low" : score >= 50 ? "medium" : "high";
        healthRows.push({
          agency_id: agencyId,
          client_id: c.id,
          score,
          risk,
          performance_score: randInt(40, 100),
          optimization_score: randInt(40, 100),
          communication_score: randInt(40, 100),
          stability_score: randInt(40, 100),
          engagement_score: randInt(40, 100),
          recorded_at: new Date(today.getTime() - d * 86400000).toISOString(),
        });
      }

      // 1-3 alerts per client
      const nAlerts = randInt(1, 3);
      for (let i = 0; i < nAlerts; i++) {
        const a = rand(ALERT_TYPES);
        alertRows.push({
          agency_id: agencyId,
          client_id: c.id,
          type: a.type,
          title: a.title,
          description: `Detectado em ${c.name}`,
          priority: a.priority,
          status: "open",
          recommended_action: a.action,
          created_at: new Date(
            today.getTime() - randInt(0, 5) * 86400000,
          ).toISOString(),
        });
      }

      // 2 activities
      for (let i = 0; i < 2; i++) {
        const ev = rand(ACTIVITIES);
        activityRows.push({
          agency_id: agencyId,
          client_id: c.id,
          type: ev.type,
          title: `${ev.title} — ${c.name}`,
          description: null,
          created_at: new Date(
            today.getTime() - randInt(0, 7) * 86400000,
          ).toISOString(),
        });
      }
    }

    await admin.from("metrics_daily").insert(metricsRows);
    await admin.from("health_scores").insert(healthRows);
    await admin.from("alerts").insert(alertRows);
    await admin.from("activities").insert(activityRows);

    return new Response(JSON.stringify({ ok: true, clients: clients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
