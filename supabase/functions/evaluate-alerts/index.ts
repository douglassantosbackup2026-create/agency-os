// Cron-friendly: evaluates rules and inserts new alerts (deduped by type+client open).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { assertCronOrUser } from "../_shared/cron-auth.ts";
import { baseGovernance } from "../_shared/ai-v3.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type M = {
  date: string;
  spend: number | null;
  revenue: number | null;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
  conversions: number | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  const denied = await assertCronOrUser(req);
  if (denied) return denied;
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let agencyFilter: string | undefined;
    if (req.method === "POST") {
      try {
        const b = await req.json();
        if (b?.agency_id) agencyFilter = b.agency_id;
      } catch {
        /* empty */
      }
    }

    let cq = admin
      .from("clients")
      .select("id, agency_id, name, monthly_budget");
    if (agencyFilter) cq = cq.eq("agency_id", agencyFilter);
    const { data: clients, error: cErr } = await cq;
    if (cErr) throw cErr;

    const since = new Date(Date.now() - 28 * 86400000)
      .toISOString()
      .slice(0, 10);
    let created = 0;

    for (const c of clients ?? []) {
      const [
        { data: metrics },
        { data: openAlerts },
        { data: lastNote },
        { data: ga4Daily },
        { data: ga4Funnel },
        { data: trackingHealth },
      ] = await Promise.all([
        admin
          .from("metrics_daily")
          .select("date,spend,revenue,roas,cpa,ctr,conversions")
          .eq("client_id", c.id)
          .is("campaign_id", null)
          .gte("date", since)
          .order("date"),
        admin
          .from("alerts")
          .select("type")
          .eq("client_id", c.id)
          .eq("status", "open"),
        admin
          .from("notes")
          .select("created_at")
          .eq("client_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("ga4_daily")
          .select("date, sessions, conversions, revenue")
          .eq("client_id", c.id)
          .gte("date", since)
          .order("date"),
        admin
          .from("ga4_funnel_daily")
          .select("date, add_to_cart, begin_checkout, purchase")
          .eq("client_id", c.id)
          .gte("date", since)
          .order("date"),
        admin
          .from("ga4_tracking_health_daily")
          .select("status, notes")
          .eq("client_id", c.id)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const m = (metrics ?? []) as M[];
      if (m.length < 7) continue;
      const openTypes = new Set((openAlerts ?? []).map((a) => a.type));

      const half = Math.floor(m.length / 2);
      const avg = (arr: M[], k: keyof M) =>
        arr.length
          ? arr.reduce((a, b) => a + Number(b[k] ?? 0), 0) / arr.length
          : 0;
      const sum = (arr: M[], k: keyof M) =>
        arr.reduce((a, b) => a + Number(b[k] ?? 0), 0);
      const recent = m.slice(half);
      const prior = m.slice(0, half);
      const recRoas = avg(recent, "roas");
      const priRoas = avg(prior, "roas");
      const recCpa = avg(recent, "cpa");
      const priCpa = avg(prior, "cpa");
      const recCtr = avg(recent, "ctr");
      const priCtr = avg(prior, "ctr");
      const totalSpend = sum(m, "spend");
      const last3 = m.slice(-3);
      const last3Spend = sum(last3, "spend");
      const noActivity = !last3.length || last3Spend === 0;
      const g = ga4Daily ?? [];
      const gm = Math.floor(g.length / 2);
      const gPrior = g.slice(0, gm);
      const gRecent = g.slice(gm);
      const avgN = (arr: any[], k: string) =>
        arr.length
          ? arr.reduce((a, b) => a + Number(b[k] ?? 0), 0) / arr.length
          : 0;
      const convPrior = avgN(gPrior, "conversions");
      const convRecent = avgN(gRecent, "conversions");
      const revPrior = avgN(gPrior, "revenue");
      const revRecent = avgN(gRecent, "revenue");
      const sessPrior = avgN(gPrior, "sessions");
      const sessRecent = avgN(gRecent, "sessions");

      const queue: {
        type: string;
        title: string;
        description: string;
        priority: "low" | "medium" | "high" | "critical";
        recommended_action: string;
        confidence: "alta" | "media" | "baixa";
        time_to_act: "agora" | "hoje" | "amanha_cedo" | "monitorar";
      }[] = [];

      if (priRoas > 0 && recRoas < priRoas * 0.8) {
        queue.push({
          type: "roas_drop",
          title: `ROAS caiu ${(((priRoas - recRoas) / priRoas) * 100).toFixed(0)}% — ${c.name}`,
          description: `ROAS recente ${recRoas.toFixed(2)}x vs ${priRoas.toFixed(2)}x anterior.`,
          priority: recRoas < priRoas * 0.6 ? "critical" : "high",
          recommended_action:
            "Revisar criativos e públicos das campanhas com pior performance.",
          confidence: "media",
          time_to_act: "hoje",
        });
      }
      if (priCpa > 0 && recCpa > priCpa * 1.25) {
        queue.push({
          type: "cpa_spike",
          title: `CPA subiu ${(((recCpa - priCpa) / priCpa) * 100).toFixed(0)}% — ${c.name}`,
          description: `CPA recente R$ ${recCpa.toFixed(2)} vs R$ ${priCpa.toFixed(2)}.`,
          priority: "high",
          recommended_action: "Pausar criativos fadigados e ajustar lances.",
          confidence: "media",
          time_to_act: "hoje",
        });
      }
      if (priCtr > 0 && recCtr < priCtr * 0.7) {
        queue.push({
          type: "ctr_drop",
          title: `Queda de CTR — ${c.name}`,
          description: `CTR ${(recCtr * 100).toFixed(2)}% vs ${(priCtr * 100).toFixed(2)}% anterior.`,
          priority: "medium",
          recommended_action: "Renovar criativos. Provável fadiga.",
          confidence: "media",
          time_to_act: "monitorar",
        });
      }
      if (noActivity) {
        queue.push({
          type: "campaign_paused",
          title: `Sem investimento nos últimos 3 dias — ${c.name}`,
          description:
            "Spend zerado por 3 dias. Verifique se as campanhas pararam.",
          priority: "critical",
          recommended_action:
            "Verificar status das campanhas e saldo da conta de anúncios.",
          confidence: "alta",
          time_to_act: "agora",
        });
      }
      if (c.monthly_budget && totalSpend > Number(c.monthly_budget) * 1.1) {
        queue.push({
          type: "budget_pacing",
          title: `Pacing acima do orçamento — ${c.name}`,
          description: `Investido R$ ${totalSpend.toFixed(2)} vs orçamento mensal R$ ${Number(c.monthly_budget).toFixed(2)}.`,
          priority: "high",
          recommended_action: "Reduzir orçamentos diários para alinhar pacing.",
          confidence: "alta",
          time_to_act: "hoje",
        });
      }
      const noteAgo = lastNote
        ? (Date.now() - new Date(lastNote.created_at).getTime()) / 86400000
        : 999;
      if (noteAgo > 14) {
        queue.push({
          type: "no_contact",
          title: `Sem contato há ${Math.round(noteAgo)} dias — ${c.name}`,
          description: "Cliente sem registro de comunicação recente.",
          priority: noteAgo > 30 ? "high" : "medium",
          recommended_action: "Agendar reunião de alinhamento.",
          confidence: "media",
          time_to_act: "amanha_cedo",
        });
      }
      if (convPrior > 0 && convRecent < convPrior * 0.72) {
        queue.push({
          type: "ga4_conversion_drop",
          title: `Conversão do site caiu — ${c.name}`,
          description: `Conversões GA4 caíram ${(((convPrior - convRecent) / convPrior) * 100).toFixed(0)}%.`,
          priority: convRecent < convPrior * 0.55 ? "critical" : "high",
          recommended_action:
            "Revisar landing page, oferta e checkout antes de mexer no budget.",
          confidence: "media",
          time_to_act: "hoje",
        });
      }
      if (revPrior > 0 && revRecent < revPrior * 0.7) {
        queue.push({
          type: "ga4_revenue_drop",
          title: `Receita caiu com tráfego ativo — ${c.name}`,
          description: `Receita GA4 caiu ${(((revPrior - revRecent) / revPrior) * 100).toFixed(0)}% no período recente.`,
          priority: "high",
          recommended_action:
            "Auditar jornada de compra e qualidade do tráfego por canal.",
          confidence: "media",
          time_to_act: "hoje",
        });
      }
      if (
        sessPrior > 0 &&
        sessRecent > sessPrior * 1.2 &&
        (convRecent < convPrior * 0.9 || revRecent < revPrior * 0.9)
      ) {
        queue.push({
          type: "ga4_sessions_up_results_down",
          title: `Tráfego subiu, resultado caiu — ${c.name}`,
          description:
            "Sessões cresceram, mas conversões/receita não acompanharam.",
          priority: "high",
          recommended_action:
            "Ajustar mensagem da página e validar experiência de checkout.",
          confidence: "media",
          time_to_act: "hoje",
        });
      }
      const lastFunnel = (ga4Funnel ?? []).slice(-7);
      const avgF = (k: string) => avgN(lastFunnel as any[], k);
      if (
        avgF("add_to_cart") > 0 &&
        avgF("begin_checkout") < avgF("add_to_cart") * 0.5
      ) {
        queue.push({
          type: "ga4_checkout_drop",
          title: `Queda no checkout — ${c.name}`,
          description: "Início de checkout abaixo do esperado vs add_to_cart.",
          priority: "medium",
          recommended_action: "Revisar frete, preço final e UX no checkout.",
          confidence: "media",
          time_to_act: "amanha_cedo",
        });
      }
      if (trackingHealth?.status === "critical") {
        queue.push({
          type: "ga4_tracking_issue",
          title: `Tracking GA4 crítico — ${c.name}`,
          description: String(
            trackingHealth.notes ?? "Risco de dados incompletos.",
          ),
          priority: "critical",
          recommended_action:
            "Validar configuração GA4 (eventos/chaves de conversão/UTMs).",
          confidence: "alta",
          time_to_act: "agora",
        });
      }

      const priorityRank: Record<string, number> = {
        low: 1,
        medium: 2,
        high: 3,
        critical: 4,
      };
      const isOffHours = (() => {
        const d = new Date();
        const h = d.getHours();
        const wd = d.getDay();
        return wd === 0 || wd === 6 || h < 8 || h >= 18;
      })();

      for (const q of queue) {
        if (openTypes.has(q.type)) continue;
        if (!q.recommended_action?.trim()) continue;

        const dedupSince = new Date(
          Date.now() - 24 * 60 * 60 * 1000,
        ).toISOString();
        const { data: lastSimilar } = await admin
          .from("alerts")
          .select("id, priority, created_at")
          .eq("client_id", c.id)
          .eq("type", q.type)
          .gte("created_at", dedupSince)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (
          lastSimilar &&
          priorityRank[q.priority] <= priorityRank[lastSimilar.priority]
        ) {
          continue;
        }

        const timeToAct =
          isOffHours && q.time_to_act === "agora"
            ? "amanha_cedo"
            : q.time_to_act;
        const governance = baseGovernance("04-alerta-whatsapp", false);
        console.info("prompt_v3.alert", {
          client_id: c.id,
          type: q.type,
          priority: q.priority,
          time_to_act: timeToAct,
        });
        const aiOutputJson = {
          send_whatsapp: true,
          severity:
            q.priority === "critical"
              ? "critico"
              : q.priority === "high"
                ? "urgente"
                : "aviso",
          client: c.name,
          trigger: q.type,
          problem: q.description,
          probable_cause: "Variação relevante recente nos indicadores.",
          recommended_action: q.recommended_action,
          time_to_act: timeToAct,
          confidence: q.confidence,
          should_create_task: true,
          task_title: q.title,
          avoid_duplicate_until: "24h",
        };

        const { error } = await admin.from("alerts").insert({
          agency_id: c.agency_id,
          client_id: c.id,
          type: q.type,
          title: q.title,
          description: q.description,
          priority: q.priority,
          status: "open",
          recommended_action: q.recommended_action,
          ai_output_text: `${q.title}\n${q.description}\nAção: ${q.recommended_action}`,
          ai_output_json: aiOutputJson,
          confianca: q.confidence,
          should_create_task: true,
          task_title: q.title.slice(0, 180),
          avoid_duplicate_until: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          time_to_act: timeToAct,
          ...governance,
        });
        if (!error) created++;
        else if (
          typeof error.message === "string" &&
          error.message.includes("Limite de alertas abertos")
        )
          break;
      }
    }

    return new Response(JSON.stringify({ ok: true, created }), {
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
