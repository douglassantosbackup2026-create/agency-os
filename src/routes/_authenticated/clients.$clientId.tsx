import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, num, pct, timeAgo } from "@/lib/format";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  RefreshCw,
  Activity as ActivityIcon,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardHeader,
  Empty,
  PageSkeleton,
  Row,
  RiskDot,
  ScoreBar,
  Stat,
} from "./dashboard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  component: ClientDetail,
});

type ClientTab =
  | "overview"
  | "metrics"
  | "health_timeline"
  | "insights"
  | "ad_accounts"
  | "campaigns"
  | "alerts"
  | "reports"
  | "notes"
  | "tasks"
  | "activity";

const TAB_ORDER: ClientTab[] = [
  "overview",
  "metrics",
  "health_timeline",
  "insights",
  "ad_accounts",
  "campaigns",
  "alerts",
  "reports",
  "notes",
  "tasks",
  "activity",
];

function tabLabel(t: ClientTab): string {
  const m: Record<ClientTab, string> = {
    overview: "Visão geral",
    metrics: "Métricas",
    health_timeline: "Health",
    insights: "Insights IA",
    ad_accounts: "Contas Ads",
    campaigns: "Campanhas",
    alerts: "Alertas",
    reports: "Relatórios",
    notes: "Notas",
    tasks: "Tarefas",
    activity: "Atividade",
  };
  return m[t];
}

