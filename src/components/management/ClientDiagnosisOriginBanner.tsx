import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { throwIfSupabaseError, queryErrorMeta } from "@/lib/supabase-result";
import { Card } from "@/components/operational-ui";

type Handoff = {
  diagnosis_id: string;
  secret_slug?: string;
  management_paid_at?: string | null;
  management_onboarding_status?: string | null;
};

export function ClientDiagnosisOriginBanner({
  clientId,
  diagnosisId,
}: {
  clientId: string;
  diagnosisId: string | null | undefined;
}) {
  const { data: handoff } = useQuery({
    queryKey: ["client-diagnosis-handoff", clientId],
    enabled: Boolean(diagnosisId),
    meta: queryErrorMeta,
    queryFn: async () => {
      const res = await supabase.rpc("get_client_diagnosis_handoff", {
        p_client_id: clientId,
      });
      throwIfSupabaseError(res.error, "get_client_diagnosis_handoff");
      return res.data as Handoff | null;
    },
  });

  if (!diagnosisId || !handoff?.diagnosis_id) return null;

  const reportHref = handoff.secret_slug
    ? `/diagnostico/${handoff.diagnosis_id}?s=${handoff.secret_slug}`
    : null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Origem: Diagnóstico Meta · Gestão R$ 1.997</p>
          <p className="text-xs text-muted-foreground">
            Cliente provisionado a partir do funil de diagnóstico.
            {handoff.management_paid_at
              ? ` Pago em ${new Date(handoff.management_paid_at).toLocaleDateString("pt-BR")}.`
              : ""}
          </p>
        </div>
        {reportHref ? (
          <a
            href={reportHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ver relatório do diagnóstico
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </Card>
  );
}
