import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/format";
import {
  Card,
  CardHeader,
  Empty,
  PageSkeleton,
  PriorityDot,
} from "./dashboard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/alerts")({
  component: Alerts,
});

function Alerts() {
  const { agency, user } = useAuth();
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"none" | "client">("none");
  const [desktopNotifications, setDesktopNotifications] = useState<boolean>(
    () => {
      try {
        return localStorage.getItem("alerts-desktop-notifications") === "1";
      } catch {
        return false;
      }
    },
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["alerts", agency?.id, filter],
    enabled: !!agency,
    queryFn: async () => {
      let q = supabase
        .from("alerts")
        .select("*, clients(name)")
        .eq("agency_id", agency!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "all") q = q.eq("status", filter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: clientOptions } = useQuery({
    queryKey: ["alert-filter-clients", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("agency_id", agency!.id)
        .order("name");
      return data ?? [];
    },
  });

  const { data: teammates } = useQuery({
    queryKey: ["alert-teammates", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("agency_id", agency!.id)
        .order("display_name");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((a: any) => {
      if (priority !== "all" && a.priority !== priority) return false;
      if (clientFilter !== "all" && a.client_id !== clientFilter) return false;
      if (assigneeFilter === "unassigned" && a.assigned_to) return false;
      if (assigneeFilter === "me" && user?.id && a.assigned_to !== user.id)
        return false;
      if (
        assigneeFilter !== "all" &&
        assigneeFilter !== "unassigned" &&
        assigneeFilter !== "me" &&
        a.assigned_to !== assigneeFilter
      )
        return false;
      if (!q) return true;
      const title = (a.title ?? "").toLowerCase();
      const desc = (a.description ?? "").toLowerCase();
      const client = (a.clients?.name ?? "").toLowerCase();
      return title.includes(q) || desc.includes(q) || client.includes(q);
    });
  }, [data, search, priority, clientFilter, assigneeFilter, user?.id]);

  const groupedByClient = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const a of filtered) {
      const name =
        (a as { clients?: { name?: string } }).clients?.name ?? "Sem cliente";
      const arr = m.get(name) ?? [];
      arr.push(a);
      m.set(name, arr);
    }
    return [...m.entries()].sort(([na], [nb]) => na.localeCompare(nb, "pt-BR"));
  }, [filtered]);

  useEffect(() => {
    if (!agency) return;
    const ch = supabase
      .channel(`alerts:${agency.id}`)
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
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [agency, refetch]);

  useEffect(() => {
    if (!agency || !desktopNotifications) return;
    const ch = supabase
      .channel(`alerts-notify:${agency.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
          filter: `agency_id=eq.${agency.id}`,
        },
        (payload) => {
          const row = payload.new as { title?: string; description?: string };
          if (Notification.permission === "granted") {
            new Notification(row.title ?? "Novo alerta", {
              body: row.description ?? "Há um novo alerta na operação.",
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [agency, desktopNotifications]);

  async function toggleDesktopNotifications() {
    const next = !desktopNotifications;
    if (
      next &&
      "Notification" in window &&
      Notification.permission !== "granted"
    ) {
      await Notification.requestPermission();
    }
    const enabled =
      next && "Notification" in window && Notification.permission === "granted";
    setDesktopNotifications(enabled);
    try {
      localStorage.setItem("alerts-desktop-notifications", enabled ? "1" : "0");
    } catch {
      // ignore
    }
    toast.success(
      enabled ? "Notificações ativadas." : "Notificações desativadas.",
    );
  }

  if (isLoading || !data) return <PageSkeleton preset="compact" />;

  function alertRow(a: (typeof filtered)[number]) {
    return (
      <div key={a.id} className="flex items-start gap-3 px-4 py-3">
        <PriorityDot p={a.priority} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{a.title}</span>
            <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
              {a.type}
            </span>
            {a.clients?.name && (
              <span className="text-[11px] text-muted-foreground">
                · {a.clients.name}
              </span>
            )}
          </div>
          {a.description && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {a.description}
            </div>
          )}
          {a.recommended_action && (
            <div className="mt-1 text-xs text-primary">
              → {a.recommended_action}
            </div>
          )}
          <div className="mt-2 flex flex-col gap-1.5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{timeAgo(a.created_at)}</span>
            <label className="flex items-center gap-1 font-normal">
              <span className="shrink-0 text-[10px] uppercase tracking-wide">
                Responsável
              </span>
              <select
                value={a.assigned_to ?? ""}
                onChange={(e) => setAssignee(a.id, e.target.value)}
                className="h-8 max-w-[180px] rounded border border-border bg-background px-1.5 text-[11px] text-foreground"
              >
                <option value="">—</option>
                {(teammates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.display_name || t.email}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {a.status === "open" && (
          <button
            type="button"
            onClick={() => resolve(a.id)}
            className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs transition hover:bg-surface-2"
          >
            Resolver
          </button>
        )}
      </div>
    );
  }

  async function resolve(id: string) {
    const { error } = await supabase
      .from("alerts")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Alerta resolvido.");
      refetch();
    }
  }

  async function setAssignee(alertId: string, userId: string) {
    const value = userId === "" ? null : userId;
    const { error } = await supabase
      .from("alerts")
      .update({ assigned_to: value })
      .eq("id", alertId);
    if (error) toast.error(error.message);
    else {
      toast.success(value ? "Responsável atualizado." : "Atribuição removida.");
      refetch();
    }
  }

  return (
    <div className="space-y-5 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Central de alertas
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filtered.length} exibidos · {data.length} no total
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-1">
          {(["open", "resolved", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1.5 text-xs ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f === "open"
                ? "Abertos"
                : f === "resolved"
                  ? "Resolvidos"
                  : "Todos"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleDesktopNotifications}
          className="rounded-md border border-border px-3 py-2 text-xs hover:bg-surface"
        >
          {desktopNotifications ? "Desktop ON" : "Ativar notificações desktop"}
        </button>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar título, cliente ou descrição..."
          className="h-9 min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 text-sm"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="all">Todas prioridades</option>
          <option value="critical">Crítico</option>
          <option value="high">Alto</option>
          <option value="medium">Médio</option>
          <option value="low">Baixo</option>
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-9 min-w-[160px] rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="all">Todos clientes</option>
          {(clientOptions ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="h-9 min-w-[160px] rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="all">Todos responsáveis</option>
          <option value="unassigned">Sem responsável</option>
          {user?.id && <option value="me">Atribuídos a mim</option>}
          {(teammates ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.display_name || t.email}
            </option>
          ))}
        </select>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as "none" | "client")}
          className="h-9 min-w-[140px] rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="none">Lista única</option>
          <option value="client">Agrupar por cliente</option>
        </select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <Empty label="Sem alertas para os filtros atuais." />
        ) : groupBy === "none" ? (
          <div className="divide-y divide-border">
            {filtered.map((a) => alertRow(a))}
          </div>
        ) : (
          <Accordion type="multiple" className="px-2">
            {groupedByClient.map(([clientName, items]) => (
              <AccordionItem key={clientName} value={clientName}>
                <AccordionTrigger className="py-3 text-sm hover:no-underline">
                  <span>{clientName}</span>
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({items.length})
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-0 pt-0">
                  <div className="divide-y divide-border rounded-md border border-border">
                    {items.map((a) => alertRow(a))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </Card>
    </div>
  );
}
