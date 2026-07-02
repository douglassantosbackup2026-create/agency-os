import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { throwIfSupabaseError, queryErrorMeta } from "@/lib/supabase-result";
import { Card, CardHeader, Empty, PageSkeleton } from "@/components/operational-ui";
import { QueryErrorState } from "@/components/query-error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { edgeFunctionErrorMessage } from "@/lib/edge-function-error";
import { formatLeadManagementPrice } from "@/lib/lead-management-price";

const CRM_STATUS_OPTIONS = [
  { value: "contacted", label: "Contactado" },
  { value: "qualified", label: "Qualificado" },
  { value: "disqualified", label: "Descartado" },
] as const;

const AUTO_STATUSES = new Set(["new", "awaiting_payment", "paid", "converted"]);

type FilterTab = "all" | "awaiting_payment" | "paid" | "provisioned";

type EcommerceLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  store_name: string;
  website: string;
  monthly_ad_budget_range: string;
  challenge: string | null;
  source: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_adset: string | null;
  utm_ad: string | null;
  status: string;
  amount_cents: number | null;
  paid_at: string | null;
  client_id: string | null;
  created_at: string;
};

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    new: "Novo",
    awaiting_payment: "Aguardando pagamento",
    paid: "Pago",
    converted: "Provisionado",
    contacted: "Contactado",
    qualified: "Qualificado",
    disqualified: "Descartado",
  };
  return map[status] ?? status;
}

function statusTone(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid") return "default";
  if (status === "awaiting_payment") return "secondary";
  if (status === "converted") return "outline";
  if (status === "disqualified") return "destructive";
  return "secondary";
}

export function PlatformEcommerceLeads() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>("all");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ecommerce-leads"],
    meta: queryErrorMeta,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ecommerce_leads")
        .select("*")
        .order("created_at", { ascending: false });
      throwIfSupabaseError(error, "ecommerce-leads.list");
      return (data ?? []) as EcommerceLead[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    switch (filter) {
      case "awaiting_payment":
        return data.filter((l) => l.status === "awaiting_payment");
      case "paid":
        return data.filter((l) => l.status === "paid" && !l.client_id);
      case "provisioned":
        return data.filter((l) => Boolean(l.client_id));
      default:
        return data;
    }
  }, [data, filter]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("ecommerce_leads")
        .update({ status })
        .eq("id", id);
      throwIfSupabaseError(error, "ecommerce-leads.update");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ecommerce-leads"] });
      toast.success("Status atualizado");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Tente novamente");
    },
  });

  const provisionMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await supabase.functions.invoke("provision-lead-client", {
        body: { lead_id: leadId },
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
      void queryClient.invalidateQueries({ queryKey: ["ecommerce-leads"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Falha ao provisionar");
    },
  });

  if (isLoading) return <PageSkeleton preset="compact" />;
  if (isError) {
    return (
      <QueryErrorState
        message={error instanceof Error ? error.message : "Erro"}
        onRetry={() => void refetch()}
      />
    );
  }

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "awaiting_payment", label: "Aguardando pagamento" },
    { id: "paid", label: "Pagos" },
    { id: "provisioned", label: "Provisionados" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Leads E-commerce (/gestao-trafego)" />
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={filter === tab.id ? "default" : "outline"}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="overflow-x-auto p-4">
          {!filtered.length ? (
            <Empty label="Nenhum lead neste filtro." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 pr-4 font-medium">WhatsApp</th>
                  <th className="pb-2 pr-4 font-medium">Investimento</th>
                  <th className="pb-2 pr-4 font-medium">Valor</th>
                  <th className="pb-2 pr-4 font-medium">Origem</th>
                  <th className="pb-2 pr-4 font-medium">Recebido</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const isAuto = AUTO_STATUSES.has(lead.status);
                  const canProvision =
                    lead.status === "paid" && !lead.client_id && !provisionMutation.isPending;

                  return (
                    <tr key={lead.id} className="border-b border-border/60">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{lead.name}</div>
                        <div className="text-xs text-muted-foreground">{lead.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {lead.store_name} · {lead.website}
                        </div>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">{lead.phone}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{lead.monthly_ad_budget_range}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {lead.amount_cents
                          ? formatLeadManagementPrice(lead.amount_cents)
                          : "—"}
                        {lead.paid_at ? (
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(lead.paid_at).toLocaleString("pt-BR")}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="space-y-0.5">
                          <Badge variant="secondary" className="text-xs">
                            {lead.source ?? "—"}
                          </Badge>
                          <div className="text-[10px] text-muted-foreground">
                            {lead.utm_source ?? ""}
                            {lead.utm_campaign ? ` / ${lead.utm_campaign}` : ""}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                        {new Date(lead.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 pr-4">
                        {isAuto ? (
                          <Badge variant={statusTone(lead.status)}>{statusLabel(lead.status)}</Badge>
                        ) : (
                          <Select
                            value={lead.status}
                            onValueChange={(status) =>
                              updateMutation.mutate({ id: lead.id, status })
                            }
                            disabled={updateMutation.isPending}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CRM_STATUS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-1.5">
                          {canProvision ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={provisionMutation.isPending}
                              onClick={() => provisionMutation.mutate(lead.id)}
                            >
                              {provisionMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Provisionar"
                              )}
                            </Button>
                          ) : null}
                          {lead.client_id ? (
                            <Link
                              to="/clients/$clientId"
                              params={{ clientId: lead.client_id }}
                              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                            >
                              Ver cliente
                            </Link>
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
      </Card>
    </div>
  );
}
