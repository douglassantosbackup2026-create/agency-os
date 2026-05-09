// Cron-friendly: computes health scores for all clients of all agencies (or one agency_id).
// verify_jwt=false — use CRON_SECRET + Authorization Bearer (see _shared/cron-auth.ts).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { assertCronOrUser } from "../_shared/cron-auth.ts";

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

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

type PenaltyItem = {
  key: string;
  points: number;
  reason: string;
};

function pickSuggestedNextStep(
  ga4: {
    conversionDeltaPct: number;
    revenueDeltaPct: number;
    sessionsUpResultsDown: boolean;
    funnelDrop: boolean;
    trackingStatus: "healthy" | "warning" | "critical";
  },
  penalties: PenaltyItem[],
  roasDeltaPct: number,
): string {
  if (ga4.trackingStatus === "critical") {
    return "Auditar tags, consentimento e eventos GA4; estabilizar tracking antes de escalar mídia.";
  }
  const keys = new Set(penalties.map((p) => p.key));
  if (keys.has("ga4_conversion_drop") || keys.has("ga4_revenue_drop")) {
    return "Revisar páginas de destino, oferta e mensagens; validar conversões no GA4.";
  }
  if (keys.has("sessions_up_results_down")) {
    return "Investigar qualidade do tráfego e criativos; hipóteses de conversão no site.";
  }
  if (keys.has("funnel_drop")) {
    return "Priorizar gargalos no funil (carrinho/checkout) com testes rápidos.";
  }
  if (roasDeltaPct < -15) {
    return "ROAS em queda vs período anterior: revisar estrutura de campanhas, criativos e lances.";
  }
  return "Abrir a Central de Ações e alinhar próximo passo operacional com o cliente.";
}

