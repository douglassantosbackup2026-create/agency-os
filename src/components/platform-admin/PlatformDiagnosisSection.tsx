import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Stethoscope,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { throwIfSupabaseError, queryErrorMeta } from "@/lib/supabase-result";
import { QueryErrorState } from "@/components/query-error-state";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/operational-ui";
import { edgeFunctionErrorMessage } from "@/lib/edge-function-error";
import { toast } from "sonner";
import {
  type DiagnosisEnvStatus,
  type DiagnosisFailuresSummary,
  type DiagnosisFunnelRow,
  type DiagnosisOpsSnapshot,
  type DiagnosisRecentRow,
  type DiagnosisRevenueSummary,
  FUNNEL_STATUS_ORDER,
  canRetryDiagnosis,
  centsToBrl,
  diagnosisReportUrl,
  diagnosisStatusLabel,
  exportDiagnosisCsv,
  failureCategoryLabel,
} from "@/lib/platform-diagnosis-ops";

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
  ) : (
    <XCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
  );
}

const REVENUE_DAYS = 7;
const FUNNEL_DAYS = 7;

function siteBase(): string {
  const env =
    typeof import.meta.env.VITE_PUBLIC_SITE_URL === "string"
      ? import.meta.env.VITE_PUBLIC_SITE_URL.trim()
      : "";
  if (env) return env.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function PlatformDiagnosisSection() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [failedOnly24h, setFailedOnly24h] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#diagnostico-funil") return;
    const el = document.getElementById("diagnostico-funil");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [
      "platform-diagnosis",
      statusFilter,
      failedOnly24h,
      page,
      REVENUE_DAYS,
      FUNNEL_DAYS,
    ],
    meta: queryErrorMeta,
    queryFn: async () => {
      const [
        snapshotRes,
        funnelRes,
        listRes,
        revenueRes,
        failuresRes,
        envRes,
      ] = await Promise.all([
        supabase.rpc("platform_diagnosis_ops_snapshot"),
        supabase.rpc("platform_diagnosis_funnel_counts", {
          p_days: FUNNEL_DAYS,
        }),
        supabase.rpc("platform_diagnosis_list_recent", {
          p_limit: pageSize,
          p_offset: page * pageSize,
          p_status: statusFilter || undefined,
          p_failed_only_24h: failedOnly24h,
        }),
        supabase.rpc("platform_diagnosis_revenue_summary", {
          p_days: REVENUE_DAYS,
        }),
        supabase.rpc("platform_diagnosis_failures_summary", {
          p_days: REVENUE_DAYS,
        }),
        supabase.functions.invoke("diagnosis-env-status", { body: {} }),
      ]);

      throwIfSupabaseError(snapshotRes.error, "platform_diagnosis.snapshot");
      throwIfSupabaseError(funnelRes.error, "platform_diagnosis.funnel");
      throwIfSupabaseError(listRes.error, "platform_diagnosis.list");
      throwIfSupabaseError(revenueRes.error, "platform_diagnosis.revenue");
      throwIfSupabaseError(failuresRes.error, "platform_diagnosis.failures");

      let envStatus: DiagnosisEnvStatus | null = null;
      let envFnError: string | null = null;
      if (envRes.error) {
        envFnError = await edgeFunctionErrorMessage(
          envRes.error,
          envRes.error.message,
        );
      } else if (envRes.data && typeof envRes.data === "object") {
        envStatus = envRes.data as DiagnosisEnvStatus;
      }

      return {
        snapshot: snapshotRes.data as DiagnosisOpsSnapshot,
        funnel: (funnelRes.data ?? []) as DiagnosisFunnelRow[],
        list: (listRes.data ?? []) as DiagnosisRecentRow[],
        revenue: revenueRes.data as DiagnosisRevenueSummary,
        failures: failuresRes.data as DiagnosisFailuresSummary,
        envStatus,
        envFnError,
      };
    },
  });

  const opsMutation = useMutation({
    mutationFn: async (payload: {
      action: "retry_ai" | "reprocess" | "cleanup_stale";
      diagnosis_id?: string;
      secret_slug?: string;
    }) => {
      const res = await supabase.functions.invoke("diagnosis-platform-ops", {
        body: payload,
      });
      if (res.error) {
        throw new Error(
          await edgeFunctionErrorMessage(res.error, res.error.message),
        );
      }
      const body = res.data as { error?: string; ok?: boolean; cleaned?: number };
      if (body?.error) throw new Error(body.error);
      return body;
    },
    onSuccess: (body, vars) => {
      if (vars.action === "cleanup_stale") {
        toast.success(
          `Limpeza concluída${body.cleaned != null ? `: ${body.cleaned} registro(s)` : ""}.`,
        );
      } else {
        toast.success("Diagnóstico reenfileirado para processamento.");
      }
      void queryClient.invalidateQueries({ queryKey: ["platform-diagnosis"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Falha na ação");
    },
  });

  const cancelSubMutation = useMutation({
    mutationFn: async (payload: { diagnosis_id: string; reason: string }) => {
      const res = await supabase.functions.invoke("cancel-management-subscription", {
        body: payload,
      });
      if (res.error) {
        throw new Error(
          await edgeFunctionErrorMessage(res.error, res.error.message),
        );
      }
      const body = res.data as { error?: string; ok?: boolean; already_cancelled?: boolean };
      if (body?.error) throw new Error(body.error);
      return body;
    },
    onSuccess: (body) => {
      toast.success(
        body?.already_cancelled
          ? "Assinatura já estava cancelada."
          : "Assinatura cancelada no Mercado Pago.",
      );
      void queryClient.invalidateQueries({ queryKey: ["platform-diagnosis"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Falha ao cancelar assinatura");
    },
  });

  const funnelChart = useMemo(() => {
    const map = new Map(data?.funnel.map((f) => [f.status, Number(f.cnt)]));
    return FUNNEL_STATUS_ORDER.map((status) => ({
      status,
      label: diagnosisStatusLabel(status),
      count: map.get(status) ?? 0,
    })).filter((r) => r.count > 0);
  }, [data?.funnel]);

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

  const snap = data!.snapshot;
  const revenue = data!.revenue;
  const failures = data!.failures;
  const base = siteBase();

  return (
    <section
      id="diagnostico-funil"
      className="space-y-6 border-t border-border pt-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Stethoscope className="h-5 w-5" />
            <h2 className="text-xl font-semibold tracking-tight">
              Funil Diagnóstico Meta
            </h2>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Console operacional do produto diagnóstico (todas as vendas). Links
            de relatório contêm segredo na URL — use só para QA interno.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={opsMutation.isPending}
            onClick={() =>
              opsMutation.mutate({ action: "cleanup_stale" })
            }
          >
            Limpar processamentos presos
          </Button>
        </div>
      </div>

      {snap.stale_processing > 0 ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{snap.stale_processing}</strong> diagnóstico(s) em
            processamento há mais de 30 minutos. Considere limpar ou
            reprocessar.
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard title="Total (histórico)" value={String(snap.total_all_time)} />
        <KpiCard title="Processando agora" value={String(snap.processing)} />
        <KpiCard
          title="Aguardando pagamento"
          value={String(snap.awaiting_payment)}
        />
        <KpiCard
          title="Aguardando Meta"
          value={String(snap.awaiting_connection)}
        />
        <KpiCard title="Concluídos (24h)" value={String(snap.completed_24h)} />
        <KpiCard title="Falhas (24h)" value={String(snap.failed_24h)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Receita (${REVENUE_DAYS}d)`} />
          <div className="grid gap-3 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Checkouts iniciados</p>
              <p className="text-2xl font-semibold tabular-nums">
                {revenue.checkout_started_count}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Diagnósticos pagos</p>
              <p className="text-2xl font-semibold tabular-nums">
                {revenue.diagnosis_paid_count}
              </p>
              <p className="text-xs text-muted-foreground">
                {centsToBrl(revenue.diagnosis_revenue_cents)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Gestão paga</p>
              <p className="text-2xl font-semibold tabular-nums">
                {revenue.management_paid_count}
              </p>
              <p className="text-xs text-muted-foreground">
                {centsToBrl(revenue.management_revenue_cents)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Conversão checkout → pago</p>
              <p className="text-2xl font-semibold tabular-nums">
                {revenue.conversion_checkout_to_paid_pct}%
              </p>
              <p className="text-xs text-muted-foreground">
                Pago → relatório: {revenue.conversion_paid_to_completed_pct}%
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={`Falhas (${failures.days}d)`} />
          <div className="space-y-2 p-4 text-sm">
            {failures.total_failed === 0 ? (
              <p className="text-muted-foreground">Nenhuma falha no período.</p>
            ) : (
              <>
                <p className="text-muted-foreground">
                  Total: <strong>{failures.total_failed}</strong>
                </p>
                <ul className="space-y-1.5">
                  {(failures.categories ?? []).map((c) => (
                    <li
                      key={c.category}
                      className="flex justify-between gap-2 border-b border-border/50 py-1"
                    >
                      <span>{failureCategoryLabel(c.category)}</span>
                      <span className="font-mono tabular-nums">{c.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>
      </div>

      {funnelChart.length > 0 ? (
        <Card>
          <CardHeader title={`Funil por status (${FUNNEL_DAYS}d)`} />
          <div className="h-56 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelChart} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Ambiente do funil" />
        <div className="space-y-3 p-4 text-sm">
          {data?.envFnError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
              {data.envFnError}
            </p>
          ) : data?.envStatus ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              <EnvRow label="PUBLIC_SITE_URL" ok={data.envStatus.public_site_url_ok} />
              <EnvRow
                label="MERCADOPAGO_ACCESS_TOKEN"
                ok={data.envStatus.mercadopago_access_token_ok}
              />
              <EnvRow
                label="MERCADOPAGO_WEBHOOK_SECRET"
                ok={data.envStatus.mercadopago_webhook_secret_ok}
              />
              <EnvRow
                label="MERCADOPAGO_PUBLIC_KEY"
                ok={data.envStatus.mercadopago_public_key_ok}
              />
              <EnvRow label="META_APP_ID" ok={data.envStatus.meta_app_id_ok} />
              <EnvRow
                label="META_APP_SECRET"
                ok={data.envStatus.meta_app_secret_ok}
              />
              <EnvRow
                label="OAUTH_STATE_SECRET"
                ok={data.envStatus.oauth_state_secret_ok}
              />
              <EnvRow label="CRON_SECRET" ok={data.envStatus.cron_secret_ok} />
              <EnvRow
                label="ANTHROPIC_API_KEY"
                ok={data.envStatus.anthropic_api_key_ok}
              />
              <EnvRow
                label="GEMINI_API_KEY (fallback)"
                ok={data.envStatus.gemini_api_key_ok}
              />
            </ul>
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Diagnósticos recentes</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-xs"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Todos os status</option>
              {FUNNEL_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {diagnosisStatusLabel(s)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={failedOnly24h}
                onChange={(e) => {
                  setFailedOnly24h(e.target.checked);
                  setPage(0);
                }}
              />
              Falhas 24h
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const csv = exportDiagnosisCsv(data!.list);
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `diagnosis-export-${Date.now()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          {!data?.list.length ? (
            <p className="text-sm text-muted-foreground">Nenhum registro.</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Criado</th>
                  <th className="pb-2 pr-2 font-medium">Status</th>
                  <th className="pb-2 pr-2 font-medium">E-mail</th>
                  <th className="pb-2 pr-2 font-medium">Pagamento</th>
                  <th className="pb-2 pr-2 font-medium">Prompt</th>
                  <th className="pb-2 pr-2 font-medium">Falha</th>
                  <th className="pb-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.list.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-2 pr-2 whitespace-nowrap text-muted-foreground">
                      {new Date(row.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-2">
                      <span className="font-medium">
                        {diagnosisStatusLabel(row.status)}
                      </span>
                      {row.management_status === "paid" ? (
                        <span className="ml-1 text-emerald-600">+ gestão</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 font-mono">
                      {row.payer_email_masked ?? "—"}
                    </td>
                    <td className="py-2 pr-2">
                      {row.payment_method ?? "—"}{" "}
                      <span className="text-muted-foreground">
                        {centsToBrl(row.amount_cents)}
                      </span>
                    </td>
                    <td className="py-2 pr-2 font-mono">
                      {row.prompt_version ?? "—"}
                    </td>
                    <td
                      className="max-w-[140px] truncate py-2 pr-2 text-muted-foreground"
                      title={row.failed_reason_short ?? undefined}
                    >
                      {row.failed_reason_short ?? "—"}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {base ? (
                          <a
                            href={diagnosisReportUrl(
                              base,
                              row.id,
                              row.secret_slug,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 hover:bg-muted"
                          >
                            <ExternalLink className="h-3 w-3" />
                            QA
                          </a>
                        ) : null}
                        {row.status === "failed" ? (
                          <>
                            {canRetryDiagnosis(row) ? (
                              <button
                                type="button"
                                className="rounded border px-1.5 py-0.5 hover:bg-muted disabled:opacity-50"
                                disabled={opsMutation.isPending}
                                onClick={() =>
                                  opsMutation.mutate({
                                    action: "retry_ai",
                                    diagnosis_id: row.id,
                                    secret_slug: row.secret_slug,
                                  })
                                }
                              >
                                Retry IA
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="rounded border px-1.5 py-0.5 hover:bg-muted disabled:opacity-50"
                              disabled={opsMutation.isPending}
                              onClick={() =>
                                opsMutation.mutate({
                                  action: "reprocess",
                                  diagnosis_id: row.id,
                                  secret_slug: row.secret_slug,
                                })
                              }
                            >
                              Reprocessar
                            </button>
                          </>
                        ) : row.status === "processing" ? (
                          <button
                            type="button"
                            className="rounded border px-1.5 py-0.5 hover:bg-muted disabled:opacity-50"
                            disabled={opsMutation.isPending}
                            onClick={() =>
                              opsMutation.mutate({
                                action: "reprocess",
                                diagnosis_id: row.id,
                                secret_slug: row.secret_slug,
                              })
                            }
                          >
                            Reprocessar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
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
            disabled={!data?.list.length || data.list.length < pageSize}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Runbook:{" "}
        <code className="rounded bg-muted px-1">docs/diagnostico-meta-runbook.md</code>
        {" · "}
        Snapshot:{" "}
        {snap.captured_at
          ? new Date(snap.captured_at).toLocaleString("pt-BR")
          : "—"}
      </p>
    </section>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="p-4 text-3xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function EnvRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <StatusDot ok={ok} />
      <span className="font-mono text-[11px]">{label}</span>
    </li>
  );
}
