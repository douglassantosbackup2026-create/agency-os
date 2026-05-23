import { createFileRoute, Link } from "@tanstack/react-router";
import { useOperationClientScope } from "@/hooks/use-operation-client-scope";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/format";
import { Card, Empty, PageSkeleton } from "@/components/operational-ui";
import { FilterDrawer } from "@/components/filter-drawer";
import { AgencyClientSelect } from "@/components/agency-client-select";
import { PageHeader } from "@/components/page-header";
import { useAgencyClientsOptions } from "@/hooks/use-agency-clients-options";
import { useAgencyTeammates } from "@/hooks/use-agency-teammates";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, SlidersHorizontal } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { ACTION_CENTER_OPEN_STATUSES_SET } from "@/lib/action-center-status";
import { FILTER_SELECT_TRIGGER_CLASSES } from "@/lib/ui/filter-classes";
import {
  ActionCenterListRow,
  type ActionCenterListRowModel as ActionCenterRow,
} from "@/components/action-center-list-row";

const ACTIONS_FILTERS_LS = "action-center-filters-v1";
/** Referência estável para linhas não-expandidas — preserva memo() das rows. */
const EMPTY_EVENT_ROWS: Array<{
  id: string;
  event_type: string;
  payload: unknown;
  created_at: string;
}> = [];

type SlaFilterType = "all" | "overdue" | "soon_3" | "soon_7" | "range";
type SortDueType = "none" | "due_asc" | "due_desc";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isActionOverdue(a: { due_date?: string | null; status?: string }) {
  if (
    !a.due_date ||
    !a.status ||
    !ACTION_CENTER_OPEN_STATUSES_SET.has(a.status)
  )
    return false;
  return a.due_date < todayISO();
}

function dueWithinDays(
  a: { due_date?: string | null; status?: string },
  days: number,
) {
  if (
    !a.due_date ||
    !a.status ||
    !ACTION_CENTER_OPEN_STATUSES_SET.has(a.status)
  )
    return false;
  const t = todayISO();
  const limit = addDaysISO(days);
  return a.due_date >= t && a.due_date <= limit;
}

function passesDueSla(
  a: ActionCenterRow,
  slaFilter: SlaFilterType,
  dueFrom: string,
  dueTo: string,
) {
  if (slaFilter === "all") return true;
  if (slaFilter === "overdue") return isActionOverdue(a);
  if (slaFilter === "soon_3") return dueWithinDays(a, 3);
  if (slaFilter === "soon_7") return dueWithinDays(a, 7);
  if (slaFilter === "range") {
    if (
      !a.due_date ||
      !ACTION_CENTER_OPEN_STATUSES_SET.has(String(a.status ?? ""))
    )
      return false;
    if (dueFrom && a.due_date < dueFrom) return false;
    if (dueTo && a.due_date > dueTo) return false;
    return true;
  }
  return true;
}

function sortByDue(rows: ActionCenterRow[], sortDue: SortDueType) {
  if (sortDue === "none") return rows;
  const far = sortDue === "due_asc" ? "9999-12-31" : "0000-01-01";
  return [...rows].sort((a, b) => {
    const da = a.due_date ?? far;
    const db = b.due_date ?? far;
    return sortDue === "due_asc" ? da.localeCompare(db) : db.localeCompare(da);
  });
}

