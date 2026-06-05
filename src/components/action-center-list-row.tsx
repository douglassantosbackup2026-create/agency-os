import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Database } from "@/integrations/supabase/types";
import { getJsonNumber } from "@/lib/supabase-json";

export type ActionCenterListRowModel =
  Database["public"]["Tables"]["action_center"]["Row"] & {
    clients?: { id: string; name: string } | null;
  };

type Teammate = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type EventRow = {
  id: string;
  event_type: string;
  payload: unknown;
  created_at: string;
};

type Props = {
  action: ActionCenterListRowModel;
  teammates: Teammate[];
  currentUserId?: string;
  selected: boolean;
  expanded: boolean;
  overdue: boolean;
  eventRows: EventRow[];
  eventsError?: string | null;
  onRetryEvents?: () => void;
  onToggleSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onPatchStatus: (id: string, status: string) => void;
  onAssignee: (id: string, userId: string) => void;
};

function ActionCenterListRowInner({
  action: a,
  teammates,
  currentUserId,
  selected,
  expanded,
  overdue,
  eventRows,
  eventsError,
  onRetryEvents,
  onToggleSelect,
  onToggleExpand,
  onPatchStatus,
  onAssignee,
}: Props) {
  const mergeCount = getJsonNumber(a.metadata, "merge_count", 0);
  return (
    <div>
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-3">
          <div className="pt-0.5">
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect(a.id)}
              aria-label={`Selecionar ${a.title}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{a.title}</span>
              {overdue && (
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
                  params={{ clientId: a.client_id! }}
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
              {mergeCount > 0 && (
                <span title="Mesclagens por dedupe">Mesclas {mergeCount}</span>
              )}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => onToggleExpand(a.id)}
              >
                {expanded ? "Ocultar histórico" : "Histórico"}
              </Button>
              <label className="flex items-center gap-2 font-normal">
                <span className="shrink-0 text-muted-foreground">
                  Responsável
                </span>
                <select
                  value={a.assigned_to ?? ""}
                  onChange={(e) => void onAssignee(a.id, e.target.value)}
                  className="h-7 max-w-[160px] rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="">—</option>
                  {currentUserId && <option value={currentUserId}>Eu</option>}
                  {teammates
                    .filter((t) => t.id !== currentUserId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.display_name || t.email}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          <select
            value={a.status}
            onChange={(e) => void onPatchStatus(a.id, e.target.value)}
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
      {expanded && (
        <div className="border-t border-border px-4 pb-3 pt-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Histórico da ação
          </div>
          {eventsError ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-destructive">{eventsError}</span>
              {onRetryEvents && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => void onRetryEvents()}
                >
                  Tentar novamente
                </Button>
              )}
            </div>
          ) : !eventRows.length ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Sem eventos registrados.
            </p>
          ) : (
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {eventRows.map((ev) => (
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
  );
}

export const ActionCenterListRow = memo(ActionCenterListRowInner);
ActionCenterListRow.displayName = "ActionCenterListRow";
