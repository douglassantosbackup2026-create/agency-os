import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { brl, num, pct, timeAgo } from "@/lib/format";
import {
  DASHBOARD_STALE_MS,
  dashboardQueryKey,
  parseDashboardBundle,
} from "@/lib/dashboard-data";
import { fetchDashboardCore } from "@/lib/dashboard-server";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  Database,
  Heart,
  ListTodo,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { useNavigate } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  auditBulletsFromResult,
  auditOverallStatus,
} from "@/lib/audit-dashboard";
import { ONBOARDING_STEP_KEYS } from "@/lib/onboarding-checklist";
import { buildPortfolioNextSteps, formatEffort } from "@/lib/next-steps-queue";
import { invokeWithToast } from "@/lib/supabase-invoke";
import { throwIfSupabaseError, queryErrorMeta } from "@/lib/supabase-result";
import { QueryErrorState } from "@/components/query-error-state";
import { toast } from "sonner";
import {
  Badge,
  Card,
  CardHeader,
  Empty,
  PageSkeleton,
  PriorityDot,
  RiskDot,
  Row,
  ScoreBar,
  Stat,
} from "@/components/operational-ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  staleTime: DASHBOARD_STALE_MS,
  loader: async ({ context }) => {
    try {
      const result = await fetchDashboardCore();
      if (result?.agencyId && result.core) {
        context.queryClient.setQueryData(
          dashboardQueryKey(result.agencyId),
          result.core,
        );
      }
      return result;
    } catch {
      return null;
    }
  },
});