function exportActionsToCsv(rows: ActionCenterRow[]) {
  const header = [
    "ID",
    "Cliente",
    "Título",
    "Origem",
    "Prioridade",
    "Estado",
    "Responsável",
    "Prazo",
    "Criado em",
  ];
  const body = rows.map((a) => [
    a.id,
    (a.clients as { name?: string } | null)?.name ?? "",
    (a.title ?? "").replace(/,/g, ";"),
    a.source_type ?? "",
    a.priority ?? "",
    a.status ?? "",
    a.assigned_to ?? "",
    a.due_date ?? "",
    a.created_at ? new Date(a.created_at).toISOString().slice(0, 10) : "",
  ]);
  const csv = [header, ...body].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `acoes-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadSavedFilters() {
  try {
    const raw = localStorage.getItem(ACTIONS_FILTERS_LS);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/_authenticated/actions")({
  component: ActionsCenter,
  validateSearch: (s: Record<string, unknown>) => ({
    sla:
      s.sla === "overdue" || s.sla === "soon_3" || s.sla === "soon_7"
        ? (s.sla as "overdue" | "soon_3" | "soon_7")
        : undefined,
  }),
});

function ActionsCenter() {
  const { agency, user } = useAuth();
  const urlSearch = Route.useSearch();
  const { clientId: scopeClientId, setClientId: setScopeClientId } =
    useOperationClientScope();
  const saved = loadSavedFilters();
  const [status, setStatus] = useState<string>(
    String(saved?.status ?? "pendente"),
  );
  const [sourceType, setSourceType] = useState<string>(
    String(saved?.sourceType ?? "all"),
  );
  const [priority, setPriority] = useState<string>(
    String(saved?.priority ?? "all"),
  );
  const [clientFilter, setClientFilter] = useState<string>(
    String(saved?.clientFilter ?? "all"),
  );
  const [slaFilter, setSlaFilter] = useState<SlaFilterType>(
    (saved?.slaFilter as SlaFilterType | undefined) ?? "all",
  );
  const [dueFrom, setDueFrom] = useState<string>(String(saved?.dueFrom ?? ""));
  const [dueTo, setDueTo] = useState<string>(String(saved?.dueTo ?? ""));
  const [sortDue, setSortDue] = useState<SortDueType>(
    (saved?.sortDue as SortDueType | undefined) ?? "none",
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAssignee, setBulkAssignee] = useState<string>("__none__");
  const [bulkStatus, setBulkStatus] = useState<string>("pendente");
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

  useEffect(() => {
    const u = urlSearch.sla;
    if (u === "overdue" || u === "soon_3" || u === "soon_7") {
      setSlaFilter(u);
    }
  }, [urlSearch.sla]);

  const scopeSyncReady = useRef(false);
  useEffect(() => {
    if (!scopeSyncReady.current) {
      scopeSyncReady.current = true;
      if (scopeClientId) setClientFilter(scopeClientId);
      return;
    }
    setClientFilter(scopeClientId ?? "all");
  }, [scopeClientId]);

  const onClientFilterChange = useCallback(
    (v: string) => {
      setClientFilter(v);
      setScopeClientId(v === "all" ? null : v);
    },
    [setScopeClientId],
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        ACTIONS_FILTERS_LS,
        JSON.stringify({
          status,
          sourceType,
          priority,
          clientFilter,
          slaFilter,
          dueFrom,
          dueTo,
          sortDue,
        }),
      );
    } catch {
      // ignore
    }
  }, [
    status,
    sourceType,
    priority,
    clientFilter,
    slaFilter,
    dueFrom,
    dueTo,
    sortDue,
  ]);

  const {
    data: actionsRows,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "action-center",
      agency?.id,
      status,
      sourceType,
      priority,
      clientFilter,
    ],
    enabled: !!agency,
    queryFn: async () => {
      let q = supabase
        .from("action_center")
        .select("*, clients(id, name)")
        .eq("agency_id", agency!.id)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(300);
      if (status !== "all") q = q.eq("status", status);
      if (sourceType !== "all") q = q.eq("source_type", sourceType);
      if (priority !== "all") q = q.eq("priority", priority);
      if (clientFilter !== "all") q = q.eq("client_id", clientFilter);

      const { data: rows, error } = await q;
      if (error) throw error;
      return rows ?? [];
    },
  });

  const { data: clients = [], isLoading: clientsLoading } =
    useAgencyClientsOptions(agency?.id);
  const { data: teammates = [], isLoading: teammatesLoading } =
    useAgencyTeammates(agency?.id);

  const headerCounts = useMemo(() => {
    const rows = (actionsRows ?? []) as ActionCenterRow[];
    let overdue = 0;
    let soon7 = 0;
    for (const a of rows) {
      if (isActionOverdue(a)) overdue++;
      if (dueWithinDays(a, 7)) soon7++;
    }
    return { total: rows.length, overdue, soon7 };
  }, [actionsRows]);

  const filtered = useMemo(() => {
    const rows = (actionsRows ?? []) as ActionCenterRow[];
    const passed = rows.filter((a) =>
      passesDueSla(a, slaFilter, dueFrom, dueTo),
    );
    return sortByDue(passed, sortDue);
  }, [actionsRows, slaFilter, dueFrom, dueTo, sortDue]);

  const idSet = useMemo(() => new Set(filtered.map((a) => a.id)), [filtered]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => idSet.has(id)));
  }, [idSet]);

  const { data: eventRows } = useQuery({
    queryKey: ["action-center-events", expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      const { data: ev, error } = await supabase
        .from("action_center_events")
        .select("id, event_type, payload, created_at")
        .eq("action_id", expandedId!)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return ev ?? [];
    },
  });

  const patchAction = useCallback(
    async (
      id: string,
      patch: Database["public"]["Tables"]["action_center"]["Update"],
      opts?: { silent?: boolean },
    ) => {
      const { error } = await supabase
        .from("action_center")
        .update(patch)
        .eq("id", id);
      if (error) {
        if (!opts?.silent) toast.error(error.message);
        return false;
      }
      if (!opts?.silent) {
        toast.success("Ação atualizada.");
        refetch();
      }
      return true;
    },
    [refetch],
  );

  const setAssignee = useCallback(
    async (actionId: string, userId: string) => {
      const value = userId === "" ? null : userId;
      await patchAction(actionId, { assigned_to: value });
    },
    [patchAction],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(filtered.map((a) => a.id));
  }, [filtered]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const applyBulkStatus = useCallback(async () => {
    if (!selectedIds.length) return;
    let ok = 0;
    for (const id of selectedIds) {
      const done = await patchAction(
        id,
        { status: bulkStatus },
        { silent: true },
      );
      if (done) ok++;
    }
    if (ok === selectedIds.length) {
      toast.success(`${ok} ações atualizadas.`);
      refetch();
      clearSelection();
    } else toast.error("Algumas atualizações falharam — verifique permissões.");
  }, [selectedIds, bulkStatus, patchAction, refetch, clearSelection]);

  const applyBulkAssignee = useCallback(async () => {
    if (!selectedIds.length) return;
    const value = bulkAssignee === "__none__" ? null : bulkAssignee;
    let ok = 0;
    for (const id of selectedIds) {
      const done = await patchAction(
        id,
        { assigned_to: value },
        { silent: true },
      );
      if (done) ok++;
    }
    if (ok === selectedIds.length) {
      toast.success(`${ok} responsáveis atualizados.`);
      refetch();
      clearSelection();
    } else toast.error("Algumas atualizações falharam — verifique permissões.");
  }, [selectedIds, bulkAssignee, patchAction, refetch, clearSelection]);

  const onToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const onPatchStatus = useCallback(
    (id: string, status: string) => {
      void patchAction(id, { status });
    },
    [patchAction],
  );

  if (
    isLoading ||
    clientsLoading ||
    teammatesLoading ||
    actionsRows === undefined
  )
    return <PageSkeleton preset="compact" />;

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((a) => selectedIds.includes(a.id));

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="Central de Ações"
        description={
          <>
            <span className="block">
              Priorize execução por cliente e origem (IA ou manual).
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Lista atual: {headerCounts.total} linhas · {headerCounts.overdue}{" "}
              atrasadas (SLA) · {headerCounts.soon7} com prazo em até 7 dias
            </span>
          </>
        }
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => exportActionsToCsv(filtered)}
          disabled={filtered.length === 0}
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
        <Link
          to="/clients"
          search={{ new: undefined }}
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver clientes
        </Link>
      </PageHeader>

      <FilterDrawer
        open={filtersSheetOpen}
        onOpenChange={setFiltersSheetOpen}
        title="Filtros"
        trigger={
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2"
            onClick={() => setFiltersSheetOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros da lista
          </Button>
        }
      >
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos estados</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="revisar_depois">Revisar depois</SelectItem>
            <SelectItem value="adiado">Adiado</SelectItem>
            <SelectItem value="feito">Feito</SelectItem>
            <SelectItem value="ignorado">Ignorado</SelectItem>
            <SelectItem value="enviado_cliente">Enviado ao cliente</SelectItem>
            <SelectItem value="anotacao">Anotação</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceType} onValueChange={setSourceType}>
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            <SelectItem value="alerta_ia">Alerta IA</SelectItem>
            <SelectItem value="relatorio_ia">Relatório IA</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="briefing">Briefing</SelectItem>
            <SelectItem value="auditoria_campanhas_ia">
              Auditoria campanhas IA
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <AgencyClientSelect
          clients={clients}
          value={clientFilter}
          onValueChange={onClientFilterChange}
          triggerClassName={FILTER_SELECT_TRIGGER_CLASSES.drawer}
          allLabel="Todos clientes"
        />
        <Select
          value={slaFilter}
          onValueChange={(v) => setSlaFilter(v as typeof slaFilter)}
        >
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Prazo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos prazos</SelectItem>
            <SelectItem value="overdue">Só atrasadas (SLA)</SelectItem>
            <SelectItem value="soon_3">Vence em até 3 dias</SelectItem>
            <SelectItem value="soon_7">Vence em até 7 dias</SelectItem>
            <SelectItem value="range">Intervalo de due date</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortDue}
          onValueChange={(v) => setSortDue(v as typeof sortDue)}
        >
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Ordenação: recentes</SelectItem>
            <SelectItem value="due_asc">Prazo crescente</SelectItem>
            <SelectItem value="due_desc">Prazo decrescente</SelectItem>
          </SelectContent>
        </Select>
        {slaFilter === "range" && (
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Due date entre</span>
            <input
              type="date"
              value={dueFrom}
              onChange={(e) => setDueFrom(e.target.value)}
              className="h-11 rounded-md border border-border bg-background px-3 text-sm"
            />
            <span className="text-muted-foreground">e</span>
            <input
              type="date"
              value={dueTo}
              onChange={(e) => setDueTo(e.target.value)}
              className="h-11 rounded-md border border-border bg-background px-3 text-sm"
            />
          </div>
        )}
      </FilterDrawer>

      <div className="hidden flex-wrap gap-2 md:flex">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[min(100%,220px)] shrink-0">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos estados</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="revisar_depois">Revisar depois</SelectItem>
            <SelectItem value="adiado">Adiado</SelectItem>
            <SelectItem value="feito">Feito</SelectItem>
            <SelectItem value="ignorado">Ignorado</SelectItem>
            <SelectItem value="enviado_cliente">Enviado ao cliente</SelectItem>
            <SelectItem value="anotacao">Anotação</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceType} onValueChange={setSourceType}>
          <SelectTrigger className="h-9 w-[min(100%,200px)] shrink-0">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            <SelectItem value="alerta_ia">Alerta IA</SelectItem>
            <SelectItem value="relatorio_ia">Relatório IA</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="briefing">Briefing</SelectItem>
            <SelectItem value="auditoria_campanhas_ia">
              Auditoria campanhas IA
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-9 w-[min(100%,200px)] shrink-0">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <AgencyClientSelect
          clients={clients}
          value={clientFilter}
          onValueChange={onClientFilterChange}
          triggerClassName={FILTER_SELECT_TRIGGER_CLASSES.barClient}
          allLabel="Todos clientes"
        />
        <Select
          value={slaFilter}
          onValueChange={(v) => setSlaFilter(v as typeof slaFilter)}
        >
          <SelectTrigger className="h-9 w-[min(100%,220px)] shrink-0">
            <SelectValue placeholder="Prazo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos prazos</SelectItem>
            <SelectItem value="overdue">Só atrasadas (SLA)</SelectItem>
            <SelectItem value="soon_3">Vence em até 3 dias</SelectItem>
            <SelectItem value="soon_7">Vence em até 7 dias</SelectItem>
            <SelectItem value="range">Intervalo de due date</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortDue}
          onValueChange={(v) => setSortDue(v as typeof sortDue)}
        >
          <SelectTrigger className="h-9 w-[min(100%,200px)] shrink-0">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Ordenação: recentes</SelectItem>
            <SelectItem value="due_asc">Prazo crescente</SelectItem>
            <SelectItem value="due_desc">Prazo decrescente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {slaFilter === "range" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Due date entre</span>
          <input
            type="date"
            value={dueFrom}
            onChange={(e) => setDueFrom(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          />
          <span className="text-muted-foreground">e</span>
          <input
            type="date"
            value={dueTo}
            onChange={(e) => setDueTo(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          />
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.length} selecionadas</span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="feito">Feito</SelectItem>
              <SelectItem value="ignorado">Ignorado</SelectItem>
              <SelectItem value="adiado">Adiado</SelectItem>
              <SelectItem value="anotacao">Anotação</SelectItem>
              <SelectItem value="enviado_cliente">Enviado cliente</SelectItem>
              <SelectItem value="revisar_depois">Revisar depois</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={applyBulkStatus}
          >
            Aplicar estado
          </Button>
          <select
            value={bulkAssignee}
            onChange={(e) => setBulkAssignee(e.target.value)}
            className="h-8 w-[180px] rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="__none__">Sem responsável</option>
            {user?.id && <option value={user.id}>Eu</option>}
            {teammates
              .filter((t) => t.id !== user?.id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.display_name || t.email}
                </option>
              ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={applyBulkAssignee}
          >
            Atribuir responsável
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearSelection}
          >
            Limpar seleção
          </Button>
        </div>
      )}

      <Card>
        {filtered.length === 0 ? (
          <Empty
            label="Nenhuma ação para os filtros."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus("all");
                  setSourceType("all");
                  setPriority("all");
                  setClientFilter("all");
                  setSlaFilter("all");
                  setSortDue("none");
                  setDueFrom("");
                  setDueTo("");
                }}
              >
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border">
            <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={(c) =>
                  c === true ? selectAllVisible() : clearSelection()
                }
                aria-label="Selecionar todas visíveis"
              />
              <span>Selecionar todas nesta vista ({filtered.length})</span>
            </div>
            {filtered.map((a: ActionCenterRow) => (
              <ActionCenterListRow
                key={a.id}
                action={a}
                teammates={teammates}
                currentUserId={user?.id}
                selected={selectedIds.includes(a.id)}
                expanded={expandedId === a.id}
                overdue={isActionOverdue(a)}
                eventRows={expandedId === a.id ? (eventRows ?? []) : []}
                onToggleSelect={toggleSelect}
                onToggleExpand={onToggleExpand}
                onPatchStatus={onPatchStatus}
                onAssignee={setAssignee}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
