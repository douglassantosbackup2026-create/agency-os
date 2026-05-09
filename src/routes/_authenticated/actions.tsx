import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import { SlidersHorizontal } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { ACTION_CENTER_OPEN_STATUSES_SET } from "@/lib/action-center-status";
import { FILTER_SELECT_TRIGGER_CLASSES } from "@/lib/ui/filter-classes";

type ActionCenterRow = Database["public"]["Tables"]["action_center"]["Row"] & {
  clients?: { id: string; name: string } | null;
};

const ACTIONS_FILTERS_LS = "action-center-filters-v1";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isActionOverdue(a: { due_date?: string | null; status?: string }) {
  if (!a.due_date || !a.status || !ACTION_CENTER_OPEN_STATUSES_SET.has(a.status))
    return false;
  return a.due_date < todayISO();
}

function dueWithinDays(
  a: { due_date?: string | null; status?: string },
  days: number,
) {
  if (!a.due_date || !a.status || !ACTION_CENTER_OPEN_STATUSES_SET.has(a.status))
    return false;
  const t = todayISO();
  const limit = addDaysISO(days);
  return a.due_date >= t && a.due_date <= limit;
}

function passesDueSla(
  a: ActionCenterRow,
  slaFilter: "all" | "overdue" | "soon_3" | "soon_7" | "range",
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

function sortByDue(
  rows: ActionCenterRow[],
  sortDue: "none" | "due_asc" | "due_desc",
) {
  if (sortDue === "none") return rows;
  const far = sortDue === "due_asc" ? "9999-12-31" : "0000-01-01";
  return [...rows].sort((a, b) => {
    const da = a.due_date ?? far;
    const db = b.due_date ?? far;
    return sortDue === "due_asc" ? da.localeCompare(db) : db.localeCompare(da);
  });
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
});

function ActionsCenter() {
  const { agency, user } = useAuth();
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
  const [slaFilter, setSlaFilter] = useState<
    "all" | "overdue" | "soon_3" | "soon_7" | "range"
  >((saved?.slaFilter as typeof slaFilter) ?? "all");
  const [dueFrom, setDueFrom] = useState<string>(String(saved?.dueFrom ?? ""));
  const [dueTo, setDueTo] = useState<string>(String(saved?.dueTo ?? ""));
  const [sortDue, setSortDue] = useState<"none" | "due_asc" | "due_desc">(
    (saved?.sortDue as typeof sortDue) ?? "none",
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAssignee, setBulkAssignee] = useState<string>("__none__");
  const [bulkStatus, setBulkStatus] = useState<string>("pendente");
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

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

  const { data: actionsRows, isLoading, refetch } = useQuery({
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

  async function patchAction(
    id: string,
    patch: Database["public"]["Tables"]["action_center"]["Update"],
    opts?: { silent?: boolean },
  ) {
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
  }

  async function setAssignee(actionId: string, userId: string) {
    const value = userId === "" ? null : userId;
    await patchAction(actionId, { assigned_to: value });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectAllVisible() {
    setSelectedIds(filtered.map((a) => a.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function applyBulkStatus() {
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
  }

  async function applyBulkAssignee() {
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
  }

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
        <Link
          to="/clients"
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
                <SelectItem value="enviado_cliente">
                  Enviado ao cliente
                </SelectItem>
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
              onValueChange={setClientFilter}
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
          onValueChange={setClientFilter}
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
          <Select value={bulkAssignee} onValueChange={setBulkAssignee}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem responsável</SelectItem>
              {user?.id && <SelectItem value={user.id}>Eu</SelectItem>}
              {teammates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.display_name || t.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <div key={a.id}>
                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="pt-0.5">
                      <Checkbox
                        checked={selectedIds.includes(a.id)}
                        onCheckedChange={() => toggleSelect(a.id)}
                        aria-label={`Selecionar ${a.title}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{a.title}</span>
                        {isActionOverdue(a) && (
                          <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-xs font-medium text-destructive">
                            Atrasada
                          </span>
                        )}
                        <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-muted-foreground">
                          {a.source_type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {a.priority}
                        </span>
                        {a.clients?.name && (
                          <Link
                            to="/clients/$clientId"
                            params={{ clientId: a.client_id }}
                            className="text-sm text-primary hover:underline"
                          >
                            {a.clients.name}
                          </Link>
                        )}
                      </div>
                      {a.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{timeAgo(a.created_at)}</span>
                        {a.due_date && <span>Prazo {a.due_date}</span>}
                        {Number(a.metadata?.merge_count) > 0 && (
                          <span title="Mesclagens por dedupe">
                            Mesclas {a.metadata.merge_count}
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() =>
                            setExpandedId(expandedId === a.id ? null : a.id)
                          }
                        >
                          {expandedId === a.id
                            ? "Ocultar histórico"
                            : "Histórico"}
                        </Button>
                        <label className="flex items-center gap-2 font-normal">
                          <span className="shrink-0 text-muted-foreground">
                            Responsável
                          </span>
                          <Select
                            value={a.assigned_to ?? "__none__"}
                            onValueChange={(v) =>
                              setAssignee(a.id, v === "__none__" ? "" : v)
                            }
                          >
                            <SelectTrigger className="h-7 max-w-[160px] text-xs">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {user?.id && (
                                <SelectItem value={user.id}>Eu</SelectItem>
                              )}
                              {teammates.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.display_name || t.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <select
                      value={a.status}
                      onChange={(e) =>
                        patchAction(a.id, { status: e.target.value })
                      }
                      className="h-8 rounded border border-border bg-background px-2 text-xs"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="feito">Feito</option>
                      <option value="ignorado">Ignorado</option>
                      <option value="adiado">Adiado</option>
                      <option value="anotacao">Anotação</option>
                      <option value="enviado_cliente">Enviado cliente</option>
                      <option value="revisar_depois">Revisar depois</option>
                    </select>
                  </div>
                </div>
                {expandedId === a.id && (
                  <div className="border-t border-border px-4 pb-3 pt-2">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Histórico da ação
                    </div>
                    {!eventRows?.length ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sem eventos registrados.
                      </p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {eventRows.map((ev: any) => (
                          <li key={ev.id} className="flex flex-wrap gap-x-2">
                            <span>{timeAgo(ev.created_at)}</span>
                            <span className="font-medium text-foreground">
                              {ev.event_type === "created"
                                ? "Criada"
                                : ev.event_type === "status_change"
                                  ? "Estado"
                                  : ev.event_type === "assignee_change"
                                    ? "Responsável"
                                    : ev.event_type}
                            </span>
                            <span className="truncate font-mono text-[10px]">
                              {JSON.stringify(ev.payload)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
