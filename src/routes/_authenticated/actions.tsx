import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/format";
import { Card, Empty, PageSkeleton } from "./dashboard";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SLA_OPEN_STATUSES = new Set([
  "pendente",
  "revisar_depois",
  "adiado",
  "anotacao",
  "enviado_cliente",
]);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isActionOverdue(a: { due_date?: string | null; status?: string }) {
  if (!a.due_date || !a.status || !SLA_OPEN_STATUSES.has(a.status))
    return false;
  return a.due_date < todayISO();
}

export const Route = createFileRoute("/_authenticated/actions")({
  component: ActionsCenter,
});

function ActionsCenter() {
  const { agency, user } = useAuth();
  const [status, setStatus] = useState<string>("pendente");
  const [sourceType, setSourceType] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [slaFilter, setSlaFilter] = useState<"all" | "overdue">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
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
      const sb = supabase as any;
      let q = sb
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

      const [{ data: rows }, { data: clients }] = await Promise.all([
        q,
        supabase
          .from("clients")
          .select("id, name")
          .eq("agency_id", agency!.id)
          .order("name"),
      ]);
      const { data: teammates } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("agency_id", agency!.id)
        .order("display_name");
      return {
        actions: rows ?? [],
        clients: clients ?? [],
        teammates: teammates ?? [],
      };
    },
  });

  const filtered = useMemo(() => {
    const rows = data?.actions ?? [];
    if (slaFilter === "overdue")
      return rows.filter((a: any) => isActionOverdue(a));
    return rows;
  }, [data?.actions, slaFilter]);

  const { data: eventRows } = useQuery({
    queryKey: ["action-center-events", expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      const sb = supabase as any;
      const { data: ev, error } = await sb
        .from("action_center_events")
        .select("id, event_type, payload, created_at")
        .eq("action_id", expandedId!)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return ev ?? [];
    },
  });

  async function patchAction(id: string, patch: Record<string, unknown>) {
    const sb = supabase as any;
    const { error } = await sb.from("action_center").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Ação atualizada.");
      refetch();
    }
  }

  async function setAssignee(actionId: string, userId: string) {
    const value = userId === "" ? null : userId;
    await patchAction(actionId, { assigned_to: value });
  }

  if (isLoading || !data) return <PageSkeleton preset="compact" />;

  return (
    <div className="space-y-5 p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Central de Ações
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Priorize execução por cliente e origem (IA ou manual).
          </p>
        </div>
        <Link
          to="/clients"
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver clientes
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
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
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="h-9 min-w-[160px] max-w-[280px] shrink-0">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos clientes</SelectItem>
            {data.clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={slaFilter}
          onValueChange={(v) =>
            setSlaFilter(v === "overdue" ? "overdue" : "all")
          }
        >
          <SelectTrigger className="h-9 w-[min(100%,200px)] shrink-0">
            <SelectValue placeholder="Prazo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos prazos</SelectItem>
            <SelectItem value="overdue">Só atrasadas (SLA)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <Empty label="Nenhuma ação para os filtros." />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((a: any) => (
              <div key={a.id}>
                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
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
                            {data.teammates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.display_name || t.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
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
