import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { callDiagnosisApi } from "@/lib/diagnosis-api";
import { InlineErrorBanner } from "@/components/diagnosis-funnel/InlineErrorBanner";
import { trackMetaCompleteRegistration } from "@/lib/meta-pixel";

type PendingAccount = {
  id?: string;
  account_id?: string;
  name?: string;
  currency?: string;
  account_status?: number;
  business_name?: string;
};

type StatusResponse = {
  status: string | null;
  pending_ad_accounts: PendingAccount[] | null;
  meta_ad_account_id: string | null;
};

type Search = { s?: string };

export const Route = createFileRoute("/diagnostico/$diagnosisId/conectar")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    s: typeof raw.s === "string" ? raw.s : undefined,
  }),
  component: ConnectAccountPage,
  head: () => ({
    meta: [{ title: "Escolha a conta de anúncio — Diagnóstico Meta" }],
  }),
});

function accountStatusLabel(n?: number): { label: string; tone: string } {
  if (n === 1) return { label: "Ativa", tone: "text-emerald-600" };
  if (n === 2 || n === 101)
    return { label: "Desativada", tone: "text-destructive" };
  if (n === undefined) return { label: "—", tone: "text-muted-foreground" };
  return { label: `Status ${n}`, tone: "text-amber-600" };
}

function ConnectAccountPage() {
  const { diagnosisId } = Route.useParams();
  const { s } = Route.useSearch();
  const navigate = useNavigate();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoadErr(null);
    setData(null);
    setLoadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    if (!diagnosisId || !s) return;
    (async () => {
      try {
        const j = await callDiagnosisApi<StatusResponse>("diagnosis-status", {
          query: { d: diagnosisId, s },
        });
        if (!alive) return;
        setData(j);
      } catch (e) {
        if (alive) {
          setLoadErr(e instanceof Error ? e.message : "Erro ao carregar contas.");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [diagnosisId, s, loadKey]);

  const accounts = useMemo(
    () => (data?.pending_ad_accounts ?? []).filter(Boolean),
    [data],
  );

  async function confirm(acc: PendingAccount): Promise<void> {
    if (!diagnosisId || !s) return;
    const accountId = acc.id ?? acc.account_id ?? "";
    if (!accountId) return;
    setSubmitErr(null);
    setSubmitting(accountId);
    try {
      const j = await callDiagnosisApi<{ ok?: boolean }>("confirm-ad-account", {
        method: "POST",
        body: JSON.stringify({
          diagnosisId,
          secretSlug: s,
          accountId,
        }),
      });
      if (!j.ok) {
        setSubmitErr("Falha ao confirmar conta.");
        setSubmitting(null);
        return;
      }
      trackMetaCompleteRegistration(
        "Conta Meta Ads selecionada",
        { content_ids: [diagnosisId] },
        diagnosisId,
      );
      navigate({
        to: "/obrigado",
        search: { d: diagnosisId, s },
      });
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "Erro");
      setSubmitting(null);
    }
  }

  if (!diagnosisId || !s) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Link incompleto</h1>
        <p className="mt-2 text-muted-foreground">
          Use o link completo enviado após o pagamento.
        </p>
      </Shell>
    );
  }

  if (loadErr) {
    return (
      <Shell>
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Não consegui carregar</h1>
            <InlineErrorBanner
              message={loadErr}
              onRetry={reload}
              className="mt-4"
            />
            <Link
              to="/obrigado"
              search={{ d: diagnosisId, s }}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
            >
              Voltar ao status
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>A carregar contas Meta…</span>
        </div>
      </Shell>
    );
  }

  if (data.status !== "awaiting_account_selection") {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Etapa já concluída</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta seleção já foi feita ou o diagnóstico está em outra etapa.
        </p>
        <Link
          to="/obrigado"
          search={{ d: diagnosisId, s }}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Ver status
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">
        Escolha a conta de anúncio a analisar
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Encontrámos {accounts.length} contas associadas ao teu Facebook.
        Seleciona qual queres que o diagnóstico use.
      </p>

      {submitErr ? (
        <InlineErrorBanner message={submitErr} className="mt-4" />
      ) : null}

      <ul className="mt-6 space-y-3">
        {accounts.map((a) => {
          const accountId = a.id ?? a.account_id ?? "";
          const st = accountStatusLabel(a.account_status);
          const isSubmitting = submitting === accountId;
          const disabled = submitting !== null;
          return (
            <li
              key={accountId}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-medium">
                    {a.name || a.business_name || "Sem nome"}
                  </p>
                  <CheckCircle2 className="hidden h-4 w-4 text-emerald-600 sm:inline" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  ID {a.account_id ?? accountId}
                  {a.currency ? ` · ${a.currency}` : ""}
                  {" · "}
                  <span className={st.tone}>{st.label}</span>
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void confirm(a)}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A confirmar…
                  </>
                ) : (
                  "Usar esta conta"
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  );
}