function computeFor(
  metrics: M[],
  lastActivityAgo: number,
  lastNoteAgo: number,
  ga4: {
    conversionDeltaPct: number;
    revenueDeltaPct: number;
    sessionsUpResultsDown: boolean;
    funnelDrop: boolean;
    trackingStatus: "healthy" | "warning" | "critical";
  },
) {
  // Split into recent (last 14d) vs prior (15-28d)
  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  const today = sorted.length
    ? sorted[sorted.length - 1].date
    : new Date().toISOString().slice(0, 10);
  const cutoff = new Date(new Date(today).getTime() - 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const recent = sorted.filter((m) => m.date > cutoff);
  const prior = sorted.filter((m) => m.date <= cutoff);
  const avg = (arr: M[], k: keyof M) =>
    arr.length
      ? arr.reduce((a, b) => a + Number(b[k] ?? 0), 0) / arr.length
      : 0;

  const recRoas = avg(recent, "roas");
  const priRoas = avg(prior, "roas");
  const recCpa = avg(recent, "cpa");
  const priCpa = avg(prior, "cpa");
  const recCtr = avg(recent, "ctr");

  // Performance: ROAS absoluto (>=3 = 100, <1 = 0)
  const ga4Penalty = Math.max(
    0,
    -(ga4.conversionDeltaPct + ga4.revenueDeltaPct),
  );
  const performance = clamp(recRoas * 33 - ga4Penalty * 0.4);
  // Optimization: estabilidade entre períodos (delta < 10% = 100)
  const roasDelta = priRoas > 0 ? Math.abs(recRoas - priRoas) / priRoas : 0;
  const cpaDelta = priCpa > 0 ? Math.abs(recCpa - priCpa) / priCpa : 0;
  const optimization = clamp(
    100 -
      (roasDelta + cpaDelta) * 100 -
      (ga4.sessionsUpResultsDown ? 15 : 0) -
      (ga4.funnelDrop ? 18 : 0),
  );
  // Stability: variância de ROAS diário
  const variance = recent.length
    ? (() => {
        const mean = recRoas;
        const v =
          recent.reduce(
            (a, b) => a + Math.pow(Number(b.roas ?? 0) - mean, 2),
            0,
          ) / recent.length;
        return Math.sqrt(v);
      })()
    : 0;
  const stability = clamp(
    100 - variance * 30 - (ga4.trackingStatus === "critical" ? 20 : 0),
  );
  // Communication: tempo desde última nota (0d=100, 30d=0)
  const communication = clamp(100 - (lastNoteAgo / 30) * 100);
  // Engagement: tempo desde última activity (0d=100, 14d=0)
  const engagement = clamp(100 - (lastActivityAgo / 14) * 100);

  const score = Math.round(
    (performance + optimization + stability + communication + engagement) / 5,
  );
  const risk: "low" | "medium" | "high" =
    score >= 70 ? "low" : score >= 45 ? "medium" : "high";

  const roasDeltaPct = priRoas > 0 ? ((recRoas - priRoas) / priRoas) * 100 : 0;
  const penaltiesRaw = [
    ga4.conversionDeltaPct < -20
      ? {
          key: "ga4_conversion_drop",
          points: Math.round(Math.abs(ga4.conversionDeltaPct) * 0.25),
          reason: `Taxa de conversão em queda (${ga4.conversionDeltaPct.toFixed(1)}%).`,
        }
      : null,
    ga4.revenueDeltaPct < -20
      ? {
          key: "ga4_revenue_drop",
          points: Math.round(Math.abs(ga4.revenueDeltaPct) * 0.25),
          reason: `Receita em queda (${ga4.revenueDeltaPct.toFixed(1)}%).`,
        }
      : null,
    ga4.sessionsUpResultsDown
      ? {
          key: "sessions_up_results_down",
          points: 10,
          reason: "Sessões sobem, mas conversões/receita não acompanham.",
        }
      : null,
    ga4.funnelDrop
      ? {
          key: "funnel_drop",
          points: 8,
          reason: "Gargalo identificado no funil de site/checkout.",
        }
      : null,
    ga4.trackingStatus === "critical"
      ? {
          key: "tracking_critical",
          points: 12,
          reason: "Tracking crítico, risco de análise incompleta.",
        }
      : null,
  ].filter(Boolean) as PenaltyItem[];

  const score_explanation = {
    blocks: {
      budget_pace: Math.round(stability),
      media_performance: Math.round(performance),
      business_ga4: Math.round(optimization),
      operational_management: Math.round(communication),
      relationship_risk: Math.round(engagement),
    },
    penalties: penaltiesRaw,
    signals: {
      tracking_status: ga4.trackingStatus,
      conversion_delta_pct: Math.round(ga4.conversionDeltaPct * 10) / 10,
      revenue_delta_pct: Math.round(ga4.revenueDeltaPct * 10) / 10,
      roas_recent: Math.round(recRoas * 100) / 100,
      roas_prior: Math.round(priRoas * 100) / 100,
      roas_delta_pct: Math.round(roasDeltaPct * 10) / 10,
    },
    suggested_next_step: pickSuggestedNextStep(ga4, penaltiesRaw, roasDeltaPct),
  };

  return {
    score,
    risk,
    performance_score: Math.round(performance),
    optimization_score: Math.round(optimization),
    stability_score: Math.round(stability),
    communication_score: Math.round(communication),
    engagement_score: Math.round(engagement),
    ga4_context: ga4,
    score_explanation,
  };
}

type BriefRow = {
  agency_id: string;
  client_id: string;
  name: string;
  score: number;
  risk: string;
  trackingStatus: string;
  daysSinceMetric: number;
  sessionsUpResultsDown: boolean;
};

type BriefEntry = { client_id: string; name: string; reason: string };

type BriefBuckets = {
  critico: BriefEntry[];
  atencao: BriefEntry[];
  sem_atualizacao: BriefEntry[];
  oportunidade: BriefEntry[];
};

function briefingBucket(row: BriefRow): keyof BriefBuckets | null {
  const trackingCrit = row.trackingStatus === "critical";
  if (row.score < 45 || row.risk === "high" || trackingCrit) return "critico";
  if (row.daysSinceMetric > 7) return "sem_atualizacao";
  if (row.score < 70 || row.risk === "medium") return "atencao";
  if (row.score >= 75 && row.risk === "low" && !row.sessionsUpResultsDown) {
    return "oportunidade";
  }
  return null;
}

function applyAuditPenaltyToHealth(
  base: ReturnType<typeof computeFor>,
  audit:
    | { created_at: string; result_json: unknown }
    | undefined
    | null,
): ReturnType<typeof computeFor> {
  if (!audit?.created_at) return base;
  const days =
    (Date.now() - new Date(audit.created_at).getTime()) / 86400000;
  if (days > 14) return base;
  const rj = audit.result_json as Record<string, unknown> | null;
  const st = String(rj?.overall_status ?? "").toLowerCase();
  let pts = 0;
  let reason = "";
  if (st === "critical") {
    pts = 14;
    reason = "Auditoria de campanhas (IA) recente: status crítico.";
  } else if (st === "risk") {
    pts = 10;
    reason = "Auditoria de campanhas (IA) recente: risco elevado.";
  } else if (st === "attention") {
    pts = 5;
    reason = "Auditoria de campanhas (IA) recente: requer atenção.";
  } else {
    return base;
  }
  const newScore = clamp(base.score - pts);
  const risk: "low" | "medium" | "high" =
    newScore >= 70 ? "low" : newScore >= 45 ? "medium" : "high";
  const explain = base.score_explanation;
  const penalties = [
    ...explain.penalties,
    { key: "campaign_audit_ia", points: pts, reason },
  ];
  const signals = {
    ...explain.signals,
    audit_overall_status: st,
    audit_age_days: Math.round(days * 10) / 10,
  };
  return {
    ...base,
    score: newScore,
    risk,
    score_explanation: {
      ...explain,
      penalties,
      signals,
    },
  };
}

function reasonForBucket(b: keyof BriefBuckets, row: BriefRow): string {
  if (b === "critico") {
    const bits = [`Score ${row.score}`, `risco ${row.risk}`];
    if (row.trackingStatus === "critical") bits.push("tracking GA4 crítico");
    return bits.join(" · ");
  }
  if (b === "sem_atualizacao") {
    return `Sem métricas agregadas há ${Math.round(row.daysSinceMetric)} dias`;
  }
  if (b === "atencao")
    return `Score ${row.score} — revisar ritmo e comunicação`;
  return "Operação estável — avaliar escala ou novos testes";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  const denied = await assertCronOrUser(req);
  if (denied) return denied;
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key);

    let agencyFilter: string | undefined;
    if (req.method === "POST") {
      try {
        const b = await req.json();
        if (b?.agency_id) agencyFilter = b.agency_id as string;
      } catch {
        /* empty body */
      }
    }

    let q = admin.from("clients").select("id, agency_id, name");
    if (agencyFilter) q = q.eq("agency_id", agencyFilter);
    const { data: clients, error: cErr } = await q;
    if (cErr) throw cErr;

    const clientIds = (clients ?? []).map((c) => String(c.id));
    const latestAuditByClient = new Map<
      string,
      { created_at: string; result_json: unknown }
    >();
    if (clientIds.length) {
      const { data: auditRows } = await admin
        .from("campaign_ai_audits")
        .select("client_id, created_at, result_json")
        .in("client_id", clientIds)
        .order("created_at", { ascending: false });
      for (const row of auditRows ?? []) {
        const cid = String(row.client_id);
        if (!latestAuditByClient.has(cid)) {
          latestAuditByClient.set(cid, {
            created_at: String(row.created_at),
            result_json: row.result_json,
          });
        }
      }
    }

    const since = new Date(Date.now() - 28 * 86400000)
      .toISOString()
      .slice(0, 10);
    let processed = 0;
    const inserts: Record<string, unknown>[] = [];
    const briefRows: BriefRow[] = [];

    for (const c of clients ?? []) {
      const [
        { data: metrics },
        { data: lastAct },
        { data: lastNote },
        { data: ga4Daily },
        { data: ga4Funnel },
        { data: tracking },
      ] = await Promise.all([
        admin
          .from("metrics_daily")
          .select("date,spend,revenue,roas,cpa,ctr,conversions")
          .eq("client_id", c.id)
          .is("campaign_id", null)
          .gte("date", since),
        admin
          .from("activities")
          .select("created_at")
          .eq("client_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
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
          .select("date, add_to_cart_rate, checkout_rate, purchase_rate")
          .eq("client_id", c.id)
          .gte("date", since)
          .order("date"),
        admin
          .from("ga4_tracking_health_daily")
          .select("status, tracking_drop_detected")
          .eq("client_id", c.id)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const g = ga4Daily ?? [];
      const mid = Math.floor(g.length / 2);
      const gPrior = g.slice(0, mid);
      const gRecent = g.slice(mid);
      const avgNum = (arr: any[], key: string) =>
        arr.length
          ? arr.reduce((a, b) => a + Number(b[key] ?? 0), 0) / arr.length
          : 0;
      const recConv = avgNum(gRecent, "conversions");
      const priConv = avgNum(gPrior, "conversions");
      const recRev = avgNum(gRecent, "revenue");
      const priRev = avgNum(gPrior, "revenue");
      const recSessions = avgNum(gRecent, "sessions");
      const priSessions = avgNum(gPrior, "sessions");
      const conversionDeltaPct =
        priConv > 0 ? ((recConv - priConv) / priConv) * 100 : 0;
      const revenueDeltaPct =
        priRev > 0 ? ((recRev - priRev) / priRev) * 100 : 0;
      const sessionsUpResultsDown =
        recSessions > priSessions * 1.15 &&
        (recConv < priConv * 0.9 || recRev < priRev * 0.9);
      const funnelDrop = (ga4Funnel ?? [])
        .slice(-3)
        .some(
          (f: any) =>
            Number(f.add_to_cart_rate ?? 0) < 0.03 ||
            Number(f.checkout_rate ?? 0) < 0.2 ||
            Number(f.purchase_rate ?? 0) < 0.2,
        );
      const trackingStatus =
        (tracking?.status as "healthy" | "warning" | "critical") ?? "healthy";
      const now = Date.now();
      const lastActAgo = lastAct
        ? (now - new Date(lastAct.created_at).getTime()) / 86400000
        : 14;
      const lastNoteAgo = lastNote
        ? (now - new Date(lastNote.created_at).getTime()) / 86400000
        : 30;
      const raw = computeFor((metrics ?? []) as M[], lastActAgo, lastNoteAgo, {
        conversionDeltaPct,
        revenueDeltaPct,
        sessionsUpResultsDown,
        funnelDrop,
        trackingStatus,
      });
      const r = applyAuditPenaltyToHealth(
        raw,
        latestAuditByClient.get(String(c.id)),
      );
      inserts.push({ agency_id: c.agency_id, client_id: c.id, ...r });

      const mlist = (metrics ?? []) as M[];
      const dates = mlist
        .map((x) => x.date)
        .filter(Boolean)
        .sort();
      const lastD = dates.length ? dates[dates.length - 1] : null;
      const daysSinceMetric = lastD
        ? (Date.now() - new Date(`${lastD}T12:00:00Z`).getTime()) / 86400000
        : 999;

      briefRows.push({
        agency_id: c.agency_id as string,
        client_id: c.id as string,
        name: (c.name as string) ?? "Cliente",
        score: r.score,
        risk: r.risk,
        trackingStatus,
        daysSinceMetric,
        sessionsUpResultsDown,
      });
      processed++;
    }

    if (inserts.length) {
      const { error } = await admin.from("health_scores").insert(inserts);
      if (error) throw error;
    }

    const agencyBucketMap = new Map<string, BriefBuckets>();
    for (const row of briefRows) {
      const b = briefingBucket(row);
      if (!b) continue;
      if (!agencyBucketMap.has(row.agency_id)) {
        agencyBucketMap.set(row.agency_id, {
          critico: [],
          atencao: [],
          sem_atualizacao: [],
          oportunidade: [],
        });
      }
      const bk = agencyBucketMap.get(row.agency_id)!;
      bk[b].push({
        client_id: row.client_id,
        name: row.name,
        reason: reasonForBucket(b, row),
      });
    }
    for (const [agency_id, buckets] of agencyBucketMap) {
      const { error: bErr } = await admin.from("agency_briefings").upsert(
        {
          agency_id,
          buckets,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "agency_id" },
      );
      if (bErr) console.error("agency_briefings upsert", bErr);
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
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
