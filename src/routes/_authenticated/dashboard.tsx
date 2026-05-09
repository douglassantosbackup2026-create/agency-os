import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { brl, num, pct, timeAgo } from "@/lib/format";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Database,
  Heart,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { agency } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000)
        .toISOString()
        .slice(0, 10);
      const since60 = new Date(Date.now() - 60 * 86400000)
        .toISOString()
        .slice(0, 10);
      const since14 = new Date(Date.now() - 14 * 86400000)
        .toISOString()
        .slice(0, 10);
      const [
        clients,
        metrics,
        alerts,
        activities,
        health,
        campaignMetrics,
        ga4Daily,
        ga4Tracking,
        actionCenter,
        reportsReview,
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, status, mrr, monthly_budget")
          .eq("agency_id", agency!.id),
        supabase
          .from("metrics_daily")
          .select("date, spend, revenue, roas")
          .eq("agency_id", agency!.id)
          .is("campaign_id", null)
          .gte("date", since60),
        supabase
          .from("alerts")
          .select("id, title, priority, created_at, type, recommended_action")
          .eq("agency_id", agency!.id)
          .eq("status", "open")
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("activities")
          .select("id, title, description, created_at, type")
          .eq("agency_id", agency!.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("health_scores")
          .select("client_id, score, risk, recorded_at")
          .eq("agency_id", agency!.id)
          .order("recorded_at", { ascending: false }),
        supabase
          .from("metrics_daily")
          .select("campaign_id, date, roas, campaigns(name)")
          .eq("agency_id", agency!.id)
          .gte("date", since14)
          .not("campaign_id", "is", null),
        (supabase as any)
          .from("ga4_daily")
          .select(
            "date, sessions, conversions, revenue, conversion_rate, avg_ticket",
          )
          .eq("agency_id", agency!.id)
          .gte("date", since60),
        (supabase as any)
          .from("ga4_tracking_health_daily")
          .select("status")
          .eq("agency_id", agency!.id)
          .gte("date", since14),
        (supabase as any)
          .from("action_center")
          .select("id, title, priority, due_date, status, clients(name)")
          .eq("agency_id", agency!.id)
          .in("status", ["pendente", "revisar_depois"])
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("reports")
          .select(
            "id, created_at, confianca, requer_revisao_humana, clients(name)",
          )
          .eq("agency_id", agency!.id)
          .eq("requer_revisao_humana", true)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      return {
        clients: clients.data ?? [],
        metrics: metrics.data ?? [],
        alerts: alerts.data ?? [],
        activities: activities.data ?? [],
        health: health.data ?? [],
        campaignMetrics: campaignMetrics.data ?? [],
        ga4Daily: ga4Daily.data ?? [],
        ga4Tracking: ga4Tracking.data ?? [],
        actionCenter: actionCenter.data ?? [],
        reportsReview: reportsReview.data ?? [],
      };
    },
  });

  // realtime feed
  useEffect(() => {
    if (!agency) return;
    const ch = supabase
      .channel(`dash:${agency.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alerts",
          filter: `agency_id=eq.${agency.id}`,
        },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activities",
          filter: `agency_id=eq.${agency.id}`,
        },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [agency, refetch]);

  if (isLoading || !data) return <PageSkeleton />;

  const metrics30 = data.metrics.filter(
    (m) => new Date(m.date).getTime() >= Date.now() - 30 * 86400000,
  );
  const metricsPrev30 = data.metrics.filter((m) => {
    const ts = new Date(m.date).getTime();
    return ts < Date.now() - 30 * 86400000 && ts >= Date.now() - 60 * 86400000;
  });
  const spend = metrics30.reduce((a, b) => a + Number(b.spend ?? 0), 0);
  const revenue = metrics30.reduce((a, b) => a + Number(b.revenue ?? 0), 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const mrr = data.clients.reduce((a, b) => a + Number(b.mrr ?? 0), 0);
  const prevSpend = metricsPrev30.reduce((a, b) => a + Number(b.spend ?? 0), 0);
  const prevRevenue = metricsPrev30.reduce(
    (a, b) => a + Number(b.revenue ?? 0),
    0,
  );
  const mrrDeltaPct =
    prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
  const spendDeltaPct =
    prevSpend > 0 ? ((spend - prevSpend) / prevSpend) * 100 : 0;
  const activeClients = data.clients.filter(
    (c) => c.status === "active",
  ).length;
  const churnedClients = data.clients.filter(
    (c) => c.status === "churned",
  ).length;
  const renewals30d = data.clients.filter((c) => {
    const d = c.started_at ? new Date(c.started_at).getTime() : 0;
    if (!d) return false;
    const in30 = d + 365 * 86400000;
    return in30 >= Date.now() && in30 <= Date.now() + 30 * 86400000;
  }).length;
  const latestHealth = new Map<string, { score: number; risk: string }>();
  for (const h of data.health)
    if (!latestHealth.has(h.client_id)) latestHealth.set(h.client_id, h);
  const atRisk = [...latestHealth.values()].filter(
    (h) => h.risk !== "low",
  ).length;
  const avgHealth = latestHealth.size
    ? [...latestHealth.values()].reduce((a, b) => a + b.score, 0) /
      latestHealth.size
    : 0;
  const criticals = data.alerts.filter(
    (a) => a.priority === "critical" || a.priority === "high",
  ).length;
  const campaignMomentum = computeCampaignMomentum(
    data.campaignMetrics as CampaignMetricRow[],
  );
  const ga4Cur = data.ga4Daily.filter(
    (m: any) => new Date(m.date).getTime() >= Date.now() - 30 * 86400000,
  );
  const ga4Prev = data.ga4Daily.filter((m: any) => {
    const ts = new Date(m.date).getTime();
    return ts < Date.now() - 30 * 86400000 && ts >= Date.now() - 60 * 86400000;
  });
  const siteSessions = ga4Cur.reduce(
    (a: number, b: any) => a + Number(b.sessions ?? 0),
    0,
  );
  const siteConv = ga4Cur.reduce(
    (a: number, b: any) => a + Number(b.conversions ?? 0),
    0,
  );
  const siteRevenue = ga4Cur.reduce(
    (a: number, b: any) => a + Number(b.revenue ?? 0),
    0,
  );
  const siteCvr = siteSessions > 0 ? siteConv / siteSessions : 0;
  const prevSiteSessions = ga4Prev.reduce(
    (a: number, b: any) => a + Number(b.sessions ?? 0),
    0,
  );
  const prevSiteConv = ga4Prev.reduce(
    (a: number, b: any) => a + Number(b.conversions ?? 0),
    0,
  );
  const prevSiteCvr =
    prevSiteSessions > 0 ? prevSiteConv / prevSiteSessions : 0;
  const trackingCritical = (data.ga4Tracking ?? []).filter(
    (t: any) => t.status === "critical",
  ).length;
  const recommended = [...data.alerts]
    .filter((a) => (a as { recommended_action?: string }).recommended_action)
    .slice(0, 5) as Array<{
    id: string;
    title: string;
    recommended_action: string | null;
  }>;
  const briefing = (data.actionCenter ?? []) as Array<{
    id: string;
    title: string;
    priority: string;
    due_date: string | null;
    clients?: { name?: string };
  }>;

  // empty state
  if (data.clients.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <div className="surface-card mx-auto rounded-2xl border border-border p-10">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Bem-vindo ao Retentio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Comece gerando dados de exemplo para explorar o sistema, ou crie seu
            primeiro cliente.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={async () => {
                const tid = toast.loading("Gerando dados...");
                const { error } =
                  await supabase.functions.invoke("seed-demo-data");
                toast.dismiss(tid);
                if (error) toast.error(error.message);
                else {
                  toast.success("Dados criados.");
                  refetch();
                }
              }}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
            >
              <Database className="h-4 w-4" /> Gerar dados demo
            </button>
            <button
              onClick={() => navigate({ to: "/clients" })}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface transition"
            >
              Criar cliente manualmente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Tudo que importa hoje, em tempo real.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">Últimos 30 dias</div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Morning Briefing" />
          <div className="divide-y divide-border">
            {briefing.length === 0 ? (
              <Empty label="Sem ações críticas para hoje." />
            ) : (
              briefing.slice(0, 4).map((b) => (
                <div key={b.id} className="px-4 py-3 text-xs">
                  <div className="font-medium">{b.title}</div>
                  <div className="text-muted-foreground">
                    {b.clients?.name ?? "Sem cliente"} · prioridade {b.priority}
                    {b.due_date ? ` · prazo ${b.due_date}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Central de Revisão IA" />
          <div className="divide-y divide-border">
            {(data.reportsReview ?? []).length === 0 ? (
              <Empty label="Sem itens pendentes de revisão humana." />
            ) : (
              (data.reportsReview ?? []).map((r: any) => (
                <Link
                  key={r.id}
                  to="/reports"
                  className="block px-4 py-3 text-xs hover:bg-surface-2"
                >
                  <div className="font-medium">
                    {(r.clients as any)?.name ?? "Cliente"} · confiança{" "}
                    {r.confianca ?? "média"}
                  </div>
                  <div className="text-muted-foreground">
                    {timeAgo(r.created_at)} · revisão obrigatória
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat
          icon={Wallet}
          label="Receita 30d"
          value={brl(revenue)}
          accent="text-success"
          sub={`${mrrDeltaPct >= 0 ? "+" : ""}${mrrDeltaPct.toFixed(1)}% vs 30d ant.`}
        />
        <Stat
          icon={TrendingUp}
          label="ROAS médio"
          value={`${roas.toFixed(2)}x`}
          accent={roas >= 2 ? "text-success" : "text-warning"}
        />
        <Stat
          icon={Zap}
          label="Spend 30d"
          value={brl(spend)}
          sub={`${spendDeltaPct >= 0 ? "+" : ""}${spendDeltaPct.toFixed(1)}% vs 30d ant.`}
        />
        <Stat
          icon={Users}
          label="Clientes ativos"
          value={String(activeClients)}
          sub={`${data.clients.length} no total`}
        />
        <Stat
          icon={Heart}
          label="Health médio"
          value={`${avgHealth.toFixed(0)}`}
          accent={
            avgHealth >= 75
              ? "text-success"
              : avgHealth >= 50
                ? "text-warning"
                : "text-destructive"
          }
          sub={`${atRisk} em risco`}
        />
        <Stat
          icon={Bell}
          label="Alertas críticos"
          value={String(criticals)}
          accent={criticals > 0 ? "text-destructive" : "text-muted-foreground"}
          sub={`${data.alerts.length} abertos`}
        />
        <Stat
          icon={ArrowDownRight}
          label="Churn clientes"
          value={String(churnedClients)}
          accent={
            churnedClients > 0 ? "text-destructive" : "text-muted-foreground"
          }
          sub="status churned"
        />
        <Stat
          icon={Activity}
          label="Renovações 30d"
          value={String(renewals30d)}
          sub={`MRR atual ${brl(mrr)}`}
        />
        <Stat
          icon={Users}
          label="Sessões site 30d"
          value={String(Math.round(siteSessions))}
          sub={`Receita GA4 ${brl(siteRevenue)}`}
        />
        <Stat
          icon={Target}
          label="CVR site 30d"
          value={pct(siteCvr * 100)}
          sub={`30d ant. ${pct(prevSiteCvr * 100)}`}
          accent={siteCvr >= prevSiteCvr ? "text-success" : "text-warning"}
        />
        <Stat
          icon={AlertTriangle}
          label="Tracking GA4"
          value={trackingCritical > 0 ? "Crítico" : "OK"}
          sub={`${trackingCritical} críticos (14d)`}
          accent={trackingCritical > 0 ? "text-destructive" : "text-success"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Alertas prioritários"
            action={
              <Link
                to="/alerts"
                className="text-xs text-primary hover:underline"
              >
                Ver todos
              </Link>
            }
          />
          <div className="divide-y divide-border">
            {data.alerts.length === 0 && (
              <Empty label="Nenhum alerta aberto. 🎉" />
            )}
            {data.alerts.map((a) => (
              <Link
                key={a.id}
                to="/alerts"
                className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2 transition"
              >
                <PriorityDot p={a.priority} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {a.title}
                    </span>
                    <Badge>{a.type}</Badge>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {timeAgo(a.created_at)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Resumo financeiro" />
          <div className="space-y-4 p-4">
            <Row label="MRR consolidado" value={brl(mrr)} />
            <Row label="Receita gerada (30d)" value={brl(revenue)} />
            <Row label="Investimento (30d)" value={brl(spend)} />
            <Row label="Margem (R / S)" value={`${roas.toFixed(2)}x`} />
            <Row
              label="Clientes em risco"
              value={`${atRisk}`}
              accent={atRisk > 0 ? "text-warning" : "text-success"}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Campanhas — momentum (14d)" />
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <ArrowDownRight className="h-3 w-3 text-destructive" /> Em queda
                (ROAS)
              </div>
              {campaignMomentum.falling.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sem campanhas com queda relevante no período.
                </p>
              ) : (
                <ul className="space-y-2">
                  {campaignMomentum.falling.map((c) => (
                    <li key={c.id} className="text-xs">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · Δ {c.delta >= 0 ? "+" : ""}
                        {num(c.delta, 2)} ROAS
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <ArrowUpRight className="h-3 w-3 text-emerald-500" /> Escalando
              </div>
              {campaignMomentum.rising.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sem campanhas acelerando no período.
                </p>
              ) : (
                <ul className="space-y-2">
                  {campaignMomentum.rising.map((c) => (
                    <li key={c.id} className="text-xs">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · Δ +{num(c.delta, 2)} ROAS
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Ações recomendadas" />
          <div className="divide-y divide-border">
            {recommended.length === 0 ? (
              <Empty label="Nenhuma ação sugerida nos alertas abertos." />
            ) : (
              recommended.map((a) => (
                <div key={a.id} className="flex gap-2 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <div className="min-w-0 text-xs">
                    <div className="font-medium">{a.title}</div>
                    <div className="mt-0.5 text-muted-foreground">
                      {a.recommended_action}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Feed operacional"
            action={
              <Link
                to="/activity"
                className="text-xs text-primary hover:underline"
              >
                Histórico
              </Link>
            }
          />
          <div className="divide-y divide-border">
            {data.activities.length === 0 && (
              <Empty label="Sem atividade recente." />
            )}
            {data.activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <Activity className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{a.title}</div>
                  {a.description && (
                    <div className="text-xs text-muted-foreground">
                      {a.description}
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {timeAgo(a.created_at)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Clientes por health"
            action={
              <Link
                to="/health"
                className="text-xs text-primary hover:underline"
              >
                Ver tudo
              </Link>
            }
          />
          <div className="divide-y divide-border">
            {data.clients.slice(0, 8).map((c) => {
              const h = latestHealth.get(c.id);
              const score = h?.score ?? 0;
              const risk = h?.risk ?? "low";
              return (
                <Link
                  key={c.id}
                  to="/clients/$clientId"
                  params={{ clientId: c.id }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition"
                >
                  <RiskDot risk={risk} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {brl(c.mrr)} MRR
                    </div>
                  </div>
                  <div className="font-mono text-sm tabular">{score}</div>
                  <ScoreBar score={score} />
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="surface-card rounded-xl border border-border p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div
        className={`mt-2 font-mono text-xl font-semibold tabular ${accent ?? ""}`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`surface-card rounded-xl border border-border ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {action}
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return (
    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium tabular ${accent ?? ""}`}>
        {value}
      </span>
    </div>
  );
}

export function PriorityDot({ p }: { p: string }) {
  const map: Record<string, string> = {
    critical: "bg-destructive",
    high: "bg-warning",
    medium: "bg-info",
    low: "bg-muted-foreground",
  };
  return (
    <div
      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${map[p] ?? "bg-muted-foreground"}`}
    />
  );
}

export function RiskDot({ risk }: { risk: string }) {
  const map: Record<string, string> = {
    low: "bg-success",
    medium: "bg-warning",
    high: "bg-destructive",
  };
  return (
    <div
      className={`h-2 w-2 shrink-0 rounded-full ${map[risk] ?? "bg-muted-foreground"}`}
    />
  );
}

export function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-2">
      <div
        className={`h-full ${color}`}
        style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
      />
    </div>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

export function PageSkeleton(props?: {
  preset?: "dashboard" | "compact" | "split";
}) {
  const preset = props?.preset ?? "dashboard";
  if (preset === "compact") {
    return (
      <div className="space-y-4 p-6">
        <div className="space-y-2">
          <Shimmer className="h-7 w-48" />
          <Shimmer className="h-3 w-72" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Shimmer
              key={i}
              className="h-36 rounded-xl"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (preset === "split") {
    return (
      <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[360px_1fr]">
        <div className="space-y-3 border-r border-border p-4">
          <Shimmer className="h-9 w-full rounded-md" />
          <Shimmer className="h-20 w-full rounded-lg" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Shimmer key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
        <div className="space-y-4 p-6">
          <Shimmer className="h-9 w-2/3 max-w-md" />
          <Shimmer className="min-h-[280px] w-full rounded-xl" />
          <Shimmer className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <Shimmer className="h-7 w-48" />
        <Shimmer className="h-3 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer
            key={i}
            className="h-20 rounded-xl"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Shimmer
          className="h-80 rounded-xl lg:col-span-2"
          style={{ animationDelay: "120ms" }}
        />
        <Shimmer
          className="h-80 rounded-xl"
          style={{ animationDelay: "180ms" }}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Shimmer
          className="h-48 rounded-xl"
          style={{ animationDelay: "240ms" }}
        />
        <Shimmer
          className="h-48 rounded-xl"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}

export function Shimmer({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-surface ${className}`}
      style={style}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-foreground/[0.04] to-transparent" />
    </div>
  );
}

type CampaignMetricRow = {
  campaign_id: string | null;
  date: string;
  roas: number | null;
  campaigns: { name: string } | null;
};

function computeCampaignMomentum(rows: CampaignMetricRow[]) {
  const byCamp = new Map<
    string,
    { name: string; pts: { date: string; roas: number }[] }
  >();
  for (const r of rows) {
    if (!r.campaign_id || !r.campaigns?.name) continue;
    const cur = byCamp.get(r.campaign_id) ?? {
      name: r.campaigns.name,
      pts: [],
    };
    cur.pts.push({ date: r.date, roas: Number(r.roas ?? 0) });
    byCamp.set(r.campaign_id, cur);
  }
  const deltas: { id: string; name: string; delta: number }[] = [];
  for (const [id, { name, pts }] of byCamp) {
    const sorted = [...pts].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 4) continue;
    const mid = Math.floor(sorted.length / 2);
    const prior = sorted.slice(0, mid);
    const recent = sorted.slice(mid);
    const avg = (arr: typeof prior) =>
      arr.reduce((a, b) => a + b.roas, 0) / Math.max(1, arr.length);
    const pr = avg(prior);
    const rc = avg(recent);
    deltas.push({ id, name, delta: rc - pr });
  }
  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return {
    falling: deltas.filter((d) => d.delta < -0.05).slice(0, 5),
    rising: deltas.filter((d) => d.delta > 0.05).slice(0, 5),
  };
}
