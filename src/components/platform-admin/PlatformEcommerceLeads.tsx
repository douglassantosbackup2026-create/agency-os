import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { throwIfSupabaseError, queryErrorMeta } from "@/lib/supabase-result";
import { Card, CardHeader, Empty, PageSkeleton } from "@/components/operational-ui";
import { QueryErrorState } from "@/components/query-error-state";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "new", label: "Novo" },
  { value: "contacted", label: "Contactado" },
  { value: "qualified", label: "Qualificado" },
  { value: "converted", label: "Convertido" },
  { value: "disqualified", label: "Descartado" },
] as const;

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
  created_at: string;
};

export function PlatformEcommerceLeads() {
  const queryClient = useQueryClient();

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

  if (isLoading) return <PageSkeleton preset="compact" />;
  if (isError) return <QueryErrorState message={error instanceof Error ? error.message : "Erro"} onRetry={() => void refetch()} />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Leads E-commerce" />
        <div className="overflow-x-auto p-4">
          {!data?.length ? (
            <Empty label="Nenhum lead de e-commerce ainda." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 pr-4 font-medium">WhatsApp</th>
                  <th className="pb-2 pr-4 font-medium">Investimento</th>
                  <th className="pb-2 pr-4 font-medium">Origem</th>
                  <th className="pb-2 pr-4 font-medium">Recebido</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((lead) => (
                  <tr key={lead.id} className="border-b border-border/60">
                    <td className="py-3 pr-4">
                      <div className="font-medium">{lead.name}</div>
                      <div className="text-xs text-muted-foreground">{lead.email}</div>
                      <div className="text-xs text-muted-foreground">{lead.store_name} · {lead.website}</div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{lead.phone}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{lead.monthly_ad_budget_range}</td>
                    <td className="py-3 pr-4">
                      <div className="space-y-0.5">
                        <Badge variant="secondary" className="text-xs">
                          {lead.source ?? "—"}
                        </Badge>
                        <div className="text-[10px] text-muted-foreground">
                          {lead.utm_source ? `${lead.utm_source}` : ""}
                          {lead.utm_campaign ? ` / ${lead.utm_campaign}` : ""}
                          {lead.utm_adset ? ` / ${lead.utm_adset}` : ""}
                          {lead.utm_ad ? ` / ${lead.utm_ad}` : ""}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                      {new Date(lead.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-3">
                      <Select
                        value={lead.status}
                        onValueChange={(status) => updateMutation.mutate({ id: lead.id, status })}
                        disabled={updateMutation.isPending}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
