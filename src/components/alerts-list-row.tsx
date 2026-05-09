import { memo, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { PriorityDot } from "@/components/operational-ui";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { initials, timeAgo } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";
import { alertWhyLine } from "@/lib/alert-why-line";
import { draftMessageForAlert } from "@/lib/message-templates";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

export type AlertRowModel = Database["public"]["Tables"]["alerts"]["Row"] & {
  clients?: {
    name?: string;
    contact_phone?: string | null;
  } | null;
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
  onRequestAdminReview?: (alert: AlertRowModel) => void | Promise<void>;
};

function AlertsListRowInner({
  alert: a,
  teammates,
  waMuteUntil,
  onAssigneeChange,
  onResolve,
  onCreateAction,
  onMuteWhatsapp,
  onRequestAdminReview,
}: Props) {
  const why = alertWhyLine(a);
  const assignee = teammates.find((t) => t.id === (a.assigned_to ?? ""));

  const messageDraft = useMemo(
    () =>
      draftMessageForAlert({
        alertType: a.type,
        clientName: a.clients?.name ?? "Cliente",
        description: a.description,
        title: a.title,
        recommendedAction: a.recommended_action,
      }),
    [
      a.type,
      a.clients?.name,
      a.description,
      a.title,
      a.recommended_action,
    ],
  );

  const waDigits = String(a.clients?.contact_phone ?? "").replace(/\D/g, "");
  const waHref =
    waDigits.length >= 10
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(messageDraft.body)}`
      : null;
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
          {!a.assigned_to && (
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Sem responsável
            </span>
          )}
        </div>
        {why && (
          <div className="mt-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-xs leading-snug text-muted-foreground">
            <span className="font-medium text-foreground">Porquê:</span> {why}
          </div>
        )}
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
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground"
              title={
                assignee
                  ? assignee.display_name || assignee.email || ""
                  : "Sem responsável"
              }
            >
              {assignee
                ? initials(assignee.display_name || assignee.email || "?")
                : "—"}
            </span>
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
          {onRequestAdminReview && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="text-xs"
              onClick={() => void onRequestAdminReview(a)}
            >
              Pedir revisão admin
            </Button>
          )}
          {a.client_id && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  title="Template por cenário — copiar ou WhatsApp"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Mensagem
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(100vw-2rem,22rem)] space-y-3" align="end">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {messageDraft.scenarioLabel}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Texto gerado a partir do tipo de alerta e da descrição; adapte
                    antes de enviar.
                  </p>
                </div>
                <textarea
                  readOnly
                  value={messageDraft.body}
                  rows={7}
                  className="w-full resize-y rounded-md border border-border bg-muted/30 p-2 text-xs leading-relaxed"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="text-xs"
                    onClick={() => {
                      void navigator.clipboard.writeText(messageDraft.body);
                      toast.success("Texto copiado.");
                    }}
                  >
                    Copiar
                  </Button>
                  {waHref ? (
                    <Button type="button" size="sm" className="text-xs" asChild>
                      <a href={waHref} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                    </Button>
                  ) : (
                    <span className="self-center text-[11px] text-muted-foreground">
                      Sem telefone na ficha do cliente
                    </span>
                  )}
                  <Button type="button" size="sm" variant="ghost" className="text-xs" asChild>
                    <Link to="/whatsapp">Página WhatsApp</Link>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}
    </div>
  );
}

export const AlertsListRow = memo(AlertsListRowInner);
AlertsListRow.displayName = "AlertsListRow";
