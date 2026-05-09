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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
            <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-muted-foreground">
              {a.type}
            </span>
            {a.clients?.name && (
              <span className="text-xs text-muted-foreground">
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
          <div className="mt-2 flex flex-col gap-1.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{timeAgo(a.created_at)}</span>
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
                <SelectTrigger className="h-8 max-w-[180px] text-xs">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {(teammates ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.display_name || t.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
        </div>
        {a.status === "open" && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => createActionFromAlert(a)}
            >
              Virar ação
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => resolve(a.id)}
            >
              Resolver
            </Button>
          </div>
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

  async function createActionFromAlert(a: any) {
    const sb = supabase as any;
    const { error } = await sb.from("action_center").insert({
      agency_id: agency!.id,
      client_id: a.client_id ?? null,
      source_type: "alerta_ia",
      source_ref_id: a.id,
      title: a.title,
      description: a.recommended_action || a.description || null,
      priority:
        a.priority === "critical"
          ? "critica"
          : a.priority === "high"
            ? "alta"
            : a.priority === "medium"
              ? "media"
              : "baixa",
      status: "pendente",
      due_date: new Date().toISOString().slice(0, 10),
      assigned_to: a.assigned_to ?? null,
      metadata: { from: "alerts-ui", alert_type: a.type },
    });
    if (error) toast.error(error.message);
    else toast.success("Ação criada na Central de Ações.");
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
            <Button
              key={f}
              type="button"
              variant={filter === f ? "default" : "ghost"}
              size="sm"
              className="text-xs"
              onClick={() => setFilter(f)}
            >
              {f === "open"
                ? "Abertos"
                : f === "resolved"
                  ? "Resolvidos"
                  : "Todos"}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleDesktopNotifications}
        >
          {desktopNotifications
            ? "Notificações no desktop ativas"
            : "Ativar notificações no desktop"}
        </Button>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar título, cliente ou descrição..."
          className="h-9 min-w-[200px] flex-1"
        />
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-9 w-[min(100%,200px)] shrink-0">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="high">Alto</SelectItem>
            <SelectItem value="medium">Médio</SelectItem>
            <SelectItem value="low">Baixo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="h-9 min-w-[160px] max-w-[280px] shrink-0">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos clientes</SelectItem>
            {(clientOptions ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="h-9 min-w-[160px] max-w-[260px] shrink-0">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            <SelectItem value="unassigned">Sem responsável</SelectItem>
            {user?.id && <SelectItem value="me">Atribuídos a mim</SelectItem>}
            {(teammates ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.display_name || t.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={groupBy}
          onValueChange={(v) => setGroupBy(v as "none" | "client")}
        >
          <SelectTrigger className="h-9 min-w-[160px] shrink-0">
            <SelectValue placeholder="Visualização" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Lista única</SelectItem>
            <SelectItem value="client">Agrupar por cliente</SelectItem>
          </SelectContent>
        </Select>
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
