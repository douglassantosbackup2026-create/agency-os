import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { throwIfSupabaseError, queryErrorMeta } from "@/lib/supabase-result";
import { Card, CardHeader } from "@/components/operational-ui";
import { Button } from "@/components/ui/button";

export function PlatformOpsConfig() {
  const queryClient = useQueryClient();
  const [agencyIdInput, setAgencyIdInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["retentio-ops-config"],
    meta: queryErrorMeta,
    queryFn: async () => {
      const res = await supabase.rpc("get_retentio_ops_config");
      throwIfSupabaseError(res.error, "get_retentio_ops_config");
      const cfg = res.data as { diagnosis_funnel_agency_id?: string | null };
      return cfg;
    },
  });

  const save = useMutation({
    mutationFn: async (agencyId: string | null) => {
      const res = await supabase.rpc("update_retentio_ops_config", {
        p_diagnosis_funnel_agency_id: agencyId ?? undefined,
      });
      throwIfSupabaseError(res.error, "update_retentio_ops_config");
      return res.data;
    },
    onSuccess: () => {
      toast.success("Configuração guardada.");
      void queryClient.invalidateQueries({ queryKey: ["retentio-ops-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = data?.diagnosis_funnel_agency_id ?? "";

  return (
    <Card>
      <CardHeader
        title="Agência do funil de gestão"
        subtitle="Alertas e fila de onboarding pós-pagamento R$ 1.997"
      />
      <div className="space-y-3 p-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Atual:{" "}
              <code className="rounded bg-surface px-1">
                {current || "não configurado"}
              </code>
            </p>
            <label className="block text-sm">
              <span className="font-medium">UUID da agência operadora</span>
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                defaultValue={current}
                onChange={(e) => setAgencyIdInput(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={save.isPending}
                onClick={() => {
                  const v = (agencyIdInput || current).trim();
                  if (!v) {
                    toast.error("Informe o UUID da agência.");
                    return;
                  }
                  save.mutate(v);
                }}
              >
                {save.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : null}
                Guardar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={save.isPending || !current}
                onClick={() => save.mutate(null)}
              >
                Limpar
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
