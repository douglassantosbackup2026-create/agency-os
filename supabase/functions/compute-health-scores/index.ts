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

function computeFor(
  metrics: M[],
  lastActivityAgo: number,
  lastNoteAgo: number,
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
  const performance = clamp(recRoas * 33);
  // Optimization: estabilidade entre períodos (delta < 10% = 100)
  const roasDelta = priRoas > 0 ? Math.abs(recRoas - priRoas) / priRoas : 0;
  const cpaDelta = priCpa > 0 ? Math.abs(recCpa - priCpa) / priCpa : 0;
  const optimization = clamp(100 - (roasDelta + cpaDelta) * 100);
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
  const stability = clamp(100 - variance * 30);
  // Communication: tempo desde última nota (0d=100, 30d=0)
  const communication = clamp(100 - (lastNoteAgo / 30) * 100);
  // Engagement: tempo desde última activity (0d=100, 14d=0)
  const engagement = clamp(100 - (lastActivityAgo / 14) * 100);

  const score = Math.round(
    (performance + optimization + stability + communication + engagement) / 5,
  );
  const risk: "low" | "medium" | "high" =
    score >= 70 ? "low" : score >= 45 ? "medium" : "high";

  return {
    score,
    risk,
    performance_score: Math.round(performance),
    optimization_score: Math.round(optimization),
    stability_score: Math.round(stability),
    communication_score: Math.round(communication),
    engagement_score: Math.round(engagement),
  };
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

    const since = new Date(Date.now() - 28 * 86400000)
      .toISOString()
      .slice(0, 10);
    let processed = 0;
    const inserts: Record<string, unknown>[] = [];

    for (const c of clients ?? []) {
      const [{ data: metrics }, { data: lastAct }, { data: lastNote }] =
        await Promise.all([
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
        ]);
      const now = Date.now();
      const lastActAgo = lastAct
        ? (now - new Date(lastAct.created_at).getTime()) / 86400000
        : 14;
      const lastNoteAgo = lastNote
        ? (now - new Date(lastNote.created_at).getTime()) / 86400000
        : 30;
      const r = computeFor((metrics ?? []) as M[], lastActAgo, lastNoteAgo);
      inserts.push({ agency_id: c.agency_id, client_id: c.id, ...r });
      processed++;
    }

    if (inserts.length) {
      const { error } = await admin.from("health_scores").insert(inserts);
      if (error) throw error;
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
