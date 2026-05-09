import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/format";
import { Card, Empty, PageSkeleton } from "./dashboard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/actions")({
  component: ActionsCenter,
});

function ActionsCenter() {
  const { agency, user } = useAuth();
  const [status, setStatus] = useState<string>("pendente");
  const [sourceType, setSourceType] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

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

  const filtered = useMemo(() => data?.actions ?? [], [data?.actions]);

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
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="all">Todos estados</option>
          <option value="pendente">Pendente</option>
          <option value="revisar_depois">Revisar depois</option>
          <option value="adiado">Adiado</option>
          <option value="feito">Feito</option>
          <option value="ignorado">Ignorado</option>
          <option value="enviado_cliente">Enviado ao cliente</option>
          <option value="anotacao">Anotação</option>
        </select>
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="all">Todas origens</option>
          <option value="alerta_ia">Alerta IA</option>
          <option value="relatorio_ia">Relatório IA</option>
          <option value="manual">Manual</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="briefing">Briefing</option>
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="all">Todas prioridades</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-9 min-w-[160px] rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="all">Todos clientes</option>
          {data.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <Empty label="Nenhuma ação para os filtros." />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((a: any) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{a.title}</span>
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {a.source_type}
                    </span>
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {a.priority}
                    </span>
                    {a.clients?.name && (
                      <Link
                        to="/clients/$clientId"
                        params={{ clientId: a.client_id }}
                        className="text-[11px] text-primary hover:underline"
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
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{timeAgo(a.created_at)}</span>
                    {a.due_date && <span>Prazo {a.due_date}</span>}
                    <label className="flex items-center gap-1">
                      Responsável
                      <select
                        value={a.assigned_to ?? ""}
                        onChange={(e) => setAssignee(a.id, e.target.value)}
                        className="h-7 max-w-[160px] rounded border border-border bg-background px-1 text-[11px]"
                      >
                        <option value="">—</option>
                        {user?.id && <option value={user.id}>Eu</option>}
                        {data.teammates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.display_name || t.email}
                          </option>
                        ))}
                      </select>
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
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
