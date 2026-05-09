import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { brl } from "@/lib/format";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import {
  Card,
  CardHeader,
  Empty,
  PageSkeleton,
  RiskDot,
  ScoreBar,
} from "@/components/operational-ui";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
import {
  canCreateClient,
  type SubscriptionLimits,
} from "@/lib/subscription-limits";
import { auditOverallStatus } from "@/lib/audit-dashboard";
import type { Database } from "@/integrations/supabase/types";
import { ACTION_CENTER_OPEN_STATUSES } from "@/lib/action-center-status";
import { rowsToCsv } from "@/lib/csv";
import { PageHeader } from "@/components/page-header";
import { ClientCockpitRow } from "@/components/client-cockpit-row";
import { QueryErrorState } from "@/components/query-error-state";
import { throwIfSupabaseError } from "@/lib/supabase-result";

type HealthScoreRow = Database["public"]["Tables"]["health_scores"]["Row"];

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export const Route = createFileRoute("/_authenticated/clients/")({
  component: Clients,
  validateSearch: (s) => ({ new: (s.new as string) || undefined }),
});

function Clients() {
  const { agency, user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [creating, setCreating] = useState(!!search.new);
  const [q, setQ] = useState("");
  const [listToolbarOpen, setListToolbarOpen] = useState(false);
  const limits = useSubscriptionLimits();

  useEffect(() => {
    setCreating(!!search.new);
  }, [search.new]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["clients", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const myRolesRes = await supabase
        .from("user_roles")
        .select("role")
        .eq("agency_id", agency!.id)
        .eq("user_id", user!.id);
      throwIfSupabaseError(myRolesRes.error, "clients_page.user_roles");
      const myRoles = myRolesRes.data ?? [];
      const canSeeAll = myRoles.some(
        (r) => r.role === "owner" || r.role === "admin",
      );

      let scopedRows: { client_id: string }[] = [];
      if (!canSeeAll) {
        const scopedRes = await supabase
          .from("client_member_scopes")
          .select("client_id")
          .eq("agency_id", agency!.id)
          .eq("user_id", user!.id);
        throwIfSupabaseError(scopedRes.error, "clients_page.scopes");
        scopedRows = (scopedRes.data ?? []) as { client_id: string }[];
      }

      let clientQuery = supabase
        .from("clients")
        .select("*")
        .eq("agency_id", agency!.id)
        .order("created_at", { ascending: false });
      if (!canSeeAll) {
        const ids = scopedRows.map((x) => x.client_id);
        clientQuery = ids.length
          ? clientQuery.in("id", ids)
          : clientQuery.limit(0);
      }

      const [
        clients,
        health,
        openAlerts,
        auditsSnap,
        openActionsSnap,
        syncRunsSnap,
      ] = await Promise.all([
        clientQuery,
        supabase
          .from("health_scores")
          .select("client_id, score, risk, recorded_at, score_explanation")
          .eq("agency_id", agency!.id)
          .order("recorded_at", { ascending: false }),
        supabase
          .from("alerts")
          .select("client_id, title, type, created_at")
          .eq("agency_id", agency!.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("campaign_ai_audits")
          .select("client_id, created_at, result_json")
          .eq("agency_id", agency!.id)
          .order("created_at", { ascending: false })
          .limit(400),
        supabase
          .from("action_center")
          .select("client_id")
          .eq("agency_id", agency!.id)
          .in("status", [...ACTION_CENTER_OPEN_STATUSES])
          .limit(2500),
        supabase
          .from("sync_runs")
          .select("client_id, status, created_at")
          .eq("agency_id", agency!.id)
          .not("client_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(800),
      ]);
      throwIfSupabaseError(clients.error, "clients_page.clients");
      throwIfSupabaseError(health.error, "clients_page.health_scores");
      throwIfSupabaseError(openAlerts.error, "clients_page.alerts");
      throwIfSupabaseError(auditsSnap.error, "clients_page.audits");
      throwIfSupabaseError(openActionsSnap.error, "clients_page.action_center");
      throwIfSupabaseError(syncRunsSnap.error, "clients_page.sync_runs");

      const latest = new Map<string, HealthScoreRow>();
      for (const h of health.data ?? []) {
        if (!latest.has(h.client_id)) latest.set(h.client_id, h);
      }

      const latestAuditByClient = new Map<
        string,
        { created_at: string; result_json: unknown }
      >();
      for (const a of auditsSnap.data ?? []) {
        const cid = String(a.client_id ?? "");
        if (!cid || latestAuditByClient.has(cid)) continue;
        latestAuditByClient.set(cid, {
          created_at: String(a.created_at ?? ""),
          result_json: a.result_json,
        });
      }

      const latestGa4AlertByClient = new Map<
        string,
        { title: string; created_at: string }
      >();
      for (const a of openAlerts.data ?? []) {
        const cid = a.client_id as string | null;
        if (!cid || latestGa4AlertByClient.has(cid)) continue;
        const t =
          `${String(a.type ?? "")} ${String(a.title ?? "")}`.toLowerCase();
        if (!t.includes("ga4") && !t.includes("analytics")) continue;
        latestGa4AlertByClient.set(cid, {
          title: String(a.title ?? "Alerta GA4"),
          created_at: String(a.created_at ?? ""),
        });
      }

      const openActionsByClient = new Map<string, number>();
      for (const row of openActionsSnap.data ?? []) {
        const cid = row.client_id as string | null;
        if (!cid) continue;
        openActionsByClient.set(cid, (openActionsByClient.get(cid) ?? 0) + 1);
      }

      const latestSyncByClient = new Map<
        string,
        { status: string; created_at: string }
      >();
      for (const s of syncRunsSnap.data ?? []) {
        const cid = s.client_id as string | null;
        if (!cid || latestSyncByClient.has(cid)) continue;
        latestSyncByClient.set(cid, {
          status: String(s.status ?? ""),
          created_at: String(s.created_at ?? ""),
        });
      }

      return {
        clients: clients.data ?? [],
        latest,
        latestGa4AlertByClient,
        latestAuditByClient,
        openActionsByClient,
        latestSyncByClient,
      };
    },
  });

  if (limits.isError) {
    return (
      <QueryErrorState
        title="Não foi possível carregar limites do plano"
        message={
          limits.error instanceof Error
            ? limits.error.message
            : String(limits.error ?? "Erro")
        }
        onRetry={() => void limits.refetch()}
      />
    );
  }

  if (isError) {
    return (
      <QueryErrorState
        title="Não foi possível carregar os clientes"
        message={
          error instanceof Error ? error.message : String(error ?? "Erro")
        }
        onRetry={() => void refetch()}
      />
    );
  }

  if (isLoading || !data) return <PageSkeleton />;
  const filtered = data.clients.filter(
    (c) => !q || c.name.toLowerCase().includes(q.toLowerCase()),
  );
  const riskOrder: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  const riskRadar = [...filtered]
    .map((c) => ({
      client: c,
      health: data.latest.get(c.id) as HealthScoreRow | undefined,
    }))
    .filter((x) => x.health)
    .sort(
      (a, b) =>
        (riskOrder[b.health.risk] ?? 0) - (riskOrder[a.health.risk] ?? 0) ||
        Number(a.health.score ?? 0) - Number(b.health.score ?? 0),
    )
    .slice(0, 4);

  function downloadCockpitCsv() {
    const rows: string[][] = [
      [
        "Cliente",
        "Health score",
        "Risco",
        "Ações abertas",
        "Último sync status",
        "Último sync em",
        "Última auditoria IA",
      ],
    ];
    for (const c of filtered) {
      const h = data.latest.get(c.id);
      const openN = data.openActionsByClient.get(c.id) ?? 0;
      const sync = data.latestSyncByClient.get(c.id);
      const au = data.latestAuditByClient.get(c.id);
      const auLabel = au?.created_at ? String(au.created_at).slice(0, 10) : "";
      rows.push([
        c.name,
        h ? String(h.score ?? "") : "",
        h ? String(h.risk ?? "") : "",
        String(openN),
        sync ? sync.status : "",
        sync ? sync.created_at.slice(0, 19) : "",
        auLabel,
      ]);
    }
    const body = rowsToCsv(rows);
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cockpit-clientes-${isoToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  }

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        className="gap-3 md:flex-row md:items-center md:justify-between"
        title="Clientes"
        description={`${data.clients.length} cliente(s) na operação`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar..."
              className="h-11 w-56 rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </div>
          <div className="flex gap-2 md:hidden">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 gap-2"
              onClick={() => setListToolbarOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Buscar
            </Button>
          </div>
          <Button
            type="button"
            className="h-11 gap-2 md:w-auto"
            onClick={() => {
              const sub = limits.data?.subscription;
              const n = limits.data?.clientCount ?? 0;
              if (!canCreateClient(n, sub)) {
                toast.error(
                  `Limite do plano atingido (${sub?.max_clients ?? 5} clientes). Faça upgrade em Admin.`,
                );
                return;
              }
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        </div>
      </PageHeader>

      <Sheet open={listToolbarOpen} onOpenChange={setListToolbarOpen}>
        <SheetContent side="bottom" className="p-0">
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <SheetTitle>Buscar clientes</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 px-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome do cliente..."
                className="h-11 w-full rounded-md border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-primary/60"
              />
            </div>
            <Button
              type="button"
              className="h-11 w-full"
              onClick={() => setListToolbarOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cockpit operacional
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Health, ações abertas, último sync e auditoria IA — útil para
              stand-up.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 shrink-0 md:h-9"
            onClick={downloadCockpitCsv}
          >
            Exportar CSV
          </Button>
        </div>
        <div className="space-y-3 border-b border-border p-4 md:hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum cliente na lista.
            </p>
          ) : (
            filtered.map((c) => {
              const h = data.latest.get(c.id);
              const openN = data.openActionsByClient.get(c.id) ?? 0;
              const sync = data.latestSyncByClient.get(c.id);
              const au = data.latestAuditByClient.get(c.id);
              const syncTone =
                sync?.status === "error"
                  ? "text-destructive"
                  : sync?.status === "warning"
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground";
              return (
                <ClientCockpitRow
                  key={`cockpit-m-${c.id}`}
                  clientId={c.id}
                  clientName={c.name}
                  layout="mobile"
                  healthRisk={h?.risk}
                  healthScore={h?.score}
                  openN={openN}
                  syncStatus={sync?.status}
                  syncToneClass={syncTone}
                  auditDate={
                    au?.created_at
                      ? String(au.created_at).slice(0, 10)
                      : undefined
                  }
                />
              );
            })
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <div className="grid min-w-[760px] grid-cols-12 gap-2 border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div className="col-span-3">Cliente</div>
            <div className="col-span-2">Health</div>
            <div className="col-span-2 text-center">Ações</div>
            <div className="col-span-3">Último sync</div>
            <div className="col-span-2">Auditoria IA</div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              Nenhum cliente na lista.
            </div>
          ) : (
            filtered.map((c) => {
              const h = data.latest.get(c.id);
              const openN = data.openActionsByClient.get(c.id) ?? 0;
              const sync = data.latestSyncByClient.get(c.id);
              const au = data.latestAuditByClient.get(c.id);
              const syncTone =
                sync?.status === "error"
                  ? "text-destructive"
                  : sync?.status === "warning"
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground";
              return (
                <ClientCockpitRow
                  key={`cockpit-${c.id}`}
                  clientId={c.id}
                  clientName={c.name}
                  layout="desktop"
                  healthRisk={h?.risk}
                  healthScore={h?.score}
                  openN={openN}
                  syncStatus={sync?.status}
                  syncCreatedAt={sync?.created_at}
                  syncToneClass={syncTone}
                  auditDate={
                    au?.created_at
                      ? String(au.created_at).slice(0, 10)
                      : undefined
                  }
                />
              );
            })
          )}
        </div>
      </Card>

      <Card>
        <div className="border-b border-border px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Client Risk Radar (prioridade de retenção)
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {riskRadar.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Sem clientes com score calculado.
              </div>
            ) : (
              riskRadar.map((item) => {
                const expl = item.health?.score_explanation as
                  | {
                      penalties?: Array<{ reason?: string }>;
                      signals?: {
                        roas_recent?: number;
                        roas_delta_pct?: number;
                        tracking_status?: string;
                      };
                      suggested_next_step?: string;
                    }
                  | undefined;
                const pen = (expl?.penalties ?? []).filter(Boolean) as Array<{
                  reason?: string;
                }>;
                const bullets = pen
                  .slice(0, 3)
                  .map((p) => p.reason)
                  .filter(Boolean);
                const sig = expl?.signals;
                const ga4Alert = data.latestGa4AlertByClient.get(
                  item.client.id,
                );
                const roasHint =
                  sig &&
                  typeof sig.roas_recent === "number" &&
                  typeof sig.roas_delta_pct === "number"
                    ? `ROAS ${sig.roas_recent.toFixed(2)} (${sig.roas_delta_pct >= 0 ? "+" : ""}${sig.roas_delta_pct.toFixed(0)}% vs período anterior)`
                    : null;
                const trackHint =
                  sig?.tracking_status === "critical"
                    ? "Tracking GA4 em estado crítico."
                    : sig?.tracking_status === "warning"
                      ? "Tracking GA4 em atenção."
                      : null;
                return (
                  <div
                    key={item.client.id}
                    className="rounded border border-border bg-surface px-2.5 py-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{item.client.name}</div>
                      <Link
                        to="/actions"
                        className="inline-flex min-h-11 shrink-0 items-center text-xs text-primary hover:underline"
                      >
                        Ações
                      </Link>
                    </div>
                    <div className="text-muted-foreground">
                      risco {item.health.risk} · health {item.health.score}
                    </div>
                    {roasHint && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {roasHint}
                      </p>
                    )}
                    {trackHint && (
                      <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                        {trackHint}
                      </p>
                    )}
                    {ga4Alert && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Alerta GA4: {ga4Alert.title}
                      </p>
                    )}
                    {bullets.length > 0 && (
                      <ul className="mt-1.5 list-inside list-disc text-xs text-muted-foreground">
                        {bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {expl?.suggested_next_step && (
                      <p className="mt-2 rounded bg-primary/10 px-2 py-2 text-xs font-medium text-foreground">
                        Próximo passo: {expl.suggested_next_step}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="space-y-3 border-b border-border p-4 md:hidden">
          {filtered.length === 0 ? (
            <Empty
              label="Nenhum cliente."
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-11 sm:h-9"
                  onClick={() => {
                    const sub = limits.data?.subscription;
                    const n = limits.data?.clientCount ?? 0;
                    if (!canCreateClient(n, sub)) {
                      toast.error(
                        `Limite do plano atingido (${sub?.max_clients ?? 5} clientes). Faça upgrade em Admin.`,
                      );
                      return;
                    }
                    setCreating(true);
                  }}
                >
                  Criar primeiro cliente
                </Button>
              }
            />
          ) : (
            filtered.map((c) => {
              const h = data.latest.get(c.id);
              const au = data.latestAuditByClient.get(c.id);
              const auStatus = au
                ? auditOverallStatus(au.result_json as Record<string, unknown>)
                : null;
              const auditBadgeTone =
                auStatus === "critical"
                  ? "bg-destructive/15 text-destructive"
                  : auStatus === "risk"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : auStatus === "attention"
                      ? "bg-warning/15 text-warning"
                      : "";
              return (
                <Link
                  key={`list-m-${c.id}`}
                  to="/clients/$clientId"
                  params={{ clientId: c.id }}
                  className="surface-card block rounded-xl border border-border p-4 text-sm shadow-sm transition hover:bg-surface-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate font-semibold">
                            {c.name}
                          </span>
                          {auStatus && auditBadgeTone ? (
                            <span
                              className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${auditBadgeTone}`}
                            >
                              IA {auStatus}
                            </span>
                          ) : null}
                        </div>
                        {c.segment && (
                          <div className="truncate text-xs text-muted-foreground">
                            {c.segment}
                          </div>
                        )}
                      </div>
                    </div>
                    <StatusPill status={c.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="font-medium text-muted-foreground">
                        MRR
                      </div>
                      <div className="font-mono tabular text-sm">
                        {brl(c.mrr)}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-muted-foreground">
                        Orçamento
                      </div>
                      <div className="font-mono tabular text-sm text-muted-foreground">
                        {brl(c.monthly_budget)}
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-2 border-t border-border pt-3">
                      <span className="text-muted-foreground">Health</span>
                      {h ? (
                        <span className="flex items-center gap-2 font-mono text-sm tabular">
                          <RiskDot risk={h.risk} />
                          {h.score}
                          <ScoreBar score={h.score} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
        <div className="hidden md:block">
          <div className="grid grid-cols-12 border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div className="col-span-4">Cliente</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">MRR</div>
            <div className="col-span-2">Orçamento</div>
            <div className="col-span-2 text-right">Health</div>
          </div>
          {filtered.length === 0 ? (
            <Empty
              label="Nenhum cliente."
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-11 sm:h-9"
                  onClick={() => {
                    const sub = limits.data?.subscription;
                    const n = limits.data?.clientCount ?? 0;
                    if (!canCreateClient(n, sub)) {
                      toast.error(
                        `Limite do plano atingido (${sub?.max_clients ?? 5} clientes). Faça upgrade em Admin.`,
                      );
                      return;
                    }
                    setCreating(true);
                  }}
                >
                  Criar primeiro cliente
                </Button>
              }
            />
          ) : (
            filtered.map((c) => {
              const h = data.latest.get(c.id);
              const au = data.latestAuditByClient.get(c.id);
              const auStatus = au
                ? auditOverallStatus(au.result_json as Record<string, unknown>)
                : null;
              const auditBadgeTone =
                auStatus === "critical"
                  ? "bg-destructive/15 text-destructive"
                  : auStatus === "risk"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : auStatus === "attention"
                      ? "bg-warning/15 text-warning"
                      : "";
              return (
                <Link
                  key={c.id}
                  to="/clients/$clientId"
                  params={{ clientId: c.id }}
                  className="grid grid-cols-12 items-center border-b border-border px-4 py-3 text-sm last:border-0 hover:bg-surface-2 transition"
                >
                  <div className="col-span-4 flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-medium">{c.name}</span>
                        {auStatus && auditBadgeTone ? (
                          <span
                            className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${auditBadgeTone}`}
                          >
                            IA {auStatus}
                          </span>
                        ) : null}
                      </div>
                      {c.segment && (
                        <div className="truncate text-xs text-muted-foreground">
                          {c.segment}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <StatusPill status={c.status} />
                  </div>
                  <div className="col-span-2 font-mono tabular text-sm">
                    {brl(c.mrr)}
                  </div>
                  <div className="col-span-2 font-mono tabular text-sm text-muted-foreground">
                    {brl(c.monthly_budget)}
                  </div>
                  <div className="col-span-2 flex min-h-11 items-center justify-end gap-2">
                    {h ? (
                      <>
                        <RiskDot risk={h.risk} />
                        <span className="font-mono tabular text-sm">
                          {h.score}
                        </span>
                        <ScoreBar score={h.score} />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </Card>

      {creating && (
        <NewClientDialog
          onClose={() => {
            setCreating(false);
            navigate({ to: "/clients", search: {} });
            refetch();
            limits.refetch();
          }}
          agencyId={agency!.id}
          clientCount={limits.data?.clientCount ?? 0}
          subscription={limits.data?.subscription ?? null}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success",
    paused: "bg-warning/15 text-warning",
    onboarding: "bg-info/15 text-info",
    churned: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

function NewClientDialog({
  onClose,
  agencyId,
  clientCount,
  subscription,
}: {
  onClose: () => void;
  agencyId: string;
  clientCount: number;
  subscription: SubscriptionLimits | null;
}) {
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [mrr, setMrr] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreateClient(clientCount, subscription)) {
      toast.error(
        `Limite do plano: máximo ${subscription?.max_clients ?? 5} clientes.`,
      );
      return;
    }
    setLoading(true);
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("clients").insert({
      agency_id: agencyId,
      name,
      segment: segment || null,
      mrr: Number(mrr) || 0,
      monthly_budget: Number(budget) || 0,
      portal_slug: slug,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cliente criado.");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface-card w-full max-w-md rounded-xl border border-border p-5 shadow-2xl"
      >
        <CardHeader title="Novo cliente" />
        <form onSubmit={submit} className="space-y-3 pt-4">
          <DField label="Nome" value={name} onChange={setName} autoFocus />
          <DField
            label="Segmento"
            value={segment}
            onChange={setSegment}
            placeholder="E-commerce, SaaS, ..."
          />
          <div className="grid grid-cols-2 gap-3">
            <DField
              label="MRR (R$)"
              value={mrr}
              onChange={setMrr}
              type="number"
            />
            <DField
              label="Orçamento mensal (R$)"
              value={budget}
              onChange={setBudget}
              type="number"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface transition"
            >
              Cancelar
            </button>
            <button
              disabled={loading || !name}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition"
            >
              Criar cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
      />
    </label>
  );
}
