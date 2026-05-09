import { memo } from "react";
import { PriorityDot } from "@/components/operational-ui";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

export type AlertRowModel = Database["public"]["Tables"]["alerts"]["Row"] & {
  clients?: { name?: string } | null;
};

export type AlertTeammateOption = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type Props = {
  alert: AlertRowModel;
  teammates: AlertTeammateOption[];
  waMuteUntil: Map<string, string>;
  onAssigneeChange: (alertId: string, userId: string) => void | Promise<void>;
  onResolve: (alertId: string) => void | Promise<void>;
  onCreateAction: (alert: AlertRowModel) => void | Promise<void>;
  onMuteWhatsapp: (clientId: string) => void | Promise<void>;
};

function AlertsListRowInner({
  alert: a,
  teammates,
  waMuteUntil,
  onAssigneeChange,
  onResolve,
  onCreateAction,
  onMuteWhatsapp,
}: Props) {
  const muteUntil =
    a.client_id != null ? waMuteUntil.get(String(a.client_id)) : undefined;
  const showMuteBadge =
    muteUntil != null && new Date(muteUntil).getTime() > Date.now();

  return (
    <div className="flex items-start gap-3 px-4 py-3">
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
          {showMuteBadge && muteUntil && (
            <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
              WhatsApp silenciado até{" "}
              {new Date(muteUntil).toLocaleString("pt-BR", {
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
            <span className="shrink-0 text-muted-foreground">Responsável</span>
            <select
              value={a.assigned_to ?? ""}
              onChange={(e) => void onAssigneeChange(a.id, e.target.value)}
              className="h-8 max-w-[180px] rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="">—</option>
              {teammates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.display_name || t.email}
                </option>
              ))}
            </select>
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
            onClick={() => void onCreateAction(a)}
          >
            Virar ação
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => void onResolve(a.id)}
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
              onClick={() => void onMuteWhatsapp(String(a.client_id))}
            >
              Silenciar WhatsApp 24h
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export const AlertsListRow = memo(AlertsListRowInner);
AlertsListRow.displayName = "AlertsListRow";
