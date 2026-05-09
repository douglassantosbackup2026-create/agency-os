import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardHeader,
  Empty,
  PageSkeleton,
  PriorityDot,
} from "@/components/operational-ui";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useOperationClientScope } from "@/hooks/use-operation-client-scope";
import {
  ACTION_CENTER_OPEN_STATUSES,
} from "@/lib/action-center-status";
import {
  syncLabelForCockpit,
  hoursSinceSync,
  SYNC_CRITICAL_HOURS,
} from "@/lib/sync-freshness";
import { toast } from "sonner";
import { throwIfSupabaseError } from "@/lib/supabase-result";
import { Bell, Database, ListTodo } from "lucide-react";

export const Route = createFileRoute("/_authenticated/standup")({
  component: StandupPage,
});

type StandupItem =
  | {
      kind: "sla_action";
      key: string;
      title: string;
      subtitle: string;
      href: string;
    }
  | {
      kind: "critical_alert";
      key: string;
      title: string;
      subtitle: string;
      href: string;
    }
  | {
      kind: "stale_sync";
      key: string;
      title: string;
      subtitle: string;
      href: string;
    };

function endOfTodayUtc(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function tomorrowMorningUtc(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d;
}

function StandupPage() {
  const { agency, user } = useAuth();
  const queryClient = useQueryClient();
  const { clientId: scopeClientId } = useOperationClientScope();

  const { data, isLoading } = useQuery({
    queryKey: ["standup", agency?.id, user?.id],
    enabled: !!agency?.id && !!user?.id,
    queryFn: async () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const [
        actionsRes,
        alertsRes,
        syncRes,
        clientsRes,
        snoozeRes,
      ] = await Promise.all([
        supabase
          .from("action_center")
          .select("id, title, due_date, client_id, priority, clients(name)")
          .eq("agency_id", agency!.id)
          .in("status", [...ACTION_CENTER_OPEN_STATUSES])
          .not("due_date", "is", null)
          .lte("due_date", todayIso)
          .limit(80),
        supabase
          .from("alerts")
          .select("id, title, priority, client_id, clients(name)")
          .eq("agency_id", agency!.id)
          .eq("status", "open")
          .eq("priority", "critical")
          .limit(80),
        supabase
          .from("sync_runs")
          .select("client_id, status, created_at")
          .eq("agency_id", agency!.id)
          .not("client_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(600),
        supabase
          .from("clients")
          .select("id, name")
          .eq("agency_id", agency!.id)
          .limit(500),
        supabase
          .from("standup_snoozes")
          .select("item_key, hidden_until")
          .eq("agency_id", agency!.id)
          .eq("user_id", user!.id),
      ]);
      throwIfSupabaseError(actionsRes.error, "standup.actions");
      throwIfSupabaseError(alertsRes.error, "standup.alerts");
      throwIfSupabaseError(syncRes.error, "standup.sync");
      throwIfSupabaseError(clientsRes.error, "standup.clients");
      throwIfSupabaseError(snoozeRes.error, "standup.snoozes");

      const latestSyncByClient = new Map<
        string,
        { status: string; created_at: string }
      >();
      for (const s of syncRes.data ?? []) {
        const cid = s.client_id as string | null;
        if (!cid || latestSyncByClient.has(cid)) continue;
        latestSyncByClient.set(cid, {
          status: String(s.status ?? ""),
          created_at: String(s.created_at ?? ""),
        });
      }

      return {
        overdueActions: actionsRes.data ?? [],
        criticalAlerts: alertsRes.data ?? [],
        latestSyncByClient,
        clients: clientsRes.data ?? [],
        snoozes: snoozeRes.data ?? [],
      };
    },
  });

  const hiddenUntilByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of data?.snoozes ?? []) {
      m.set(String(row.item_key), String(row.hidden_until));
    }
    return m;
  }, [data?.snoozes]);

  const items = useMemo((): StandupItem[] => {
    if (!data) return [];
    const now = Date.now();
    const list: StandupItem[] = [];

    for (const a of data.overdueActions) {
      const cid = a.client_id as string | null;
      if (scopeClientId && cid !== scopeClientId) continue;
      list.push({
        kind: "sla_action",
        key: `sla:${a.id}`,
        title: String(a.title ?? "Ação"),
        subtitle: `${(a.clients as { name?: string } | null)?.name ?? "Cliente"} · prazo ${a.due_date}`,
        href: cid ? `/clients/${cid}` : "/actions",
      });
    }
    for (const al of data.criticalAlerts) {
      const cid = al.client_id as string | null;
      if (scopeClientId && cid !== scopeClientId) continue;
      list.push({
        kind: "critical_alert",
        key: `alert:${al.id}`,
        title: String(al.title ?? "Alerta"),
        subtitle: `${(al.clients as { name?: string } | null)?.name ?? "Cliente"} · crítico`,
        href: cid ? `/clients/${cid}` : "/alerts",
      });
    }
    const clientIds = scopeClientId
      ? [scopeClientId]
      : data.clients.map((c) => c.id);
    for (const cid of clientIds) {
      const sync = data.latestSyncByClient.get(cid);
      const h = hoursSinceSync(sync?.created_at);
      const level = syncLabelForCockpit(sync?.status, sync?.created_at);
      if (
        level.level === "critical" ||
        level.level === "error" ||
        (h != null && h >= SYNC_CRITICAL_HOURS)
      ) {
        const name =
          data.clients.find((c) => c.id === cid)?.name ?? "Cliente";
        list.push({
          kind: "stale_sync",
          key: `sync:${cid}`,
          title: `Sync desatualizado — ${name}`,
          subtitle: sync
            ? `${level.primaryLine} · último registo`
            : "Sem histórico de sync para este cliente.",
          href: `/clients/${cid}`,
        });
      }
    }

    return list.filter((it) => {
      const until = hiddenUntilByKey.get(it.key);
      if (!until) return true;
      return new Date(until).getTime() <= now;
    });
  }, [data, scopeClientId, hiddenUntilByKey]);

  const ackUntilEndOfDay = useCallback(
    async (itemKey: string) => {
      if (!agency?.id || !user?.id) return;
      const hidden_until = endOfTodayUtc().toISOString();
      const { error } = await supabase.from("standup_snoozes").upsert(
        {
          agency_id: agency.id,
          user_id: user.id,
          item_key: itemKey,
          hidden_until,
        },
        { onConflict: "user_id,agency_id,item_key" },
      );
      if (error) toast.error(error.message);
      else {
        toast.success("Marcado como visto até ao fim do dia.");
        void queryClient.invalidateQueries({
          queryKey: ["standup", agency.id, user.id],
        });
      }
    },
    [agency?.id, user?.id, queryClient],
  );

  const snoozeTomorrow = useCallback(
    async (itemKey: string) => {
      if (!agency?.id || !user?.id) return;
      const hidden_until = tomorrowMorningUtc().toISOString();
      const { error } = await supabase.from("standup_snoozes").upsert(
        {
          agency_id: agency.id,
          user_id: user.id,
          item_key: itemKey,
          hidden_until,
        },
        { onConflict: "user_id,agency_id,item_key" },
      );
      if (error) toast.error(error.message);
      else {
        toast.success("Adiado até amanhã de manhã.");
        void queryClient.invalidateQueries({
          queryKey: ["standup", agency.id, user.id],
        });
      }
    },
    [agency?.id, user?.id, queryClient],
  );

  if (isLoading || !data) return <PageSkeleton preset="compact" />;

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="Stand-up"
        description="Só bloqueios: SLA vencido, alertas críticos e sync em atraso. Respeita o âmbito global de cliente quando ativo."
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to="/dashboard">Dashboard</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to="/integrations">Integrações</Link>
        </Button>
      </div>

      <Card>
        <CardHeader title={`Itens (${items.length})`} />
        {items.length === 0 ? (
          <div className="p-6">
            <Empty label="Nada crítico na fila — bom trabalho." />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((it) => (
              <div
                key={it.key}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 gap-3">
                  <div className="mt-0.5 shrink-0">
                    {it.kind === "sla_action" ? (
                      <ListTodo className="h-5 w-5 text-warning" />
                    ) : it.kind === "critical_alert" ? (
                      <Bell className="h-5 w-5 text-destructive" />
                    ) : (
                      <Database className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {it.kind === "critical_alert" ? (
                        <PriorityDot p="critical" />
                      ) : it.kind === "sla_action" ? (
                        <span className="rounded bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                          SLA
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">
                          Sync
                        </span>
                      )}
                      <span className="font-medium leading-snug">{it.title}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {it.subtitle}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link to={it.href}>Abrir</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void ackUntilEndOfDay(it.key)}
                  >
                    Visto hoje
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void snoozeTomorrow(it.key)}
                  >
                    Até amanhã
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
