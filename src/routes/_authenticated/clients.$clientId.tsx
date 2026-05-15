import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, num, pct, timeAgo } from "@/lib/format";
import { syncLabelForCockpit } from "@/lib/sync-freshness";
import {
  buildNextStepsQueue,
  formatEffort,
  type NextStepItem,
} from "@/lib/next-steps-queue";
import {
  MESSAGE_SCENARIO_TEMPLATES,
  applyMessageTemplate,
  type TemplatePlaceholders,
} from "@/lib/message-templates";
import { linearWeeklyBudgetIfPauseFraction } from "@/lib/light-budget-simulation";
import {
  buildDraftClientMessageFromRecommendations,
  overallStatusLabel,
  recommendationCampaignKeys,
} from "@/lib/audit-client-message";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  getJsonNestedRecord,
  jsonDisplay,
} from "@/lib/supabase-json";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  RefreshCw,
  Activity as ActivityIcon,
  ClipboardCopy,
  MessageSquare,
  Clock,
  Bell,
  ListTodo,
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
} from "@/components/operational-ui";
import { toast } from "sonner";
import { throwIfSupabaseError } from "@/lib/supabase-result";
import { QueryErrorState } from "@/components/query-error-state";
import { isOpenActionCenterStatus } from "@/lib/action-center-status";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  component: ClientDetail,
});

type PlatformAccountRow =
  Database["public"]["Tables"]["client_platform_accounts"]["Row"];

type IntegrationProvider = Database["public"]["Enums"]["integration_provider"];

const ACCOUNT_UI_PROVIDERS: readonly IntegrationProvider[] = [
  "meta_ads",
  "google_ads",
  "google_analytics",
  "tiktok_ads",
];

function integrationProviderFromUi(value: string): IntegrationProvider {
  if ((ACCOUNT_UI_PROVIDERS as readonly string[]).includes(value)) {
    return value as IntegrationProvider;
  }
  return "meta_ads";
}

type ClientTab =
  | "overview"
  | "metrics"
  | "health_timeline"
  | "insights"
  | "ad_accounts"
  | "campaigns"
  | "campaign_audit"
  | "alerts"
  | "reports"
  | "notes"
  | "tasks"
  | "activity";

type ClientSection = "resumo" | "dados" | "campanhas" | "gestao";

const SECTION_TABS: Record<ClientSection, ClientTab[]> = {
  resumo: ["overview"],
  dados: ["metrics", "health_timeline", "insights"],
  campanhas: ["ad_accounts", "campaigns", "campaign_audit"],
  gestao: ["alerts", "reports", "notes", "tasks", "activity"],
};

function sectionForTab(t: ClientTab): ClientSection {
  if (t === "overview") return "resumo";
  if (t === "metrics" || t === "health_timeline" || t === "insights")
    return "dados";
  if (t === "ad_accounts" || t === "campaigns" || t === "campaign_audit")
    return "campanhas";
  return "gestao";
}

