import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Download,
  Loader2,
  MessageCircle,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { throwIfSupabaseError, queryErrorMeta } from "@/lib/supabase-result";
import { QueryErrorState } from "@/components/query-error-state";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/operational-ui";
import { edgeFunctionErrorMessage } from "@/lib/edge-function-error";
import {
  type ManagementKpis,
  type ManagementSubscriberRow,
  centsToBrl,
  formatCpf,
  formatPhoneBR,
  subscriptionStatusLabel,
  subscriptionStatusTone,
  whatsappLink,
} from "@/lib/platform-admin-buyers";
import { onboardingStatusLabel } from "@/lib/management-onboarding";
import { ProvisionManagementButton } from "@/components/management/ProvisionManagementButton";

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { label: "Todos", value: "" },
  { label: "Ativas (cartão)", value: "authorized" },
  { label: "PIX pago", value: "pix_paid" },
  { label: "Pausadas", value: "paused" },
  { label: "Canceladas", value: "cancelled" },
  { label: "Pendentes", value: "pending" },
];

const WHATSAPP_OPTIONS = [
  { label: "WhatsApp: todos", value: "" },
  { label: "Clicou WhatsApp", value: "clicked" },
  { label: "Sem clique WhatsApp", value: "not_clicked" },
];

function exportCsv(rows: ManagementSubscriberRow[]): string {
  const header = [
    "ativada_em",
    "nome",
    "email",
    "telefone",
    "cpf",
    "negocio",
    "valor_mensal_brl",
    "status",
    "proxima_cobranca",
    "ultima_cobranca",
    "diagnosis_id",
  ];
  const lines = rows.map((r) =>
    [
      r.management_paid_at ?? "",
      r.payer_name ?? "",
      r.payer_email ?? "",
      r.payer_phone ?? "",
      r.payer_cpf ?? "",
      r.business_name ?? "",
      centsToBrl(r.amount_cents),
      r.sub_status ?? "",
      r.next_payment_date ?? "",
      r.last_charge_at ?? "",
      r.diagnosis_id,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function PlatformManagementSubscribers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [whatsappFilter, setWhatsappFilter] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["platform-subscribers", search, statusFilter, whatsappFilter, page],
    meta: queryErrorMeta,
    queryFn: async () => {
      const [listRes, kpisRes] = await Promise.all([
        supabase.rpc("platform_management_subscribers_list", {
          p_limit: PAGE_SIZE,
          p_offset: page * PAGE_SIZE,
          p_search: search || undefined,
          p_status: statusFilter || undefined,
          p_whatsapp_filter: whatsappFilter || undefined,
        }),
        supabase.rpc("platform_management_subscribers_kpis"),
      ]);
      throwIfSupabaseError(listRes.error, "platform.subscribers.list");
      throwIfSupabaseError(kpisRes.error, "platform.subscribers.kpis");
      return {
        list: (listRes.data ?? []) as ManagementSubscriberRow[],
        kpis: kpisRes.data as ManagementKpis,
      };
    },
  });

  const provisionMutation = useMutation({
    mutationFn: async (diagnosisId: string) => {
      const res = await supabase.functions.invoke("provision-management-client", {
        body: { diagnosis_id: diagnosisId },
      });
      if (res.error) {
        throw new Error(await edgeFunctionErrorMessage(res.error, res.error.message));
      }
      const body = res.data as { error?: string; client_id?: string };
      if (body?.error) throw new Error(body.error);
      return body;
    },
    onSuccess: () => {
      toast.success("Cliente provisionado no cockpit.");
      void queryClient.invalidateQueries({ queryKey: ["platform-subscribers"] });
      void queryClient.invalidateQueries({ queryKey: ["management-onboarding-queue"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Falha ao provisionar");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (payload: { diagnosis_id: string; reason: string }) => {
      const res = await supabase.functions.invoke(
        "cancel-management-subscription",
        { body: payload },
      );
      if (res.error) {
        throw new Error(
          await edgeFunctionErrorMessage(res.error, res.error.message),
        );
      }
      const body = res.data as {
        error?: string;
        ok?: boolean;
        already_cancelled?: boolean;
      };
      if (body?.error) throw new Error(body.error);
      return body;
    },
    onSuccess: (body) => {
      toast.success(
        body?.already_cancelled
          ? "Assinatura já estava cancelada."
          : "Assinatura cancelada no Mercado Pago.",
      );
      void queryClient.invalidateQueries({ queryKey: ["platform-subscribers"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Falha ao cancelar assinatura");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <QueryErrorState
        message={error instanceof Error ? error.message : String(error)}
        onRetry={() => void refetch()}
      />
    );
  }

  const { list, kpis } = data!;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <CreditCard className="h-5 w-5" />
          <h2 className="text-xl font-semibold tracking-tight">
            Assinantes da Gestão de Tráfego
          </h2>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Gestão paga (cartão recorrente ou PIX). Inclui onboarding, handoff
          WhatsApp e provisionamento no cockpit.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Ativas" value={String(kpis.active_count)} />
        <Kpi title="MRR" value={centsToBrl(kpis.mrr_cents)} />
        <Kpi title="Novas no mês" value={String(kpis.new_this_month)} />
        <Kpi
          title="Canceladas no mês"
          value={String(kpis.cancelled_this_month)}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
              setPage(0);
            }}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar nome, e-mail, CPF, negócio…"
                className="h-9 w-64 rounded-md border border-border bg-background pl-7 pr-2 text-xs"
              />
            </div>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-xs"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-xs"
              value={whatsappFilter}
              onChange={(e) => {
                setWhatsappFilter(e.target.value);
                setPage(0);
              }}
            >
              {WHATSAPP_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="outline" disabled={isFetching}>
              {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Filtrar"}
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const csv = exportCsv(list);
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `assinantes-gestao-${Date.now()}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV
          </Button>
        </div>

        <div className="overflow-x-auto p-4">
          {!list.length ? (
            <p className="text-sm text-muted-foreground">Nenhum assinante encontrado.</p>
          ) : (
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Ativada em</th>
                  <th className="pb-2 pr-2 font-medium">Cliente</th>
                  <th className="pb-2 pr-2 font-medium">Contacto</th>
                  <th className="pb-2 pr-2 font-medium">Negócio</th>
                  <th className="pb-2 pr-2 font-medium">Mensal</th>
                  <th className="pb-2 pr-2 font-medium">Cartão</th>
                  <th className="pb-2 pr-2 font-medium">Onboarding</th>
                  <th className="pb-2 pr-2 font-medium">Status</th>
                  <th className="pb-2 pr-2 font-medium">Próx. cobrança</th>
                  <th className="pb-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const tone = subscriptionStatusTone(r.sub_status);
                  const toneClass =
                    tone === "ok"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : tone === "warn"
                        ? "bg-amber-500/10 text-amber-600"
                        : tone === "bad"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground";
                  const wa = whatsappLink(
                    r.payer_phone,
                    `Olá ${r.payer_name?.split(" ")[0] ?? ""}, aqui é da Retentio sobre a tua gestão de tráfego.`,
                  );
                  return (
                    <tr key={r.diagnosis_id} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-2 whitespace-nowrap text-muted-foreground">
                        {r.management_paid_at
                          ? new Date(r.management_paid_at).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                      <td className="py-2 pr-2">
                        <div className="font-medium">{r.payer_name ?? "—"}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {formatCpf(r.payer_cpf)}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="font-mono text-[11px]">{r.payer_email ?? "—"}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {formatPhoneBR(r.payer_phone)}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="font-medium">{r.business_name ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.website ?? r.instagram ?? ""}
                        </div>
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap font-medium tabular-nums">
                        {centsToBrl(r.amount_cents)}
                      </td>
                      <td className="py-2 pr-2 font-mono text-[11px]">
                        {r.payment_method === "pix"
                          ? "PIX"
                          : r.card_last4
                            ? `•••• ${r.card_last4}`
                            : "—"}
                      </td>
                      <td className="py-2 pr-2 text-[10px]">
                        <div>{onboardingStatusLabel(r.onboarding_status)}</div>
                        {r.whatsapp_clicked_at ? (
                          <div className="text-emerald-600">WhatsApp ✓</div>
                        ) : (
                          <div className="text-muted-foreground">Sem WhatsApp</div>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClass}`}>
                          {subscriptionStatusLabel(r.sub_status)}
                        </span>
                        {r.last_charge_status ? (
                          <div className="text-[10px] text-muted-foreground">
                            Última: {r.last_charge_status}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap text-muted-foreground">
                        {r.next_payment_date
                          ? new Date(r.next_payment_date).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {!r.client_id ? (
                            <ProvisionManagementButton
                              loading={provisionMutation.isPending}
                              onClick={() =>
                                provisionMutation.mutate(r.diagnosis_id)
                              }
                              className="h-auto px-1.5 py-0.5 text-xs"
                            />
                          ) : null}
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 hover:bg-muted"
                            >
                              <MessageCircle className="h-3 w-3" />
                              WhatsApp
                            </a>
                          ) : null}
                          {r.sub_status === "authorized" ? (
                            <button
                              type="button"
                              className="rounded border border-destructive/40 px-1.5 py-0.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                              disabled={cancelMutation.isPending}
                              onClick={() => {
                                if (typeof window === "undefined") return;
                                const reason = window.prompt(
                                  "Motivo do cancelamento (registado):",
                                  "Solicitação via WhatsApp",
                                );
                                if (reason === null) return;
                                if (
                                  !window.confirm(
                                    "Cancelar assinatura recorrente no Mercado Pago? O cliente não será mais cobrado.",
                                  )
                                ) {
                                  return;
                                }
                                cancelMutation.mutate({
                                  diagnosis_id: r.diagnosis_id,
                                  reason,
                                });
                              }}
                            >
                              Cancelar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!list.length || list.length < PAGE_SIZE}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </Card>
    </section>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="p-4 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}
