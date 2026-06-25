import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { edgeFunctionErrorMessage } from "@/lib/edge-function-error";
import {
  ACCESS_CHECKLIST_OPTIONS,
  type ManagementOnboardingQueueRow,
  onboardingSlaTone,
  onboardingStatusLabel,
} from "@/lib/management-onboarding";
import { throwIfSupabaseError, queryErrorMeta } from "@/lib/supabase-result";
import { QueryErrorState } from "@/components/query-error-state";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/operational-ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatPhoneBR,
  whatsappLink,
} from "@/lib/platform-admin-buyers";
import { buildGestaoIntroMessage } from "@/lib/gestao-whatsapp";
import { ProvisionManagementButton } from "@/components/management/ProvisionManagementButton";

type OnboardingSubmission = {
  diagnosis_id: string;
  submitted_at: string;
  monthly_ad_budget: number | null;
  roas_goal: string | null;
  access_notes: string | null;
  preferred_contact_time: string | null;
  access_checklist: string[];
};

function accessChecklistLabels(ids: string[]): string[] {
  return ids.map((id) => {
    const opt = ACCESS_CHECKLIST_OPTIONS.find((o) => o.id === id);
    return opt?.label ?? id;
  });
}

function OnboardingFormDialog({
  diagnosisId,
  open,
  onOpenChange,
}: {
  diagnosisId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["management-onboarding-submission", diagnosisId],
    enabled: open && Boolean(diagnosisId),
    meta: queryErrorMeta,
    queryFn: async () => {
      const res = await supabase.rpc("get_management_onboarding_submission", {
        p_diagnosis_id: diagnosisId!,
      });
      throwIfSupabaseError(res.error, "get_management_onboarding_submission");
      return res.data as OnboardingSubmission | null;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Formulário de onboarding</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Erro ao carregar formulário.</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">
            Cliente ainda não enviou o formulário.
          </p>
        ) : (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Enviado em</dt>
              <dd>
                {new Date(data.submitted_at).toLocaleString("pt-BR")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Orçamento mensal (anúncios)</dt>
              <dd>
                {data.monthly_ad_budget != null
                  ? data.monthly_ad_budget.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Meta ROAS / CPA</dt>
              <dd>{data.roas_goal?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Melhor horário de contato</dt>
              <dd>{data.preferred_contact_time?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Acessos necessários</dt>
              <dd>
                {data.access_checklist.length > 0 ? (
                  <ul className="mt-1 list-inside list-disc">
                    {accessChecklistLabels(data.access_checklist).map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Notas de acesso</dt>
              <dd className="whitespace-pre-wrap">
                {data.access_notes?.trim() || "—"}
              </dd>
            </div>
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SlaBadge({ paidAt }: { paidAt: string | null }) {
  const tone = onboardingSlaTone(paidAt);
  const cls =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
        : "bg-red-500/15 text-red-700 dark:text-red-400";
  const label =
    tone === "ok" ? "< 12h" : tone === "warn" ? "12–24h" : "> 24h";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      SLA {label}
    </span>
  );
}

function QueueRowActions({
  row,
  onProvisioned,
  onViewForm,
}: {
  row: ManagementOnboardingQueueRow;
  onProvisioned: () => void;
  onViewForm: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const wa = whatsappLink(
    row.payer_phone,
    buildGestaoIntroMessage({
      diagnosisId: row.diagnosis_id,
      storeName: row.business_name,
    }),
  );

  async function provision() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke(
      "provision-management-client",
      { body: { diagnosis_id: row.diagnosis_id } },
    );
    setLoading(false);
    if (error) {
      toast.error(await edgeFunctionErrorMessage(error));
      return;
    }
    const payload = data as { client_id?: string; already_provisioned?: boolean };
    toast.success(
      payload.already_provisioned
        ? "Cliente já estava provisionado."
        : "Cliente criado no cockpit.",
    );
    onProvisioned();
  }

  if (row.client_id) {
    return (
      <Link
        to="/clients/$clientId"
        params={{ clientId: row.client_id }}
        className="text-xs font-medium text-primary hover:underline"
      >
        Abrir cliente
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {row.form_submitted_at ? (
        <Button type="button" size="sm" variant="outline" onClick={onViewForm}>
          <FileText className="mr-1 h-3 w-3" />
          Ver formulário
        </Button>
      ) : null}
      <ProvisionManagementButton loading={loading} onClick={() => void provision()} />
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface"
        >
          <MessageCircle className="h-3 w-3" /> WhatsApp
        </a>
      ) : null}
      <a
        href={`/diagnostico/${row.diagnosis_id}?s=${row.secret_slug}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface"
      >
        <ExternalLink className="h-3 w-3" /> Diagnóstico
      </a>
    </div>
  );
}

export function ManagementOnboardingQueue({
  compact = false,
  limit = 10,
}: {
  compact?: boolean;
  limit?: number;
}) {
  const queryClient = useQueryClient();
  const [formDiagnosisId, setFormDiagnosisId] = useState<string | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["management-onboarding-queue", limit],
    meta: queryErrorMeta,
    queryFn: async () => {
      const res = await supabase.rpc("management_onboarding_queue", {
        p_include_provisioned: false,
        p_limit: limit,
      });
      throwIfSupabaseError(res.error, "management_onboarding_queue");
      return (res.data ?? []) as ManagementOnboardingQueueRow[];
    },
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["management-onboarding-queue"] });
    void queryClient.invalidateQueries({ queryKey: ["funnel-agency-operator"] });
    void refetch();
  };

  if (isError) {
    if (compact) return null;
    return (
      <QueryErrorState
        message={error instanceof Error ? error.message : "Erro ao carregar fila"}
        onRetry={() => void refetch()}
      />
    );
  }

  const rows = data ?? [];
  if (compact && rows.length === 0) return null;

  return (
    <Card>
      <OnboardingFormDialog
        diagnosisId={formDiagnosisId}
        open={Boolean(formDiagnosisId)}
        onOpenChange={(open) => {
          if (!open) setFormDiagnosisId(null);
        }}
      />
      <CardHeader
        title="Gestão: onboarding pendente"
        subtitle={
          compact
            ? `${rows.length} aguardando provisionamento`
            : "Clientes que pagaram R$ 1.997 e ainda não estão no cockpit"
        }
        action={
          !compact ? (
            <Link
              to="/management-onboarding"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver todos
            </Link>
          ) : undefined
        }
      />
      {isLoading ? (
        <div className="flex justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          Nenhum onboarding pendente.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <div
              key={row.diagnosis_id}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {row.business_name ?? row.payer_name ?? "Sem nome"}
                  </span>
                  <SlaBadge paidAt={row.management_paid_at} />
                  <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {onboardingStatusLabel(row.onboarding_status)}
                  </span>
                  {row.whatsapp_clicked_at ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> WhatsApp
                    </span>
                  ) : null}
                  {row.form_submitted_at ? (
                    <span className="text-[10px] text-muted-foreground">
                      Formulário ✓
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {row.payer_email ?? "—"} · {formatPhoneBR(row.payer_phone)}
                  {row.management_paid_at
                    ? ` · Pago ${new Date(row.management_paid_at).toLocaleString("pt-BR")}`
                    : ""}
                </p>
              </div>
              <QueueRowActions
                row={row}
                onProvisioned={invalidate}
                onViewForm={() => setFormDiagnosisId(row.diagnosis_id)}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
