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
} from "@/components/operational-ui";
import { FilterDrawer } from "@/components/filter-drawer";
import { AgencyClientSelect } from "@/components/agency-client-select";
import { PageHeader } from "@/components/page-header";
import { useAgencyClientsOptions } from "@/hooks/use-agency-clients-options";
import { useAgencyTeammates } from "@/hooks/use-agency-teammates";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";
import { FILTER_SELECT_TRIGGER_CLASSES } from "@/lib/ui/filter-classes";

export const Route = createFileRoute("/_authenticated/alerts")({
  component: Alerts,
});

/** Stable fallback — avoids new [] each render (react-hooks/exhaustive-deps). */
const EMPTY_ALERTS_LIST: unknown[] = [];

function Alerts() {
  const { agency, user } = useAuth();
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"none" | "client">("none");
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
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
      const [{ data: rows }, { data: prefs }] = await Promise.all([
        q,
        supabase
          .from("client_whatsapp_prefs")
          .select("client_id, mute_whatsapp_until")
          .eq("agency_id", agency!.id),
      ]);
      return {
        alerts: rows ?? [],
        waPrefs: prefs ?? [],
      };
    },
  });

  const alerts = data?.alerts ?? EMPTY_ALERTS_LIST;
  const waMuteUntil = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of data?.waPrefs ?? []) {
      const cid = p.client_id as string | undefined;
      const until = p.mute_whatsapp_until as string | null | undefined;
      if (cid && until) m.set(cid, until);
    }
    return m;
  }, [data?.waPrefs]);

  const { data: clients = [], isLoading: clientsLoading } =
    useAgencyClientsOptions(agency?.id);
  const { data: teammates = [], isLoading: teammatesLoading } =
    useAgencyTeammates(agency?.id);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter((a: any) => {
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
  }, [alerts, search, priority, clientFilter, assigneeFilter, user?.id]);

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

  if (
    isLoading ||
    clientsLoading ||
    teammatesLoading ||
    !data
  )
    return <PageSkeleton preset="compact" />;

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
            {a.client_id &&
              waMuteUntil.get(String(a.client_id)) &&
              new Date(waMuteUntil.get(String(a.client_id))!).getTime() >
                Date.now() && (
                <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                  WhatsApp silenciado até{" "}
                  {new Date(
                    waMuteUntil.get(String(a.client_id))!,
                  ).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
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
            {a.client_id && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                title="Não sugerir WhatsApp automático por 24h para este cliente"
                onClick={() => muteWhatsapp24h(String(a.client_id))}
              >
                Silenciar WhatsApp 24h
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  async function muteWhatsapp24h(clientId: string) {
    if (!agency) return;
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("client_whatsapp_prefs").upsert(
      {
        agency_id: agency.id,
        client_id: clientId,
        mute_whatsapp_until: until,
      },
      { onConflict: "agency_id,client_id" },
    );
    if (error) toast.error(error.message);
    else {
      toast.success(
        "Preferência guardada: alertas novos não marcarão envio WhatsApp automático nas próximas 24h.",
      );
      refetch();
    }
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

  async function createActionFromAlert(
    a: Database["public"]["Tables"]["alerts"]["Row"],
  ) {
    const { error } = await supabase.from("action_center").insert({
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
      <PageHeader
        className="gap-4 sm:items-start"
        title="Central de alertas"
        description={`${filtered.length} exibidos · ${alerts.length} no total`}
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
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
        </div>
      </PageHeader>

      <FilterDrawer
        open={filtersSheetOpen}
        onOpenChange={setFiltersSheetOpen}
        title="Busca e filtros"
        applyLabel="Fechar"
        trigger={
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2"
            onClick={() => setFiltersSheetOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Busca e filtros
          </Button>
        }
      >
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar título, cliente ou descrição..."
              className="h-11 min-h-[44px]"
            />
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASSES.drawer}>
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
            <AgencyClientSelect
              clients={clients}
              value={clientFilter}
              onValueChange={setClientFilter}
              triggerClassName={FILTER_SELECT_TRIGGER_CLASSES.drawer}
              allLabel="Todos clientes"
            />
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASSES.drawer}>
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos responsáveis</SelectItem>
                <SelectItem value="unassigned">Sem responsável</SelectItem>
                {user?.id && (
                  <SelectItem value="me">Atribuídos a mim</SelectItem>
                )}
                {teammates.map((t) => (
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
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASSES.drawer}>
                <SelectValue placeholder="Visualização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Lista única</SelectItem>
                <SelectItem value="client">Agrupar por cliente</SelectItem>
              </SelectContent>
            </Select>
      </FilterDrawer>

      <div className="hidden md:flex md:flex-row md:flex-wrap md:items-center md:gap-2">
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
        <AgencyClientSelect
          clients={clients}
          value={clientFilter}
          onValueChange={setClientFilter}
          triggerClassName={FILTER_SELECT_TRIGGER_CLASSES.barClient}
          allLabel="Todos clientes"
        />
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="h-9 min-w-[160px] max-w-[260px] shrink-0">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            <SelectItem value="unassigned">Sem responsável</SelectItem>
            {user?.id && <SelectItem value="me">Atribuídos a mim</SelectItem>}
            {teammates.map((t) => (
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
          <Empty
            label="Sem alertas para os filtros atuais."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setPriority("all");
                  setClientFilter("all");
                  setAssigneeFilter("all");
                  setGroupBy("none");
                  setFilter("open");
                }}
              >
                Repor filtros
              </Button>
            }
          />
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