function DashboardCollapsibleBlock({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="space-y-3">
      <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm font-semibold shadow-sm hover:bg-surface-2">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function Dashboard() {
  const { agency } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: coreData, isLoading, isError, error, refetch } = useQuery({
    queryKey: dashboardQueryKey(agency?.id),
    enabled: !!agency,
    staleTime: DASHBOARD_STALE_MS,
    meta: queryErrorMeta,
    queryFn: async () => {
      const { data: detail, error: detailErr } = await supabase.rpc(
        "get_agency_dashboard_detail",
        { p_agency_id: agency!.id },
      );
      throwIfSupabaseError(detailErr, "get_agency_dashboard_detail");
      return parseDashboardBundle(detail);
    },
  });

  const mergedData = useMemo(() => {
    if (!coreData) return null;
    return {
      ...coreData,
      alerts: coreData.openAlerts,
      activities: coreData.activities,
    };
  }, [coreData]);

  const debouncedInvalidateAlerts = useDebouncedCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: dashboardQueryKey(agency?.id),
    });
    void queryClient.invalidateQueries({ queryKey: ["alerts", agency?.id] });
  }, 3000);

  const debouncedInvalidateActivities = useDebouncedCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: dashboardQueryKey(agency?.id),
    });
  }, 3000);

  const debouncedInvalidateCore = useDebouncedCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: dashboardQueryKey(agency?.id),
    });
  }, 3000);

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
        () => debouncedInvalidateAlerts(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activities",
          filter: `agency_id=eq.${agency.id}`,
        },
        () => debouncedInvalidateActivities(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "metrics_daily",
          filter: `agency_id=eq.${agency.id}`,
        },
        () => debouncedInvalidateCore(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "health_scores",
          filter: `agency_id=eq.${agency.id}`,
        },
        () => debouncedInvalidateCore(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          toast.warning(
            "Atualização em tempo real indisponível. Recarregue a página ou use «Tentar novamente» nos dados.",
            { duration: 6000 },
          );
        }
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [agency, debouncedInvalidateAlerts, debouncedInvalidateActivities, debouncedInvalidateCore]);

  const dashboardDerived = useMemo(() => {
    if (!mergedData) return null;
    const data = mergedData;
    const now = Date.now();
    const metrics30 = data.metrics.filter(
      (m) => new Date(m.date).getTime() >= now - 30 * 86400000,
    );
    const metricsPrev30 = data.metrics.filter((m) => {
      const ts = new Date(m.date).getTime();
      return ts < now - 30 * 86400000 && ts >= now - 60 * 86400000;
    });
    const spend = metrics30.reduce((a, b) => a + Number(b.spend ?? 0), 0);
    const revenue = metrics30.reduce((a, b) => a + Number(b.revenue ?? 0), 0);
    const roas = spend > 0 ? revenue / spend : 0;
    const mrr = data.clients.reduce((a, b) => a + Number(b.mrr ?? 0), 0);
    const prevSpend = metricsPrev30.reduce(
      (a, b) => a + Number(b.spend ?? 0),
      0,
    );
    const prevRevenue = metricsPrev30.reduce(
      (a, b) => a + Number(b.revenue ?? 0),
      0,
    );
    const mrrDeltaPct =
      prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
    const spendDeltaPct =
      prevSpend > 0 ? ((spend - prevSpend) / prevSpend) * 100 : 0;
    const snap = data.opsSnapshot;
    const activeClients =
      snap?.clients_active ??
      data.clients.filter((c) => c.status === "active").length;
    const openAlertsCount =
      snap?.open_alerts_count ?? data.alerts.length;
    const pendingAiJobs = snap?.pending_ai_jobs ?? 0;
    const churnedClients = data.clients.filter(
      (c) => c.status === "churned",
    ).length;
    const renewals30d = data.clients.filter((c) => {
      const d = c.started_at ? new Date(c.started_at).getTime() : 0;
      if (!d) return false;
      const in30 = d + 365 * 86400000;
      return in30 >= now && in30 <= now + 30 * 86400000;
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
    const openAlertsForChip = openAlertsCount;
    const campaignMomentum = computeCampaignMomentum(
      data.campaignMetrics as CampaignMetricRow[],
    );
    const ga4Cur = data.ga4Daily.filter(
      (m: { date: string }) =>
        new Date(m.date).getTime() >= now - 30 * 86400000,
    );
    const ga4Prev = data.ga4Daily.filter((m: { date: string }) => {
      const ts = new Date(m.date).getTime();
      return ts < now - 30 * 86400000 && ts >= now - 60 * 86400000;
    });
    const siteSessions = ga4Cur.reduce(
      (a: number, b: { sessions?: unknown }) => a + Number(b.sessions ?? 0),
      0,
    );
    const siteConv = ga4Cur.reduce(
      (a: number, b: { conversions?: unknown }) =>
        a + Number(b.conversions ?? 0),
      0,
    );
    const siteRevenue = ga4Cur.reduce(
      (a: number, b: { revenue?: unknown }) => a + Number(b.revenue ?? 0),
      0,
    );
    const siteCvr = siteSessions > 0 ? siteConv / siteSessions : 0;
    const prevSiteSessions = ga4Prev.reduce(
      (a: number, b: { sessions?: unknown }) => a + Number(b.sessions ?? 0),
      0,
    );
    const prevSiteConv = ga4Prev.reduce(
      (a: number, b: { conversions?: unknown }) =>
        a + Number(b.conversions ?? 0),
      0,
    );
    const prevSiteCvr =
      prevSiteSessions > 0 ? prevSiteConv / prevSiteSessions : 0;
    const trackingCritical = (data.ga4Tracking ?? []).filter(
      (t: { status?: string }) => t.status === "critical",
    ).length;
    const recommended = [...data.alerts]
      .filter((a) => (a as { recommended_action?: string }).recommended_action)
      .slice(0, 5) as Array<{
      id: string;
      title: string;
      recommended_action: string | null;
    }>;

    const auditLatestByClient = new Map<string, Record<string, unknown>>();
    for (const row of data.campaignAuditsSnap ?? []) {
      const cid = String((row as Record<string, unknown>).client_id ?? "");
      if (cid && !auditLatestByClient.has(cid)) {
        auditLatestByClient.set(cid, row as Record<string, unknown>);
      }
    }
    const clientNameById = (id: string) =>
      data.clients.find((c) => c.id === id)?.name ?? "Cliente";

    const auditAttentionRows = [...auditLatestByClient.values()]
      .map((row) => {
        const rj = row.result_json as Record<string, unknown> | undefined;
        const st = auditOverallStatus(rj);
        return {
          row,
          st,
          bullets: auditBulletsFromResult(
            rj,
            String(row.executive_summary_markdown ?? ""),
          ),
        };
      })
      .filter(
        (x) => x.st === "critical" || x.st === "risk" || x.st === "attention",
      )
      .sort(
        (a, b) =>
          new Date(String(b.row.created_at)).getTime() -
          new Date(String(a.row.created_at)).getTime(),
      );

    const auditShowList =
      auditAttentionRows.length > 0
        ? auditAttentionRows.slice(0, 6)
        : [...auditLatestByClient.values()].slice(0, 4).map((row) => {
            const rj = row.result_json as Record<string, unknown> | undefined;
            return {
              row,
              st: auditOverallStatus(rj),
              bullets: auditBulletsFromResult(
                rj,
                String(row.executive_summary_markdown ?? ""),
              ),
            };
          });

    const briefingBuckets = data.agencyBriefing?.buckets as
      | Record<
          string,
          Array<{ client_id: string; name: string; reason: string }>
        >
      | undefined;
    const criticoBrief =
      briefingBuckets?.critico && briefingBuckets.critico.length > 0
        ? briefingBuckets.critico[0]
        : null;
    const checklistRows = (data.checklistItems ?? []) as Array<{
      client_id: string;
      step_key: string;
      status: string;
    }>;
    let pendingChecklistSteps = 0;
    for (const c of data.clients) {
      for (const stepKey of ONBOARDING_STEP_KEYS) {
        const row = checklistRows.find(
          (i) => i.client_id === c.id && i.step_key === stepKey,
        );
        if (!row || row.status !== "done") pendingChecklistSteps++;
      }
    }
    const alertFirst = data.alerts[0];
    const actionFirst = data.actionCenter[0] as
      | { id: string; title: string }
      | undefined;

    let suggestedNext: {
      title: string;
      description: string;
      to: "/clients/$clientId" | "/alerts" | "/actions" | "/integrations";
      params?: { clientId: string };
      cta: string;
    };
    if (criticoBrief) {
      suggestedNext = {
        title: "Cliente em situação crítica",
        description: `${criticoBrief.name} — ${criticoBrief.reason}`,
        to: "/clients/$clientId",
        params: { clientId: criticoBrief.client_id },
        cta: "Abrir cliente",
      };
    } else if (alertFirst) {
      suggestedNext = {
        title: "Alerta prioritário",
        description: alertFirst.title,
        to: "/alerts",
        cta: "Ver alertas",
      };
    } else if (actionFirst) {
      suggestedNext = {
        title: "Ação pendente na central",
        description: actionFirst.title,
        to: "/actions",
        cta: "Central de Ações",
      };
    } else {
      suggestedNext = {
        title: "Conectar suas fontes de dados",
        description:
          "Integre Meta, Google ou GA4 para liberar briefing automático e alertas.",
        to: "/integrations",
        cta: "Abrir integrações",
      };
    }

    const portfolioNextSteps = buildPortfolioNextSteps({
      actions: data.actionCenter as Parameters<
        typeof buildPortfolioNextSteps
      >[0]["actions"],
      alerts: data.alerts as Parameters<
        typeof buildPortfolioNextSteps
      >[0]["alerts"],
      limit: 6,
    });

    return {
      spend,
      revenue,
      roas,
      mrr,
      mrrDeltaPct,
      spendDeltaPct,
      activeClients,
      churnedClients,
      renewals30d,
      latestHealth,
      atRisk,
      avgHealth,
      criticals,
      campaignMomentum,
      siteSessions,
      siteConv,
      siteRevenue,
      siteCvr,
      prevSiteSessions,
      prevSiteConv,
      prevSiteCvr,
      trackingCritical,
      recommended,
      auditShowList,
      clientNameById,
      suggestedNext,
      pendingChecklistSteps,
      overdueActionsCount: data.overdueActionsCount,
      portfolioNextSteps,
      openAlertsForChip,
      pendingAiJobs,
    };
  }, [mergedData]);

  const refreshOperationalBriefing = useCallback(async () => {
    if (!agency?.id) return;
    const res = await invokeWithToast(supabase, "compute-health-scores", {
      loading: "Atualizando visão operacional…",
      success: "Visão atualizada. Os números podem levar alguns segundos.",
      body: { agency_id: agency.id },
    });
    if (res.ok) refetch();
  }, [agency?.id, refetch]);

  const runSeedDemo = useCallback(async () => {
    const res = await invokeWithToast(supabase, "seed-demo-data", {
      loading: "Gerando dados...",
      success: "Dados criados.",
    });
    if (res.ok) refetch();
  }, [refetch]);

  if (isError) {
    return (
      <QueryErrorState
        message={
          error instanceof Error ? error.message : String(error ?? "Erro")
        }
        onRetry={() => void refetch()}
      />
    );
  }

  if (isLoading || !mergedData || !dashboardDerived) {
    return <PageSkeleton />;
  }
  const data = mergedData!;

  const {
    spend,
    revenue,
    roas,
    mrr,
    mrrDeltaPct,
    spendDeltaPct,
    activeClients,
    churnedClients,
    renewals30d,
    latestHealth,
    atRisk,
    avgHealth,
    criticals,
    campaignMomentum,
    siteSessions,
    siteConv,
    siteRevenue,
    siteCvr,
    prevSiteSessions,
    prevSiteConv,
    prevSiteCvr,
    trackingCritical,
    recommended,
    auditShowList,
    clientNameById,
    suggestedNext,
    pendingChecklistSteps,
    overdueActionsCount,
    portfolioNextSteps,
    openAlertsForChip,
    pendingAiJobs,
  } = dashboardDerived;

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
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button type="button" className="h-11 gap-2" onClick={runSeedDemo}>
              <Database className="h-4 w-4" /> Gerar dados demo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() =>
                navigate({ to: "/clients", search: { new: undefined } })
              }
            >
              Criar cliente manualmente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Hoje
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Próximo passo operacional; métricas nos blocos abaixo usam últimos
            30 dias.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/standup">Stand-up</Link>
          </Button>
          <span className="text-xs text-muted-foreground">Últimos 30 dias</span>
        </div>
      </header>

      <Card className="border-primary/25 bg-primary/[0.06] shadow-sm">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Prioridade agora
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight">
              {suggestedNext.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {suggestedNext.description}
            </p>
          </div>
          <Button asChild size="lg" className="h-12 w-full shrink-0 md:w-auto">
            <Link
              to={suggestedNext.to}
              {...(suggestedNext.params
                ? { params: suggestedNext.params }
                : {})}
            >
              {suggestedNext.cta}
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2 border-t border-primary/15 px-5 pb-5 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/alerts"
            search={{ priority: undefined }}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/70 px-3 py-2.5 text-sm shadow-sm transition hover:border-primary/35 hover:bg-background"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">
                Urgentes (alto/crítico)
              </span>
            </span>
            <span className="tabular-nums font-semibold text-foreground">
              {criticals}
            </span>
          </Link>
          <Link
            to="/alerts"
            search={{ priority: undefined }}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/70 px-3 py-2.5 text-sm shadow-sm transition hover:border-primary/35 hover:bg-background"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">Alertas abertos</span>
            </span>
            <span className="tabular-nums font-semibold text-foreground">
              {openAlertsForChip}
            </span>
          </Link>
          {pendingAiJobs > 0 ? (
            <Link
              to="/reports"
              className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/70 px-3 py-2.5 text-sm shadow-sm transition hover:border-primary/35 hover:bg-background"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">Relatórios IA na fila</span>
              </span>
              <span className="tabular-nums font-semibold text-foreground">
                {pendingAiJobs}
              </span>
            </Link>
          ) : null}
          <Link
            to="/actions"
            search={{ sla: "overdue" }}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/70 px-3 py-2.5 text-sm shadow-sm transition hover:border-primary/35 hover:bg-background"
          >
            <span className="flex min-w-0 items-center gap-2">
              <ListTodo className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">Ações atrasadas</span>
            </span>
            <span className="tabular-nums font-semibold text-foreground">
              {overdueActionsCount}
            </span>
          </Link>
          <Link
            to="/onboarding"
            className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/70 px-3 py-2.5 text-sm shadow-sm transition hover:border-primary/35 hover:bg-background"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">Checklist pendente</span>
            </span>
            <span className="tabular-nums font-semibold text-foreground">
              {pendingChecklistSteps}
            </span>
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="Carteira — próximos passos" />
        <div className="px-4 pb-4">
          {portfolioNextSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nada urgente na fila heurística — rever clientes ou gerar
              relatórios.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {portfolioNextSteps.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-snug">
                      {row.title}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {row.clientName} ·{" "}
                      {row.kind === "action" ? "Ação" : "Alerta"} ·{" "}
                      {formatEffort(row.effortMinutes)}{" "}
                      <span className="italic">(estimativa)</span>
                    </div>
                    {row.subtitle ? (
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {row.subtitle}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    asChild
                  >
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId: row.clientId }}
                    >
                      Abrir cliente
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={Wallet}
          label="Receita 30d"
          value={brl(revenue)}
          accent="text-success"
          sub={`${mrrDeltaPct >= 0 ? "+" : ""}${mrrDeltaPct.toFixed(1)}% vs período anterior`}
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
          sub={`${spendDeltaPct >= 0 ? "+" : ""}${spendDeltaPct.toFixed(1)}% vs período anterior`}
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
      </div>

      <Tabs defaultValue="operacao" className="w-full space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="operacao">Operação</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="operacao" className="mt-4 space-y-4 outline-none">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Briefing da manhã" />
              <div className="space-y-3 p-4 text-sm">
                {!data.agencyBriefing?.buckets ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Ainda não há briefing categorizado. Atualize a visão
                      operacional para gerar os buckets automáticos (clientes em
                      crítico, atenção, etc.).
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={refreshOperationalBriefing}
                    >
                      Atualizar briefing agora
                    </Button>
                  </div>
                ) : (
                  (
                    [
                      "critico",
                      "sem_atualizacao",
                      "atencao",
                      "oportunidade",
                    ] as const
                  ).map((key) => {
                    const label =
                      key === "critico"
                        ? "Crítico"
                        : key === "sem_atualizacao"
                          ? "Sem atualização"
                          : key === "atencao"
                            ? "Atenção"
                            : "Oportunidade";
                    const items = ((
                      data.agencyBriefing!.buckets as Record<string, unknown[]>
                    )[key] ?? []) as Array<{
                      client_id: string;
                      name: string;
                      reason: string;
                    }>;
                    return (
                      <div key={key}>
                        <div className="mb-1 font-medium text-foreground">
                          {label}
                        </div>
                        {items.length === 0 ? (
                          <div className="text-muted-foreground">—</div>
                        ) : (
                          <ul className="space-y-1">
                            {items.slice(0, 4).map((it) => (
                              <li key={it.client_id}>
                                <Link
                                  to="/clients/$clientId"
                                  params={{ clientId: it.client_id }}
                                  className="font-medium text-primary hover:underline"
                                >
                                  {it.name}
                                </Link>
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {it.reason}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })
                )}
                <Link
                  to="/actions"
                  search={{ sla: undefined }}
                  className="inline-block pt-1 text-sm font-medium text-primary hover:underline"
                >
                  Abrir Central de Ações
                </Link>
              </div>
            </Card>
            <DashboardCollapsibleBlock title="Central de Revisão IA">
              <Card>
                <CardHeader title="Central de Revisão IA" />
                <div className="divide-y divide-border">
                  {(data.reportsReview ?? []).length === 0 ? (
                    <Empty
                      label="Sem itens pendentes de revisão humana."
                      action={
                        <Button asChild variant="outline" size="sm">
                          <Link to="/ai-review">Abrir fila de revisão</Link>
                        </Button>
                      }
                    />
                  ) : (
                    (data.reportsReview ?? []).map((r) => (
                      <Link
                        key={r.id}
                        to="/ai-review"
                        className="block px-4 py-3 text-sm hover:bg-surface-2"
                      >
                        <div className="font-medium">
                          {(r.clients as { name?: string } | null | undefined)
                            ?.name ?? "Cliente"}{" "}
                          · confiança {r.confianca ?? "média"}
                        </div>
                        <div className="text-muted-foreground">
                          {timeAgo(r.created_at)} · revisão obrigatória
                        </div>
                      </Link>
                    ))
                  )}
                  <Link
                    to="/ai-review"
                    className="block px-4 py-2 text-sm font-medium text-primary hover:bg-surface-2"
                  >
                    Ver fila completa
                  </Link>
                </div>
              </Card>
            </DashboardCollapsibleBlock>
          </div>

          <DashboardCollapsibleBlock title="Auditoria de campanhas (IA)">
            <Card>
              <CardHeader
                title="Auditoria de campanhas (IA)"
                action={
                  <Link
                    to="/clients"
                    search={{ new: undefined }}
                    className="text-sm text-primary hover:underline"
                  >
                    Ver clientes
                  </Link>
                }
              />
              <div className="space-y-3 p-4 pt-0 text-sm">
                {auditShowList.length === 0 ? (
                  <p className="text-muted-foreground">
                    Ainda não há auditorias. Abra um cliente e use a aba
                    &quot;Auditoria IA&quot;.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {auditShowList.map(({ row, st, bullets }) => {
                      const cid = String(row.client_id ?? "");
                      return (
                        <li
                          key={String(row.id)}
                          className="rounded-lg border border-border bg-surface/80 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <Link
                              to="/clients/$clientId"
                              params={{ clientId: cid }}
                              className="font-medium text-primary hover:underline"
                            >
                              {clientNameById(cid)}
                            </Link>
                            {st ? (
                              <span className="rounded bg-muted px-1.5 py-1 text-xs uppercase text-muted-foreground">
                                {st}
                              </span>
                            ) : null}
                            <span className="text-xs text-muted-foreground">
                              {timeAgo(String(row.created_at))}
                            </span>
                          </div>
                          {bullets.length > 0 ? (
                            <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                              {bullets.map((b, i) => (
                                <li key={i}>{b}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Ver detalhes na ficha do cliente → Auditoria IA.
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          </DashboardCollapsibleBlock>

          <DashboardCollapsibleBlock title="Alertas prioritários">
            <Card>
              <CardHeader
                title="Alertas prioritários"
                action={
                  <Link
                    to="/alerts"
                    search={{ priority: undefined }}
                    className="text-sm text-primary hover:underline"
                  >
                    Ver todos
                  </Link>
                }
              />
              <div className="divide-y divide-border">
                {data.alerts.length === 0 && (
                  <Empty
                    label="Nenhum alerta aberto."
                    action={
                      <Button asChild variant="outline" size="sm">
                        <Link to="/integrations">Ver integrações</Link>
                      </Button>
                    }
                  />
                )}
                {data.alerts.map((a) => (
                  <Link
                    key={a.id}
                    to="/alerts"
                    search={{ priority: undefined }}
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
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {timeAgo(a.created_at)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          </DashboardCollapsibleBlock>

          <DashboardCollapsibleBlock title="Ações recomendadas a partir de alertas">
            <Card>
              <CardHeader title="Ações recomendadas" />
              <div className="divide-y divide-border">
                {recommended.length === 0 ? (
                  <Empty
                    label="Nenhuma ação sugerida nos alertas abertos."
                    action={
                      <Button asChild variant="outline" size="sm">
                        <Link to="/alerts" search={{ priority: undefined }}>
                          Abrir Central de alertas
                        </Link>
                      </Button>
                    }
                  />
                ) : (
                  recommended.map((a) => (
                    <div key={a.id} className="flex gap-2 px-4 py-3">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                      <div className="min-w-0 text-sm">
                        <div className="font-medium">{a.title}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {a.recommended_action}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </DashboardCollapsibleBlock>
        </TabsContent>

        <TabsContent
          value="performance"
          className="mt-4 space-y-4 outline-none"
        >
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
              accent={
                criticals > 0 ? "text-destructive" : "text-muted-foreground"
              }
              sub={`${data.alerts.length} abertos`}
            />
            <Stat
              icon={ArrowDownRight}
              label="Churn clientes"
              value={String(churnedClients)}
              accent={
                churnedClients > 0
                  ? "text-destructive"
                  : "text-muted-foreground"
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
              accent={
                trackingCritical > 0 ? "text-destructive" : "text-success"
              }
            />
          </div>

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

          <Card>
            <CardHeader title="Campanhas — momentum (14d)" />
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <ArrowDownRight className="h-3 w-3 text-destructive" /> Em
                  queda (ROAS)
                </div>
                {campaignMomentum.falling.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sem campanhas com queda relevante no período.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {campaignMomentum.falling.map((c) => (
                      <li key={c.id} className="text-sm">
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
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />{" "}
                  Escalando
                </div>
                {campaignMomentum.rising.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sem campanhas acelerando no período.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {campaignMomentum.rising.map((c) => (
                      <li key={c.id} className="text-sm">
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
        </TabsContent>

        <TabsContent value="clientes" className="mt-4 space-y-4 outline-none">
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
                  <Empty
                    label="Sem atividade recente."
                    action={
                      <Button asChild variant="outline" size="sm">
                        <Link to="/clients" search={{ new: undefined }}>
                          Abrir clientes
                        </Link>
                      </Button>
                    }
                  />
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
                    <div className="text-xs text-muted-foreground">
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
                        <div className="truncate text-sm font-medium">
                          {c.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
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
        </TabsContent>
      </Tabs>
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