function tabLabel(t: ClientTab): string {
  const m: Record<ClientTab, string> = {
    overview: "Visão geral",
    metrics: "Métricas",
    health_timeline: "Health",
    insights: "Insights IA",
    ad_accounts: "Contas Ads",
    campaigns: "Campanhas",
    campaign_audit: "Auditoria IA",
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
  const [auditingCampaigns, setAuditingCampaigns] = useState(false);
  const [clickContext, setClickContext] = useState<
    "reuniao" | "pos_ajuste" | "suspeita_problema" | "checkin_rotina"
  >("checkin_rotina");
  const [auditCompareLeft, setAuditCompareLeft] = useState("");
  const [auditCompareRight, setAuditCompareRight] = useState("");
  const [clientMsgOpen, setClientMsgOpen] = useState(false);
  const [clientMsgBody, setClientMsgBody] = useState("");
  const [tplOpen, setTplOpen] = useState(false);
  const [tplScenarioId, setTplScenarioId] = useState(
    MESSAGE_SCENARIO_TEMPLATES[0]?.id ?? "checkin",
  );
  const [tplDraft, setTplDraft] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const clientSnap = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      throwIfSupabaseError(clientSnap.error, "clients");
      const agencyId = clientSnap.data?.agency_id ?? "";

      const [
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
        actions,
        campaignAudits,
        auditRecoStatuses,
        syncRun,
        integrationsCount,
      ] = await Promise.all([
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
          .limit(25),
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
        supabase
          .from("client_platform_accounts")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("meeting_reports")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("ga4_daily")
          .select("*")
          .eq("client_id", clientId)
          .order("date", { ascending: false })
          .limit(60),
        supabase
          .from("ga4_funnel_daily")
          .select("*")
          .eq("client_id", clientId)
          .order("date", { ascending: false })
          .limit(30),
        supabase
          .from("ga4_channel_daily")
          .select("*")
          .eq("client_id", clientId)
          .order("date", { ascending: false })
          .limit(60),
        supabase
          .from("ga4_tracking_health_daily")
          .select("*")
          .eq("client_id", clientId)
          .order("date", { ascending: false })
          .limit(1),
        supabase
          .from("action_center")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("campaign_ai_audits")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("campaign_ai_audit_recommendation_status")
          .select("*")
          .eq("client_id", clientId)
          .order("updated_at", { ascending: false })
          .limit(400),
        supabase
          .from("sync_runs")
          .select("status, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        agencyId
          ? supabase
              .from("integrations")
              .select("id", { count: "exact", head: true })
              .eq("agency_id", agencyId)
              .eq("status", "connected")
          : Promise.resolve({ count: 0, error: null }),
      ]);
      throwIfSupabaseError(metrics.error, "metrics_daily");
      throwIfSupabaseError(campaigns.error, "campaigns");
      throwIfSupabaseError(alerts.error, "alerts");
      throwIfSupabaseError(reports.error, "reports");
      throwIfSupabaseError(notes.error, "notes");
      throwIfSupabaseError(health.error, "health_scores");
      throwIfSupabaseError(tasks.error, "tasks");
      throwIfSupabaseError(activities.error, "activities");
      throwIfSupabaseError(adAccounts.error, "client_platform_accounts");
      throwIfSupabaseError(meetingReports.error, "meeting_reports");
      throwIfSupabaseError(ga4Daily.error, "ga4_daily");
      throwIfSupabaseError(ga4Funnel.error, "ga4_funnel_daily");
      throwIfSupabaseError(ga4Channels.error, "ga4_channel_daily");
      throwIfSupabaseError(ga4Tracking.error, "ga4_tracking_health_daily");
      throwIfSupabaseError(actions.error, "action_center");
      throwIfSupabaseError(campaignAudits.error, "campaign_ai_audits");
      throwIfSupabaseError(auditRecoStatuses.error, "audit_reco_status");
      throwIfSupabaseError(syncRun.error, "sync_runs");
      if ("error" in integrationsCount && integrationsCount.error)
        throwIfSupabaseError(integrationsCount.error, "integrations");
      return {
        client: clientSnap.data,
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
        actions: actions.data ?? [],
        campaignAudits: campaignAudits.data ?? [],
        auditRecoStatuses: auditRecoStatuses.data ?? [],
        latestSync: syncRun.data ?? null,
        connectedIntegrationCount: integrationsCount.count ?? 0,
      };
    },
  });

  useEffect(() => {
    const arr = data?.campaignAudits ?? [];
    if (arr.length < 2) return;
    setAuditCompareRight((r) => r || String(arr[0].id));
    setAuditCompareLeft((l) => l || String(arr[1].id));
  }, [data?.campaignAudits]);

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

  const latestAuditIdForReco = data?.campaignAudits?.[0]?.id
    ? String(data.campaignAudits[0].id)
    : "";

  const recoStatusByKey = useMemo(() => {
    const m = new Map<string, string>();
    if (!latestAuditIdForReco) return m;
    for (const row of data?.auditRecoStatuses ?? []) {
      const r = row as Record<string, unknown>;
      if (String(r.audit_id) !== latestAuditIdForReco) continue;
      m.set(String(r.campaign_id), String(r.user_action ?? ""));
    }
    return m;
  }, [data?.auditRecoStatuses, latestAuditIdForReco]);

  const clientTimeline = useMemo(() => {
    if (!data) return [];
    type Ev = {
      at: string;
      kind: "alert" | "action" | "activity" | "report";
      title: string;
      detail?: string;
    };
    const ev: Ev[] = [];
    for (const a of data.alerts ?? []) {
      ev.push({
        at: String(a.created_at ?? ""),
        kind: "alert",
        title: String(a.title ?? "Alerta"),
        detail: String(a.status ?? ""),
      });
    }
    for (const x of data.actions ?? []) {
      ev.push({
        at: String(x.created_at ?? ""),
        kind: "action",
        title: String(x.title ?? "Ação"),
        detail: String(x.status ?? ""),
      });
    }
    for (const ac of data.activities ?? []) {
      ev.push({
        at: String(ac.created_at ?? ""),
        kind: "activity",
        title: String(ac.title ?? "Atividade"),
        detail: ac.type ? String(ac.type) : undefined,
      });
    }
    for (const r of data.reports ?? []) {
      const ps = String(r.period_start ?? "").slice(0, 10);
      const pe = String(r.period_end ?? "").slice(0, 10);
      ev.push({
        at: String(r.created_at ?? ""),
        kind: "report",
        title: `Relatório IA (${ps} → ${pe})`,
        detail: "relatório",
      });
    }
    ev.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return ev.slice(0, 20);
  }, [data]);

  const nextStepsQueue = useMemo(() => {
    if (!data) return [];
    return buildNextStepsQueue({
      actions: data.actions ?? [],
      alerts: data.alerts ?? [],
      reportsCount: (data.reports ?? []).length,
      hasConnectedIntegrationHint: (data.connectedIntegrationCount ?? 0) > 0,
    });
  }, [data]);

  useEffect(() => {
    if (!tplOpen) return;
    const def = MESSAGE_SCENARIO_TEMPLATES.find((t) => t.id === tplScenarioId);
    const clientName = data?.client?.name ?? "Cliente";
    const placeholders: TemplatePlaceholders = {
      cliente: clientName,
      periodo: "últimos 7 dias",
      metrica: "ROAS / CPA",
      prazo: "sexta-feira",
      acao: "ajuste de orçamento",
    };
    setTplDraft(def ? applyMessageTemplate(def.body, placeholders) : "");
  }, [tplOpen, tplScenarioId, data?.client?.name]);

  if (isError) {
    return (
      <QueryErrorState
        title="Não foi possível carregar o cliente"
        message={
          error instanceof Error ? error.message : String(error ?? "Erro")
        }
        onRetry={() => void refetch()}
      />
    );
  }

  if (isLoading || !data) return <PageSkeleton preset="compact" />;
  if (!data.client)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Cliente não encontrado.
      </div>
    );

  const c = data.client;
  const spendLast7Days = [...(data.metrics ?? [])]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 7)
    .reduce((s, m) => s + Number(m.spend ?? 0), 0);
  const budgetSimHint =
    Number(c.monthly_budget ?? 0) > 0 && spendLast7Days > 0
      ? linearWeeklyBudgetIfPauseFraction({ spendLast7Days })
      : null;
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
  const scoreExplBlocks = getJsonNestedRecord(
    latestHealth?.score_explanation ?? null,
    "blocks",
  );

  const syncUi = syncLabelForCockpit(
    data.latestSync?.status,
    data.latestSync?.created_at,
  );

  const goNextStep = (step: NextStepItem) => {
    if (step.href) {
      navigate({ to: step.href });
      return;
    }
    setTab(step.tab);
  };

  const clientNextStep = (() => {
    const actionsOpen = (data.actions ?? []).filter((a: { status?: string }) =>
      isOpenActionCenterStatus(a.status),
    );
    const firstAction = actionsOpen[0] as { title?: string } | undefined;
    const openAlert = (data.alerts ?? []).find(
      (a: { status?: string }) => a.status === "open",
    ) as { title?: string } | undefined;
    const reports = data.reports ?? [];
    if (firstAction) {
      return {
        title: "Resolver ação em aberto",
        description: String(firstAction.title ?? "Tarefa na Central de Ações"),
        cta: "Ver tarefas neste cliente",
        tab: "tasks" as ClientTab,
      };
    }
    if (openAlert) {
      return {
        title: "Tratar alerta aberto",
        description: String(openAlert.title ?? ""),
        cta: "Ver alertas",
        tab: "alerts" as ClientTab,
      };
    }
    if (reports.length === 0) {
      return {
        title: "Gerar o primeiro relatório IA",
        description:
          "Documente valor e contexto para reuniões com um relatório automático.",
        cta: "Ir aos relatórios",
        tab: "reports" as ClientTab,
      };
    }
    return {
      title: "Revisar tendência de métricas",
      description: "Compare série diária e health nos últimos dias.",
      cta: "Abrir métricas",
      tab: "metrics" as ClientTab,
    };
  })();

  const campaignAuditsList = data.campaignAudits ?? [];
  const latestAudit = campaignAuditsList[0] as
    | Record<string, unknown>
    | undefined;
  const auditResultJson = (latestAudit?.result_json ?? {}) as Record<
    string,
    unknown
  >;
  const auditRecommendations = Array.isArray(auditResultJson.recommendations)
    ? (auditResultJson.recommendations as Record<string, unknown>[])
    : [];

  const compareRowLeft = campaignAuditsList.find(
    (a) => String(a.id) === auditCompareLeft,
  );
  const compareRowRight = campaignAuditsList.find(
    (a) => String(a.id) === auditCompareRight,
  );
  const compareJsonLeft = (compareRowLeft?.result_json ?? {}) as Record<
    string,
    unknown
  >;
  const compareJsonRight = (compareRowRight?.result_json ?? {}) as Record<
    string,
    unknown
  >;
  const compareRecLeft = Array.isArray(compareJsonLeft.recommendations)
    ? (compareJsonLeft.recommendations as Record<string, unknown>[])
    : [];
  const compareRecRight = Array.isArray(compareJsonRight.recommendations)
    ? (compareJsonRight.recommendations as Record<string, unknown>[])
    : [];
  const mapCmpL = recommendationCampaignKeys(compareRecLeft);
  const mapCmpR = recommendationCampaignKeys(compareRecRight);
  const idsCmpL = new Set(mapCmpL.keys());
  const idsCmpR = new Set(mapCmpR.keys());
  const onlyInCompareLeft = [...idsCmpL].filter((id) => !idsCmpR.has(id));
  const onlyInCompareRight = [...idsCmpR].filter((id) => !idsCmpL.has(id));
  const recoTypeChanges = [...idsCmpL].filter((id) => {
    if (!idsCmpR.has(id)) return false;
    return (
      String(mapCmpL.get(id)?.suggestion_type ?? "") !==
      String(mapCmpR.get(id)?.suggestion_type ?? "")
    );
  });

  async function upsertAuditRecoStatus(
    auditId: string | undefined,
    campaignId: string | undefined,
    user_action: "analyzed" | "dismissed" | "task_created",
  ) {
    if (!data?.client || !auditId || !campaignId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("campaign_ai_audit_recommendation_status")
      .upsert(
        {
          agency_id: data.client.agency_id,
          client_id: clientId,
          audit_id: auditId,
          campaign_id: campaignId,
          user_action,
          updated_by: user?.id ?? null,
        },
        { onConflict: "audit_id,campaign_id" },
      );
    if (error) toast.error(error.message);
  }

  async function generateReport() {
    setGenerating(true);
    const { data: res, error } = await supabase.functions.invoke(
      "generate-report",
      { body: { client_id: clientId } },
    );
    setGenerating(false);
    if (error || !res)
      return toast.error(error?.message ?? "Erro ao gerar relatório.");
    if (res && typeof res === "object" && "error" in res && res.error) {
      toast.error(String((res as { error: string }).error));
      return;
    }
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
    const { error } = await supabase.from("client_platform_accounts").insert({
      agency_id: data.client.agency_id,
      client_id: clientId,
      provider: integrationProviderFromUi(newAccountProvider),
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
    const { error } = await supabase
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
    const { data: res, error } = await supabase.functions.invoke(
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
    if (res && typeof res === "object" && "error" in res && res.error) {
      toast.error(String((res as { error: string }).error));
      return;
    }
    toast.success("Pauta de reunião gerada.");
    refetch();
  }

  async function runCampaignAiAudit() {
    setAuditingCampaigns(true);
    const { data: res, error } = await supabase.functions.invoke(
      "campaign-ai-audit",
      { body: { client_id: clientId } },
    );
    setAuditingCampaigns(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (res && typeof res === "object" && "error" in res && res.error) {
      toast.error(String((res as { error: string }).error));
      return;
    }
    toast.success("Auditoria de campanhas concluída.");
    refetch();
  }

  async function createTaskFromAuditRecommendation(
    rec: Record<string, unknown>,
  ) {
    if (!data?.client) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const title = String(
      rec.suggested_copy ??
        rec.rationale ??
        `Seguir auditoria — ${rec.campaign_name ?? "campanha"}`,
    ).slice(0, 220);
    const description = String(rec.rationale ?? rec.suggested_copy ?? "").slice(
      0,
      2000,
    );
    const { error } = await supabase.from("action_center").insert({
      agency_id: data.client.agency_id,
      client_id: clientId,
      source_type: "auditoria_campanhas_ia",
      title,
      description: description || null,
      priority: String(rec.confidence ?? "") === "alta" ? "alta" : "media",
      status: "pendente",
      due_date: new Date().toISOString().slice(0, 10),
      created_by: user?.id ?? null,
      metadata: {
        suggestion_type: rec.suggestion_type ?? null,
        campaign_id: rec.campaign_id ?? null,
        tracking_match: rec.tracking_match ?? null,
      } as Json,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await upsertAuditRecoStatus(
      latestAudit?.id ? String(latestAudit.id) : undefined,
      rec.campaign_id ? String(rec.campaign_id) : undefined,
      "task_created",
    );
    toast.success("Tarefa criada na Central de Ações.");
    refetch();
  }

  async function logCampaignAuditActivity(
    kind: "analyzed" | "dismissed",
    rec: Record<string, unknown>,
  ) {
    if (!data?.client) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const title =
      kind === "analyzed"
        ? `Auditoria IA: recomendação marcada como analisada — ${rec.campaign_name ?? ""}`
        : `Auditoria IA: recomendação ignorada — ${rec.campaign_name ?? ""}`;
    const { error } = await supabase.from("activities").insert({
      agency_id: data.client.agency_id,
      client_id: clientId,
      user_id: user?.id ?? null,
      type: "campaign_audit_feedback",
      title: title.slice(0, 500),
      description: String(rec.suggested_copy ?? rec.rationale ?? "").slice(
        0,
        2000,
      ),
      metadata: {
        feedback: kind,
        campaign_id: rec.campaign_id ?? null,
        suggestion_type: rec.suggestion_type ?? null,
      } as Json,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await upsertAuditRecoStatus(
      latestAudit?.id ? String(latestAudit.id) : undefined,
      rec.campaign_id ? String(rec.campaign_id) : undefined,
      kind === "analyzed" ? "analyzed" : "dismissed",
    );
    toast.success(
      kind === "analyzed"
        ? "Registado como analisado."
        : "Registado como ignorado.",
    );
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

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
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
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={clickContext}
            onValueChange={(v) =>
              setClickContext(
                v as
                  | "reuniao"
                  | "pos_ajuste"
                  | "suspeita_problema"
                  | "checkin_rotina",
              )
            }
          >
            <SelectTrigger className="h-11 w-[min(100%,260px)] text-xs">
              <SelectValue placeholder="Contexto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checkin_rotina">Check-in de rotina</SelectItem>
              <SelectItem value="reuniao">Antes de reunião</SelectItem>
              <SelectItem value="pos_ajuste">
                Após ajuste de campanha
              </SelectItem>
              <SelectItem value="suspeita_problema">
                Suspeita de problema
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="default"
            className="h-11 gap-1.5"
            onClick={analyzeNow}
            disabled={analyzingNow}
          >
            {analyzingNow ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Analisar agora
          </Button>
          <Button
            type="button"
            size="default"
            className="h-11 gap-1.5"
            onClick={generateReport}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Gerar relatório IA
          </Button>
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

      <Card className="border-primary/20 bg-primary/[0.06]">
        <CardHeader title="Próximo passo sugerido" />
        <div className="flex flex-col gap-4 p-4 pt-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">{clientNextStep.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {clientNextStep.description}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-11 shrink-0 sm:h-9"
            onClick={() => setTab(clientNextStep.tab)}
          >
            {clientNextStep.cta}
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border pb-px">
          {(
            [
              ["resumo", "Resumo"],
              ["dados", "Dados & IA"],
              ["campanhas", "Campanhas & Ads"],
              ["gestao", "Gestão"],
            ] as const
          ).map(([sid, label]) => {
            const sec = sid as ClientSection;
            const active = sectionForTab(tab) === sec;
            return (
              <button
                key={sid}
                type="button"
                onClick={() => setTab(SECTION_TABS[sec][0])}
                className={`min-h-11 shrink-0 rounded-t-md px-3 py-2 text-sm whitespace-nowrap transition ${active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            );
          })}
        </nav>
        {SECTION_TABS[sectionForTab(tab)].length > 1 && (
          <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border pb-px">
            {SECTION_TABS[sectionForTab(tab)].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`min-h-11 shrink-0 rounded-t-md px-3 py-2 text-sm whitespace-nowrap transition ${tab === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tabLabel(t)}
              </button>
            ))}
          </nav>
        )}
      </div>

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

          <Card className="border-border">
            <CardHeader title="Último sync" />
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <div className={`font-medium ${syncUi.toneClass}`}>
                  {syncUi.primaryLine}
                </div>
                {data.latestSync?.created_at && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Registo:{" "}
                    {data.latestSync.created_at.slice(0, 19).replace("T", " ")}
                  </div>
                )}
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/integrations">Integrações e sync</Link>
              </Button>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Próximos passos (estimativa)" />
              <div className="space-y-3 p-4">
                {nextStepsQueue.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nada urgente na fila — rever métricas ou antecipar relatório.
                  </p>
                ) : (
                  nextStepsQueue.map((step) => (
                    <div
                      key={step.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{step.title}</div>
                        {step.subtitle && (
                          <div className="mt-0.5 text-muted-foreground">
                            {step.subtitle}
                          </div>
                        )}
                        <div className="mt-1 text-muted-foreground">
                          Esforço {formatEffort(step.effortMinutes)}{" "}
                          <span className="italic">(estimativa)</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="shrink-0"
                        onClick={() => goNextStep(step)}
                      >
                        Ir
                      </Button>
                    </div>
                  ))
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setTplOpen(true)}
                >
                  <MessageSquare className="h-4 w-4" />
                  Templates de mensagem
                </Button>
              </div>
            </Card>
            <Card>
              <CardHeader title="Linha do tempo (alertas · ações · atividade · relatórios)" />
              <div className="max-h-80 space-y-0 divide-y divide-border overflow-y-auto p-2">
                {clientTimeline.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">
                    Sem eventos recentes.
                  </p>
                ) : (
                  clientTimeline.map((ev, i) => (
                    <button
                      key={`${ev.kind}-${ev.at}-${i}`}
                      type="button"
                      onClick={() => {
                        if (ev.kind === "report") setTab("reports");
                        else if (ev.kind === "alert") setTab("alerts");
                        else if (ev.kind === "action") setTab("tasks");
                        else setTab("activity");
                      }}
                      className="flex w-full gap-2 px-2 py-2.5 text-left text-xs transition hover:bg-muted/40"
                    >
                      <div className="mt-0.5 shrink-0 text-muted-foreground">
                        {ev.kind === "alert" ? (
                          <Bell className="h-4 w-4" />
                        ) : ev.kind === "action" ? (
                          <ListTodo className="h-4 w-4" />
                        ) : ev.kind === "report" ? (
                          <Sparkles className="h-4 w-4" />
                        ) : (
                          <ActivityIcon className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-snug">{ev.title}</div>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeAgo(ev.at)}
                          </span>
                          {ev.detail ? (
                            <span className="rounded bg-muted px-1.5 py-0.5">
                              {ev.detail}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>

          {budgetSimHint ? (
            <Card className="border-dashed">
              <CardHeader title="Simulação leve (orçamento)" />
              <div className="space-y-2 p-4 text-xs leading-relaxed text-muted-foreground">
                <p>
                  Assumindo uma pausa ou redução de ~
                  {(budgetSimHint.pauseFraction * 100).toFixed(0)}% no volume
                  recente de investimento, a libertação{" "}
                  <span className="italic">aproximada</span> até ao fim desta
                  semana ({budgetSimHint.daysRemaining}{" "}
                  {budgetSimHint.daysRemaining === 1 ? "dia" : "dias"}) seria
                  da ordem de{" "}
                  <span className="font-medium text-foreground">
                    {brl(budgetSimHint.approxSaved)}
                  </span>{" "}
                  (média diária {brl(budgetSimHint.avgDailySpend)} × fração ×
                  dias).
                </p>
                <p className="rounded-md bg-muted/50 p-2 text-[11px]">
                  Estimativa linear sobre média dos últimos 7 dias; não substitui
                  decisão na rede nem inclui leilão, aprendizagem ou alterações
                  de conta.
                </p>
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Health Score explicável (5 blocos)" />
              <div className="space-y-2 p-4 text-xs">
                <Row
                  label="Budget/Pace"
                  value={jsonDisplay(
                    scoreExplBlocks?.["budget_pace"],
                    latestHealth?.stability_score ?? "—",
                  )}
                />
                <Row
                  label="Mídia"
                  value={jsonDisplay(
                    scoreExplBlocks?.["media_performance"],
                    latestHealth?.performance_score ?? "—",
                  )}
                />
                <Row
                  label="Negócio (GA4)"
                  value={jsonDisplay(
                    scoreExplBlocks?.["business_ga4"],
                    latestHealth?.optimization_score ?? "—",
                  )}
                />
                <Row
                  label="Operação"
                  value={jsonDisplay(
                    scoreExplBlocks?.["operational_management"],
                    latestHealth?.communication_score ?? "—",
                  )}
                />
                <Row
                  label="Relacionamento"
                  value={jsonDisplay(
                    scoreExplBlocks?.["relationship_risk"],
                    latestHealth?.engagement_score ?? "—",
                  )}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Central de Ações" />
              <div className="divide-y divide-border">
                {(data.actions ?? []).length === 0 ? (
                  <Empty
                    label="Sem ações abertas para este cliente."
                    action={
                      <Button asChild variant="outline" size="sm">
                        <Link to="/actions">Ir à Central de Ações</Link>
                      </Button>
                    }
                  />
                ) : (
                  (data.actions ?? []).slice(0, 5).map((a: any) => (
                    <div key={a.id} className="px-4 py-3 text-xs">
                      <div className="font-medium">{a.title}</div>
                      <div className="text-muted-foreground">
                        {a.status} · prioridade {a.priority}
                      </div>
                    </div>
                  ))
                )}
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
              <Empty
                label="Sem dados de métricas."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/integrations">Configurar integrações</Link>
                  </Button>
                }
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsSeries}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
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
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              ROAS (linha)
            </p>
            {metricsSeries.length === 0 ? null : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsSeries}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
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
              <Empty
                label="Sem histórico de health."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTab("overview")}
                  >
                    Voltar à visão geral
                  </Button>
                }
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={healthSeries}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis dataKey="t" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
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
                <Empty
                  label="Gere um relatório IA para ver o resumo aqui."
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTab("reports")}
                    >
                      Ir aos relatórios
                    </Button>
                  }
                />
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
                <Empty
                  label="Sem pontos de health ainda."
                  action={
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/health">Health Score global</Link>
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Média (últimos registos)
                      </div>
                      <div className="font-mono text-2xl font-semibold tabular">
                        {healthInsights.avg}
                      </div>
                    </div>
                    {healthInsights.delta != null && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
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
                <Empty
                  label="Ainda sem pautas geradas."
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateMeetingReport}
                      disabled={generatingMeeting}
                    >
                      Gerar pauta agora
                    </Button>
                  }
                />
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
            <Empty
              label="Nenhuma tarefa para este cliente."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/actions">Central de Ações</Link>
                </Button>
              }
            />
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
                  <span className="rounded bg-surface px-2 py-0.5 text-xs uppercase">
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
            <Empty
              label="Sem atividades registradas."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTab("reports")}
                >
                  Gerar relatório ou análise
                </Button>
              }
            />
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
                    <div className="mt-1 text-xs text-muted-foreground">
                      {timeAgo(String(ev.created_at))}
                    </div>
                  </div>
                  <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-xs uppercase text-muted-foreground">
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
            <Empty
              label="Nenhuma campanha cadastrada."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/integrations">Sincronizar contas</Link>
                </Button>
              }
            />
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
                    <span className="rounded bg-surface px-2 py-0.5 text-xs uppercase">
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

      {tab === "campaign_audit" && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold">
                  Auditoria de campanhas (IA)
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Usa métricas por campanha + GA4 (dimensão campanha quando
                  sincronizado). Sugestões são indicativas — revisão humana
                  obrigatória para mudanças agressivas. Limite padrão: intervalo
                  mínimo entre auditorias e quota diária por cliente (variáveis{" "}
                  <span className="font-mono">CAMPAIGN_AUDIT_*</span> no
                  Supabase).
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const draft = buildDraftClientMessageFromRecommendations(
                      auditRecommendations,
                      String(c.name ?? "o cliente"),
                    );
                    setClientMsgBody(draft);
                    setClientMsgOpen(true);
                  }}
                  disabled={auditRecommendations.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50 transition"
                >
                  Mensagem para cliente
                </button>
                <button
                  type="button"
                  onClick={runCampaignAiAudit}
                  disabled={auditingCampaigns}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition"
                >
                  {auditingCampaigns ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Analisar campanhas com IA
                </button>
              </div>
            </div>
            {!latestAudit ? (
              <div className="p-6">
                <Empty
                  label="Ainda não há auditorias. Execute uma análise para gerar recomendações."
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={runCampaignAiAudit}
                      disabled={auditingCampaigns}
                    >
                      Executar auditoria IA
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="space-y-4 p-4">
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    Período:{" "}
                    <span className="font-mono text-foreground">
                      {String(latestAudit.period_start)} →{" "}
                      {String(latestAudit.period_end)}
                    </span>
                  </span>
                  <span>
                    GA4 tracking:{" "}
                    <span className="font-mono text-foreground">
                      {String(latestAudit.ga4_tracking_health)}
                    </span>
                  </span>
                  <span>
                    Modelo:{" "}
                    <span className="font-mono text-foreground">
                      {String(latestAudit.model ?? "—")}
                    </span>
                  </span>
                  {auditResultJson.ga4_attribution_method ? (
                    <span>
                      Atribuição:{" "}
                      <span className="font-mono text-foreground">
                        {String(auditResultJson.ga4_attribution_method)}
                      </span>
                    </span>
                  ) : null}
                </div>
                {latestAudit.executive_summary_markdown ? (
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                      Resumo executivo
                    </div>
                    <div className="audit-md text-sm leading-relaxed text-foreground/90 [&_h1]:mb-2 [&_h1]:text-base [&_h2]:mt-3 [&_h2]:text-sm [&_h3]:text-sm [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:break-all [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeSanitize]}
                      >
                        {String(latestAudit.executive_summary_markdown)}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : null}
                {auditRecommendations.length === 0 ? (
                  <Empty
                    label="Sem recomendações estruturadas nesta auditoria."
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={runCampaignAiAudit}
                        disabled={auditingCampaigns}
                      >
                        Nova auditoria
                      </Button>
                    }
                  />
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="border-b border-border bg-surface/80 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Campanha</th>
                          <th className="px-3 py-2 font-medium">Sugestão</th>
                          <th className="px-3 py-2 font-medium">Tipo</th>
                          <th className="px-3 py-2 font-medium">Match</th>
                          <th className="px-3 py-2 font-medium">Estado</th>
                          <th className="px-3 py-2 font-medium text-right">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {auditRecommendations.map((rec, idx) => {
                          const cid = String(rec.campaign_id ?? "");
                          const st = recoStatusByKey.get(cid);
                          const stLabel =
                            st === "task_created"
                              ? "Tarefa criada"
                              : st === "analyzed"
                                ? "Analisado"
                                : st === "dismissed"
                                  ? "Ignorado"
                                  : "—";
                          return (
                            <tr
                              key={`${String(rec.campaign_id ?? idx)}-${idx}`}
                            >
                              <td className="px-3 py-2 align-top">
                                <div className="font-medium">
                                  {String(rec.campaign_name ?? "—")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {String(rec.platform ?? "")}
                                </div>
                                {rec.requires_human_review ? (
                                  <div className="mt-1 text-xs uppercase text-warning">
                                    Requer revisão humana
                                  </div>
                                ) : null}
                              </td>
                              <td className="max-w-md px-3 py-2 align-top text-xs leading-relaxed">
                                {String(
                                  rec.suggested_copy ?? rec.rationale ?? "—",
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs">
                                {String(rec.suggestion_type ?? "—")}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 align-top text-xs">
                                {String(rec.tracking_match ?? "—")}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 align-top text-xs">
                                <Select
                                  value={st ?? "open"}
                                  onValueChange={(v) => {
                                    if (v === "analyzed" || v === "dismissed") {
                                      void logCampaignAuditActivity(v, rec);
                                    } else if (v === "task_created") {
                                      void createTaskFromAuditRecommendation(rec);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-7 w-[130px] text-xs">
                                    <SelectValue>{stLabel === "—" ? "Aberta" : stLabel}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="open">Aberta</SelectItem>
                                    <SelectItem value="analyzed">Analisado</SelectItem>
                                    <SelectItem value="task_created">Criar tarefa</SelectItem>
                                    <SelectItem value="dismissed">Ignorar</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-3 py-2 align-top text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                                    onClick={() => {
                                      void navigator.clipboard.writeText(
                                        [
                                          rec.suggested_copy,
                                          rec.rationale,
                                          rec.suggestion_type,
                                        ]
                                          .filter(Boolean)
                                          .map(String)
                                          .join("\n\n"),
                                      );
                                      toast.success("Copiado.");
                                    }}
                                  >
                                    <ClipboardCopy className="h-3 w-3" />
                                    Copiar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Card>
          <Dialog open={clientMsgOpen} onOpenChange={setClientMsgOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Mensagem para o cliente (rascunho)</DialogTitle>
                <DialogDescription>
                  Revise e adapte antes de enviar. O texto não substitui parecer
                  humano nem garante resultados.
                </DialogDescription>
              </DialogHeader>
              <textarea
                value={clientMsgBody}
                onChange={(e) => setClientMsgBody(e.target.value)}
                className="min-h-[220px] w-full resize-y rounded-md border border-border bg-background p-3 text-sm"
              />
              <DialogFooter className="flex flex-row flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setClientMsgOpen(false)}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(clientMsgBody);
                    toast.success("Copiado para a área de transferência.");
                  }}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  Copiar
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {campaignAuditsList.length >= 2 ? (
            <Card>
              <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Comparar duas auditorias
              </div>
              <div className="space-y-3 p-4 text-sm">
                <div className="flex flex-wrap gap-3">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Auditoria A (mais antiga sugerida)
                    <select
                      value={auditCompareLeft}
                      onChange={(e) => setAuditCompareLeft(e.target.value)}
                      className="h-9 min-w-[200px] rounded-md border border-border bg-background px-2 text-sm text-foreground"
                    >
                      {campaignAuditsList.map((a) => (
                        <option key={`l-${String(a.id)}`} value={String(a.id)}>
                          {String(a.period_start)} → {String(a.period_end)} ·{" "}
                          {timeAgo(String(a.created_at))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Auditoria B (mais recente sugerida)
                    <select
                      value={auditCompareRight}
                      onChange={(e) => setAuditCompareRight(e.target.value)}
                      className="h-9 min-w-[200px] rounded-md border border-border bg-background px-2 text-sm text-foreground"
                    >
                      {campaignAuditsList.map((a) => (
                        <option key={`r-${String(a.id)}`} value={String(a.id)}>
                          {String(a.period_start)} → {String(a.period_end)} ·{" "}
                          {timeAgo(String(a.created_at))}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="rounded-md border border-border bg-surface/40 p-3 text-xs leading-relaxed">
                  <div className="font-semibold text-foreground">
                    Estado geral (
                    <span className="font-mono">overall_status</span>)
                  </div>
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">A:</span>{" "}
                      <span className="font-mono">
                        {overallStatusLabel(compareJsonLeft)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">B:</span>{" "}
                      <span className="font-mono">
                        {overallStatusLabel(compareJsonRight)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 font-semibold text-foreground">
                    Recomendações
                  </div>
                  <ul className="mt-1 list-inside list-disc text-muted-foreground">
                    <li>
                      Só em A:{" "}
                      <span className="font-mono text-foreground">
                        {onlyInCompareLeft.length}
                      </span>{" "}
                      campanha(s)
                    </li>
                    <li>
                      Só em B:{" "}
                      <span className="font-mono text-foreground">
                        {onlyInCompareRight.length}
                      </span>{" "}
                      campanha(s)
                    </li>
                    <li>
                      Tipo de sugestão alterado (mesma campanha):{" "}
                      <span className="font-mono text-foreground">
                        {recoTypeChanges.length}
                      </span>
                    </li>
                  </ul>
                  {recoTypeChanges.length > 0 ? (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded border border-border bg-background p-2 font-mono text-xs">
                      {recoTypeChanges.slice(0, 12).map((id) => (
                        <div key={id}>
                          {id}:{" "}
                          <span className="text-muted-foreground">
                            {String(mapCmpL.get(id)?.suggestion_type ?? "—")} →{" "}
                            {String(mapCmpR.get(id)?.suggestion_type ?? "—")}
                          </span>
                        </div>
                      ))}
                      {recoTypeChanges.length > 12 ? (
                        <div className="text-muted-foreground">
                          … +{recoTypeChanges.length - 12} outras
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}

          {campaignAuditsList.length > 1 ? (
            <Card>
              <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Histórico recente
              </div>
              <div className="divide-y divide-border">
                {campaignAuditsList
                  .slice(1)
                  .map((a: Record<string, unknown>) => (
                    <div key={String(a.id)} className="px-4 py-2 text-xs">
                      <span className="font-mono">
                        {String(a.period_start)} → {String(a.period_end)}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {timeAgo(String(a.created_at))}
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          ) : null}
        </div>
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
                  Nenhuma conta vinculada. Ao sincronizar, usamos esta conta
                  como padrão para este cliente quando ela estiver disponível.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {data.adAccounts.map((acc: PlatformAccountRow) => (
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
            <Empty
              label="Sem alertas."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/alerts">Central de alertas</Link>
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {data.alerts.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{a.title}</div>
                    <span className="text-xs uppercase text-muted-foreground">
                      {a.priority}
                    </span>
                  </div>
                  {a.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {a.description}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
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
              <Empty
                label="Nenhum relatório IA. Clique em 'Gerar relatório IA'."
                action={
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={generateReport}
                    disabled={generating}
                  >
                    Gerar relatório IA
                  </Button>
                }
              />
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
            <Empty
              label="Sem notas."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTab("overview")}
                >
                  Voltar à visão geral
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {data.notes.map((n) => (
                <div key={n.id} className="px-4 py-3 text-sm">
                  <p>{n.content}</p>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {timeAgo(n.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Templates de mensagem</DialogTitle>
            <DialogDescription>
              Placeholders: {"{{cliente}}"}, {"{{periodo}}"}, {"{{metrica}}"}. Copie
              ou envie pelo WhatsApp se o telefone estiver na ficha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-xs text-muted-foreground">
              Cenário
              <select
                value={tplScenarioId}
                onChange={(e) => setTplScenarioId(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                {MESSAGE_SCENARIO_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              value={tplDraft}
              onChange={(e) => setTplDraft(e.target.value)}
              className="min-h-[180px] w-full resize-y rounded-md border border-border bg-background p-3 text-sm"
            />
          </div>
          <DialogFooter className="flex flex-row flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTplOpen(false)}
            >
              Fechar
            </Button>
            <Button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(tplDraft);
                toast.success("Copiado.");
              }}
            >
              Copiar
            </Button>
            {(() => {
              const raw = c.contact_phone;
              const digits = String(raw ?? "").replace(/\D/g, "");
              if (digits.length < 10) return null;
              const href = `https://wa.me/${digits}?text=${encodeURIComponent(tplDraft)}`;
              return (
                <Button type="button" asChild>
                  <a href={href} target="_blank" rel="noreferrer">
                    Abrir WhatsApp
                  </a>
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
        {title}
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
        {body}
      </p>
    </div>
  );
}

export const _u = { num, RefreshCw };