function ClientDetail() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ClientTab>("overview");
  const [generating, setGenerating] = useState(false);
  const [newAccountProvider, setNewAccountProvider] = useState("meta_ads");
  const [newAccountId, setNewAccountId] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [generatingMeeting, setGeneratingMeeting] = useState(false);
  const [analyzingNow, setAnalyzingNow] = useState(false);
  const [clickContext, setClickContext] = useState<
    "reuniao" | "pos_ajuste" | "suspeita_problema" | "checkin_rotina"
  >("checkin_rotina");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const [
        client,
        metrics,
        campaigns,
        alerts,
        reports,
        notes,
        health,
        tasks,
        activities,
        adAccounts,
        meetingReports,
        ga4Daily,
        ga4Funnel,
        ga4Channels,
        ga4Tracking,
      ] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
        supabase
          .from("metrics_daily")
          .select("*")
          .eq("client_id", clientId)
          .is("campaign_id", null)
          .order("date", { ascending: false })
          .limit(60),
        supabase
          .from("campaigns")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("alerts")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("reports")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("notes")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("health_scores")
          .select("*")
          .eq("client_id", clientId)
          .order("recorded_at", { ascending: false })
          .limit(30),
        supabase
          .from("tasks")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("activities")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(50),
        (supabase as any)
          .from("client_platform_accounts")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("meeting_reports")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(10),
        (supabase as any)
          .from("ga4_daily")
          .select("*")
          .eq("client_id", clientId)
          .order("date", { ascending: false })
          .limit(60),
        (supabase as any)
          .from("ga4_funnel_daily")
          .select("*")
          .eq("client_id", clientId)
          .order("date", { ascending: false })
          .limit(30),
        (supabase as any)
          .from("ga4_channel_daily")
          .select("*")
          .eq("client_id", clientId)
          .order("date", { ascending: false })
          .limit(60),
        (supabase as any)
          .from("ga4_tracking_health_daily")
          .select("*")
          .eq("client_id", clientId)
          .order("date", { ascending: false })
          .limit(1),
      ]);
      return {
        client: client.data,
        metrics: metrics.data ?? [],
        campaigns: campaigns.data ?? [],
        alerts: alerts.data ?? [],
        reports: reports.data ?? [],
        notes: notes.data ?? [],
        health: health.data ?? [],
        tasks: tasks.data ?? [],
        activities: activities.data ?? [],
        adAccounts: adAccounts.data ?? [],
        meetingReports: meetingReports.data ?? [],
        ga4Daily: ga4Daily.data ?? [],
        ga4Funnel: ga4Funnel.data ?? [],
        ga4Channels: ga4Channels.data ?? [],
        ga4Tracking: ga4Tracking.data ?? [],
      };
    },
  });

  const metricsSeries = useMemo(() => {
    const metrics = data?.metrics ?? [];
    const sorted = [...metrics].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
    return sorted.slice(-30).map((m) => ({
      date: String(m.date).slice(5),
      spend: Number(m.spend ?? 0),
      revenue: Number(m.revenue ?? 0),
      roas: Number(m.roas ?? 0),
    }));
  }, [data?.metrics]);

  const healthSeries = useMemo(() => {
    const health = data?.health ?? [];
    const sorted = [...health].sort((a, b) =>
      String(a.recorded_at).localeCompare(String(b.recorded_at)),
    );
    return sorted.slice(-14).map((h) => ({
      t: new Date(h.recorded_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      }),
      score: h.score,
    }));
  }, [data?.health]);

  const healthInsights = useMemo(() => {
    const health = data?.health ?? [];
    const sorted = [...health].sort((a, b) =>
      String(a.recorded_at).localeCompare(String(b.recorded_at)),
    );
    const last = sorted.slice(-10);
    if (!last.length)
      return { avg: null as number | null, delta: null as number | null };
    const avg =
      last.reduce((s, h) => s + Number(h.score ?? 0), 0) / last.length;
    let delta: number | null = null;
    if (last.length >= 4) {
      const mid = Math.floor(last.length / 2);
      const a1 =
        last.slice(0, mid).reduce((s, h) => s + Number(h.score ?? 0), 0) /
        Math.max(1, mid);
      const a2 =
        last.slice(mid).reduce((s, h) => s + Number(h.score ?? 0), 0) /
        Math.max(1, last.length - mid);
      delta = Math.round((a2 - a1) * 10) / 10;
    }
    return { avg: Math.round(avg * 10) / 10, delta };
  }, [data?.health]);
  const ga4Insights = useMemo(() => {
    const rows = data?.ga4Daily ?? [];
    const cur = rows.filter(
      (r: any) => new Date(r.date).getTime() >= Date.now() - 30 * 86400000,
    );
    const prev = rows.filter((r: any) => {
      const ts = new Date(r.date).getTime();
      return (
        ts < Date.now() - 30 * 86400000 && ts >= Date.now() - 60 * 86400000
      );
    });
    const sum = (arr: any[], k: string) =>
      arr.reduce((a, b) => a + Number(b[k] ?? 0), 0);
    const sessions = sum(cur, "sessions");
    const conv = sum(cur, "conversions");
    const rev = sum(cur, "revenue");
    const prevSessions = sum(prev, "sessions");
    const prevConv = sum(prev, "conversions");
    const cvr = sessions > 0 ? conv / sessions : 0;
    const prevCvr = prevSessions > 0 ? prevConv / prevSessions : 0;
    const topChannelMap = new Map<string, number>();
    for (const ch of data?.ga4Channels ?? []) {
      const key = String(ch.channel ?? "Unassigned");
      topChannelMap.set(
        key,
        (topChannelMap.get(key) ?? 0) + Number(ch.revenue ?? 0),
      );
    }
    const topChannel = [...topChannelMap.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    const funnel = (data?.ga4Funnel ?? []).slice(0, 7);
    const avg = (k: string) =>
      funnel.length
        ? funnel.reduce((a: number, b: any) => a + Number(b[k] ?? 0), 0) /
          funnel.length
        : 0;
    const tracking = data?.ga4Tracking?.[0] ?? null;
    return {
      sessions,
      conv,
      rev,
      cvr,
      prevCvr,
      topChannel: topChannel?.[0] ?? null,
      avgAdd: avg("add_to_cart"),
      avgCheckout: avg("begin_checkout"),
      avgPurchase: avg("purchase"),
      tracking,
    };
  }, [data?.ga4Daily, data?.ga4Funnel, data?.ga4Channels, data?.ga4Tracking]);

  if (isLoading || !data) return <PageSkeleton preset="compact" />;
  if (!data.client)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Cliente não encontrado.
      </div>
    );

  const c = data.client;
  const last30 = data.metrics.slice(0, 30);
  const spend = last30.reduce((a, b) => a + Number(b.spend ?? 0), 0);
  const revenue = last30.reduce((a, b) => a + Number(b.revenue ?? 0), 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa =
    last30.reduce((a, b) => a + Number(b.conversions ?? 0), 0) > 0
      ? spend / last30.reduce((a, b) => a + Number(b.conversions ?? 0), 0)
      : 0;
  const ctr = last30.length
    ? last30.reduce((a, b) => a + Number(b.ctr ?? 0), 0) / last30.length
    : 0;
  const latestHealth = data.health[0];

  async function generateReport() {
    setGenerating(true);
    const { data: res, error } = await supabase.functions.invoke(
      "generate-report",
      { body: { client_id: clientId } },
    );
    setGenerating(false);
    if (error || !res)
      return toast.error(error?.message ?? "Erro ao gerar relatório.");
    toast.success("Relatório gerado pela IA.");
    refetch();
    setTab("reports");
  }

  async function addAccount() {
    if (!data?.client) return;
    if (!newAccountId.trim()) {
      toast.error("Informe o ID da conta.");
      return;
    }
    const sb = supabase as any;
    const { error } = await sb.from("client_platform_accounts").insert({
      agency_id: data.client.agency_id,
      client_id: clientId,
      provider: newAccountProvider,
      account_external_id: newAccountId.trim(),
      account_name: newAccountName.trim() || null,
      is_active: true,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta vinculada ao cliente.");
    setNewAccountId("");
    setNewAccountName("");
    refetch();
  }

  async function removeAccount(accountId: string) {
    const sb = supabase as any;
    const { error } = await sb
      .from("client_platform_accounts")
      .delete()
      .eq("id", accountId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta removida.");
    refetch();
  }

  async function generateMeetingReport() {
    setGeneratingMeeting(true);
    const { error } = await supabase.functions.invoke(
      "generate-meeting-report",
      {
        body: { client_id: clientId },
      },
    );
    setGeneratingMeeting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pauta de reunião gerada.");
    refetch();
  }

  async function analyzeNow() {
    setAnalyzingNow(true);
    const { error } = await supabase.functions.invoke("generate-report", {
      body: {
        client_id: clientId,
        mode: "on_demand",
        click_context: clickContext,
      },
    });
    setAnalyzingNow(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Análise sob demanda gerada.");
    refetch();
    setTab("reports");
  }

  return (
    <div className="space-y-5 p-6">
      <Link
        to="/clients"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Clientes
      </Link>

      <header className="flex items-end justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-base font-semibold text-primary">
            {c.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {c.segment ?? "—"} · {c.status}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={clickContext}
            onChange={(e) =>
              setClickContext(
                e.target.value as
                  | "reuniao"
                  | "pos_ajuste"
                  | "suspeita_problema"
                  | "checkin_rotina",
              )
            }
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="checkin_rotina">Check-in de rotina</option>
            <option value="reuniao">Antes de reunião</option>
            <option value="pos_ajuste">Após ajuste de campanha</option>
            <option value="suspeita_problema">Suspeita de problema</option>
          </select>
          <button
            onClick={analyzeNow}
            disabled={analyzingNow}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-60 transition"
          >
            {analyzingNow ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Analisar agora
          </button>
          <button
            onClick={generateReport}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Gerar relatório IA
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat
          icon={Sparkles}
          label="ROAS 30d"
          value={`${roas.toFixed(2)}x`}
          accent={roas >= 2 ? "text-success" : "text-warning"}
        />
        <Stat icon={Sparkles} label="Spend 30d" value={brl(spend)} />
        <Stat
          icon={Sparkles}
          label="Receita 30d"
          value={brl(revenue)}
          accent="text-success"
        />
        <Stat icon={Sparkles} label="CPA médio" value={brl(cpa)} />
        <Stat icon={Sparkles} label="CTR médio" value={pct(ctr)} />
      </div>

      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border pb-px">
        {TAB_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-t-md px-3 py-2 text-sm whitespace-nowrap transition ${tab === t ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tabLabel(t)}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Health Score" />
              <div className="space-y-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="font-mono text-4xl font-semibold tabular">
                    {latestHealth?.score ?? "--"}
                  </div>
                  {latestHealth && <RiskDot risk={latestHealth.risk} />}
                </div>
                {latestHealth && <ScoreBar score={latestHealth.score} />}
                <div className="space-y-2 pt-2">
                  <Row
                    label="Performance"
                    value={String(latestHealth?.performance_score ?? "—")}
                  />
                  <Row
                    label="Otimização"
                    value={String(latestHealth?.optimization_score ?? "—")}
                  />
                  <Row
                    label="Comunicação"
                    value={String(latestHealth?.communication_score ?? "—")}
                  />
                  <Row
                    label="Estabilidade"
                    value={String(latestHealth?.stability_score ?? "—")}
                  />
                  <Row
                    label="Engajamento"
                    value={String(latestHealth?.engagement_score ?? "—")}
                  />
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title="Métricas (últimos 30 dias)" />
              <div className="grid grid-cols-2 gap-3 p-4">
                <Row label="Investimento" value={brl(spend)} />
                <Row
                  label="Receita"
                  value={brl(revenue)}
                  accent="text-success"
                />
                <Row
                  label="ROAS"
                  value={`${roas.toFixed(2)}x`}
                  accent={roas >= 2 ? "text-success" : "text-warning"}
                />
                <Row label="CPA" value={brl(cpa)} />
                <Row label="CTR médio" value={pct(ctr)} />
                <Row label="MRR" value={brl(c.mrr)} />
              </div>
            </Card>
          </div>

          {data.alerts.some(
            (a: { status?: string; recommended_action?: string | null }) =>
              a.status === "open" && a.recommended_action,
          ) && (
            <Card>
              <CardHeader title="Alertas abertos — ações sugeridas" />
              <div className="divide-y divide-border">
                {data.alerts
                  .filter(
                    (a: {
                      status?: string;
                      recommended_action?: string | null;
                    }) => a.status === "open" && a.recommended_action,
                  )
                  .map(
                    (a: {
                      id: string;
                      title: string;
                      recommended_action?: string | null;
                    }) => (
                      <div key={a.id} className="px-4 py-3 text-xs">
                        <div className="font-medium">{a.title}</div>
                        <div className="mt-1 text-muted-foreground">
                          {a.recommended_action}
                        </div>
                      </div>
                    ),
                  )}
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "metrics" && (
        <Card>
          <CardHeader title="Série diária (até 30 pontos)" />
          <div className="h-72 p-4">
            {metricsSeries.length === 0 ? (
              <Empty label="Sem dados de métricas." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsSeries}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="spend"
                    name="Spend"
                    stroke="hsl(var(--primary))"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Receita"
                    stroke="hsl(142 76% 36%)"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="h-56 border-t border-border p-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              ROAS (linha)
            </p>
            {metricsSeries.length === 0 ? null : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsSeries}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="roas"
                    name="ROAS"
                    stroke="hsl(var(--warning))"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      )}

      {tab === "health_timeline" && (
        <Card>
          <CardHeader title="Evolução do Health Score" />
          <div className="h-80 p-4">
            {healthSeries.length === 0 ? (
              <Empty label="Sem histórico de health." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={healthSeries}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      )}

      {tab === "insights" && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Relatórios IA recentes" />
            <div className="space-y-3 p-4">
              {data.reports.length === 0 ? (
                <Empty label="Gere um relatório IA para ver o resumo aqui." />
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Último relatório · {timeAgo(data.reports[0].created_at)}
                    {data.reports[0].period_start &&
                      data.reports[0].period_end && (
                        <>
                          {" "}
                          · Período{" "}
                          {String(data.reports[0].period_start).slice(
                            0,
                            10,
                          )} → {String(data.reports[0].period_end).slice(0, 10)}
                        </>
                      )}
                  </p>
                  <ReportSection
                    title="Resumo executivo"
                    body={data.reports[0].executive_summary}
                  />
                  {data.reports[0].opportunities ? (
                    <ReportSection
                      title="Oportunidades"
                      body={data.reports[0].opportunities}
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setTab("reports")}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Ver todos os relatórios deste cliente →
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/reports" })}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Abrir lista global de relatórios
                    </button>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Health — leitura rápida" />
            <div className="space-y-3 p-4 text-sm">
              {healthInsights.avg == null ? (
                <Empty label="Sem pontos de health ainda." />
              ) : (
                <>
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Média (últimos registos)
                      </div>
                      <div className="font-mono text-2xl font-semibold tabular">
                        {healthInsights.avg}
                      </div>
                    </div>
                    {healthInsights.delta != null && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Tendência (1ª vs 2ª metade)
                        </div>
                        <div
                          className={
                            healthInsights.delta >= 0
                              ? "font-medium text-emerald-600 dark:text-emerald-400"
                              : "font-medium text-amber-600 dark:text-amber-400"
                          }
                        >
                          {healthInsights.delta >= 0 ? "+" : ""}
                          {healthInsights.delta} pts
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("health_timeline")}
                    className="text-xs text-primary hover:underline"
                  >
                    Ver gráfico completo →
                  </button>
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Resultado no site (GA4)" />
            <div className="space-y-2 p-4 text-sm">
              <Row
                label="Sessões 30d"
                value={String(Math.round(ga4Insights.sessions))}
              />
              <Row
                label="Conversões 30d"
                value={String(Math.round(ga4Insights.conv))}
              />
              <Row label="Receita GA4 30d" value={brl(ga4Insights.rev)} />
              <Row
                label="Taxa de conversão"
                value={`${pct(ga4Insights.cvr * 100)} (ant. ${pct(ga4Insights.prevCvr * 100)})`}
              />
              <Row
                label="Canal top (receita)"
                value={ga4Insights.topChannel ?? "—"}
              />
              <Row
                label="Funil médio 7d"
                value={`ATC ${num(ga4Insights.avgAdd, 1)} | Checkout ${num(ga4Insights.avgCheckout, 1)} | Purchase ${num(ga4Insights.avgPurchase, 1)}`}
              />
              <Row
                label="Tracking Health"
                value={`${ga4Insights.tracking?.status ?? "não disponível"}`}
                accent={
                  ga4Insights.tracking?.status === "critical"
                    ? "text-destructive"
                    : ga4Insights.tracking?.status === "warning"
                      ? "text-warning"
                      : "text-success"
                }
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Pauta de reunião (IA)"
              action={
                <button
                  type="button"
                  onClick={generateMeetingReport}
                  disabled={generatingMeeting}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface disabled:opacity-60"
                >
                  {generatingMeeting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Gerar pauta
                </button>
              }
            />
            <div className="space-y-2 p-4">
              {data.meetingReports.length === 0 ? (
                <Empty label="Ainda sem pautas geradas." />
              ) : (
                data.meetingReports.map((mr: any) => (
                  <div
                    key={mr.id}
                    className="rounded-md border border-border p-3 text-sm"
                  >
                    <div className="mb-1 text-xs text-muted-foreground">
                      {new Date(mr.created_at).toLocaleString("pt-BR")} ·{" "}
                      {String(mr.period_start ?? "").slice(0, 10)} →{" "}
                      {String(mr.period_end ?? "").slice(0, 10)}
                    </div>
                    <div className="whitespace-pre-line text-foreground/90">
                      {mr.agenda}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "tasks" && (
        <Card>
          {data.tasks.length === 0 ? (
            <Empty label="Nenhuma tarefa para este cliente." />
          ) : (
            <div className="divide-y divide-border">
              {data.tasks.map((tk: Record<string, unknown>) => (
                <div
                  key={String(tk.id)}
                  className="flex items-start justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{String(tk.title)}</div>
                    {tk.description ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {String(tk.description)}
                      </div>
                    ) : null}
                  </div>
                  <span className="rounded bg-surface px-2 py-0.5 text-[10px] uppercase">
                    {String(tk.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "activity" && (
        <Card>
          {data.activities.length === 0 ? (
            <Empty label="Sem atividades registradas." />
          ) : (
            <div className="divide-y divide-border">
              {data.activities.map((ev: Record<string, unknown>) => (
                <div key={String(ev.id)} className="flex gap-3 px-4 py-3">
                  <ActivityIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{String(ev.title)}</div>
                    {ev.description ? (
                      <div className="text-xs text-muted-foreground">
                        {String(ev.description)}
                      </div>
                    ) : null}
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {timeAgo(String(ev.created_at))}
                    </div>
                  </div>
                  <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {String(ev.type)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "campaigns" && (
        <Card>
          {data.campaigns.length === 0 ? (
            <Empty label="Nenhuma campanha cadastrada." />
          ) : (
            <div className="divide-y divide-border">
              {data.campaigns.map((cm) => (
                <div
                  key={cm.id}
                  className="grid grid-cols-12 items-center px-4 py-3 text-sm"
                >
                  <div className="col-span-5">
                    <div className="font-medium">{cm.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {cm.platform} · {cm.objective ?? "—"}
                    </div>
                  </div>
                  <div className="col-span-3">
                    <span className="rounded bg-surface px-2 py-0.5 text-[11px] uppercase">
                      {cm.status}
                    </span>
                  </div>
                  <div className="col-span-2 font-mono text-xs tabular text-muted-foreground">
                    Diário
                  </div>
                  <div className="col-span-2 text-right font-mono tabular">
                    {brl(cm.daily_budget)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "ad_accounts" && (
        <Card>
          <CardHeader title="Contas por plataforma (multi-account)" />
          <div className="space-y-3 p-4">
            <div className="grid gap-2 md:grid-cols-4">
              <select
                value={newAccountProvider}
                onChange={(e) => setNewAccountProvider(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="meta_ads">Meta Ads</option>
                <option value="google_ads">Google Ads</option>
                <option value="google_analytics">Google Analytics</option>
                <option value="tiktok_ads">TikTok Ads</option>
              </select>
              <input
                value={newAccountId}
                onChange={(e) => setNewAccountId(e.target.value)}
                placeholder="ID externo da conta"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              />
              <input
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="Nome da conta (opcional)"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              />
              <button
                type="button"
                onClick={addAccount}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                Vincular conta
              </button>
            </div>
            <div className="rounded-md border border-border">
              {data.adAccounts.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  Nenhuma conta vinculada. Ao sincronizar, a função usa esta
                  conta por cliente quando disponível.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {data.adAccounts.map((acc: any) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">
                          {acc.account_name || acc.account_external_id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {acc.provider} · {acc.account_external_id}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAccount(acc.id)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {tab === "alerts" && (
        <Card>
          {data.alerts.length === 0 ? (
            <Empty label="Sem alertas." />
          ) : (
            <div className="divide-y divide-border">
              {data.alerts.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{a.title}</div>
                    <span className="text-[11px] uppercase text-muted-foreground">
                      {a.priority}
                    </span>
                  </div>
                  {a.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {a.description}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {timeAgo(a.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "reports" && (
        <div className="space-y-3">
          {data.reports.length === 0 && (
            <Card>
              <Empty label="Nenhum relatório IA. Clique em 'Gerar relatório IA'." />
            </Card>
          )}
          {data.reports.map((r) => (
            <Card key={r.id}>
              <CardHeader
                title={`Relatório · ${new Date(r.created_at).toLocaleDateString("pt-BR")}`}
                action={
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        [
                          r.executive_summary,
                          r.positives,
                          r.problems,
                          r.opportunities,
                          r.next_steps,
                        ]
                          .filter(Boolean)
                          .join("\n\n"),
                      )
                    }
                    className="text-xs text-primary hover:underline"
                  >
                    Copiar
                  </button>
                }
              />
              <div className="space-y-3 p-4 text-sm">
                <ReportSection
                  title="Resumo executivo"
                  body={r.executive_summary}
                />
                <ReportSection title="Pontos positivos" body={r.positives} />
                <ReportSection
                  title="Problemas identificados"
                  body={r.problems}
                />
                <ReportSection title="Oportunidades" body={r.opportunities} />
                <ReportSection title="Próximos passos" body={r.next_steps} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "notes" && (
        <Card>
          {data.notes.length === 0 ? (
            <Empty label="Sem notas." />
          ) : (
            <div className="divide-y divide-border">
              {data.notes.map((n) => (
                <div key={n.id} className="px-4 py-3 text-sm">
                  <p>{n.content}</p>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {timeAgo(n.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ReportSection({
  title,
  body,
}: {
  title: string;
  body: string | null;
}) {
  if (!body) return null;
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
        {title}
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
        {body}
      </p>
    </div>
  );
}

export const _u = { num, RefreshCw };
