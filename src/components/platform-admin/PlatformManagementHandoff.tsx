import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { throwIfSupabaseError, queryErrorMeta } from "@/lib/supabase-result";
import { QueryErrorState } from "@/components/query-error-state";
import { Card, CardHeader } from "@/components/operational-ui";
import { Button } from "@/components/ui/button";
import { onboardingStatusLabel } from "@/lib/management-onboarding";
import { formatPhoneBR } from "@/lib/platform-admin-buyers";

const PAGE_SIZE = 50;

const KIND_OPTIONS = [
  { label: "Todos os eventos", value: "" },
  { label: "Clique WhatsApp", value: "whatsapp_click" },
  { label: "Visualização WhatsApp", value: "whatsapp_view" },
  { label: "Volta ao relatório", value: "report_back_click" },
  { label: "Formulário enviado", value: "onboarding_submitted" },
];

export type HandoffRow = {
  event_id: string;
  diagnosis_id: string;
  secret_slug: string | null;
  kind: string;
  event_at: string;
  payer_name: string | null;
  payer_email: string | null;
  payer_phone: string | null;
  business_name: string | null;
  management_paid_at: string | null;
  onboarding_status: string | null;
  whatsapp_clicked_at: string | null;
  client_id: string | null;
  payload: Record<string, unknown> | null;
};

function kindLabel(kind: string): string {
  switch (kind) {
    case "whatsapp_click":
      return "Clique WhatsApp";
    case "whatsapp_view":
      return "Viu página paga";
    case "report_back_click":
      return "Voltou ao relatório";
    case "onboarding_submitted":
      return "Formulário onboarding";
    default:
      return kind;
  }
}

export function PlatformManagementHandoff() {
  const [kindFilter, setKindFilter] = useState("");
  const [paidWithoutWhatsapp, setPaidWithoutWhatsapp] = useState(false);
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["platform-handoff", kindFilter, paidWithoutWhatsapp, page],
    meta: queryErrorMeta,
    queryFn: async () => {
      const res = await supabase.rpc("platform_management_handoff_list", {
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
        p_kind: kindFilter || undefined,
        p_paid_without_whatsapp: paidWithoutWhatsapp,
      });
      throwIfSupabaseError(res.error, "platform_management_handoff_list");
      return (res.data ?? []) as HandoffRow[];
    },
  });

  if (isError) {
    return (
      <QueryErrorState
        message={error instanceof Error ? error.message : String(error)}
        onRetry={() => void refetch()}
      />
    );
  }

  const rows = data ?? [];

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader
          title="Handoff pós-gestão"
          subtitle="Eventos de diagnóstico após pagamento — cliques WhatsApp, formulário, etc."
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
            value={kindFilter}
            onChange={(e) => {
              setKindFilter(e.target.value);
              setPage(0);
            }}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={paidWithoutWhatsapp}
              onChange={(e) => {
                setPaidWithoutWhatsapp(e.target.checked);
                setPage(0);
              }}
            />
            Só pagos sem clique WhatsApp
          </label>
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        <div className="overflow-x-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento encontrado.</p>
          ) : (
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Quando</th>
                  <th className="pb-2 pr-2 font-medium">Evento</th>
                  <th className="pb-2 pr-2 font-medium">Cliente</th>
                  <th className="pb-2 pr-2 font-medium">Onboarding</th>
                  <th className="pb-2 pr-2 font-medium">WhatsApp</th>
                  <th className="pb-2 font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const reportHref =
                    r.secret_slug
                      ? `/diagnostico/${r.diagnosis_id}?s=${r.secret_slug}`
                      : null;
                  return (
                    <tr
                      key={r.event_id}
                      className="border-b border-border/60 align-top"
                    >
                      <td className="py-2 pr-2 whitespace-nowrap text-muted-foreground">
                        {new Date(r.event_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2 pr-2">{kindLabel(r.kind)}</td>
                      <td className="py-2 pr-2">
                        <div className="font-medium">
                          {r.business_name ?? r.payer_name ?? "—"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.payer_email ?? "—"} · {formatPhoneBR(r.payer_phone)}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        {onboardingStatusLabel(r.onboarding_status)}
                        {r.client_id ? (
                          <div className="text-emerald-600">Provisionado</div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2">
                        {r.whatsapp_clicked_at ? (
                          <span className="text-emerald-600">Clicou</span>
                        ) : (
                          <span className="text-amber-600">Sem clique</span>
                        )}
                      </td>
                      <td className="py-2">
                        {reportHref ? (
                          <a
                            href={reportHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Diagnóstico
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={rows.length < PAGE_SIZE}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </Card>
    </section>
  );
}
