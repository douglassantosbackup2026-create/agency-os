import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { invokeDiagnosisFunction } from "@/lib/diagnosis-invoke";

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
  // Meta account_status: 1 Active, 2 Disabled, 3 Unsettled, 7 Pending Risk,
  // 8 Pending Settlement, 9 In Grace, 101 Closed, etc.
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
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!diagnosisId || !s) return;
    (async () => {
      try {
        const res = await invokeDiagnosisFunction("diagnosis-status", {
          method: "GET",
          query: { d: diagnosisId, s },
        });
        const j = (await res.json()) as StatusResponse & { error?: string };
        if (!alive) return;
        if (!res.ok) {
          setLoadErr(j.error ?? "Erro ao carregar contas.");
          return;
        }
        setData(j);
      } catch (e) {
        if (alive) setLoadErr((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [diagnosisId, s]);

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
      const res = await invokeDiagnosisFunction("confirm-ad-account", {
        method: "POST",
        body: JSON.stringify({
          diagnosisId,
          secretSlug: s,
          accountId,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setSubmitErr(j.error ?? "Falha ao confirmar conta.");
        setSubmitting(null);
        return;
      }
      navigate({
        to: "/obrigado",
        search: { d: diagnosisId, s, step: "processing" },
      });
    } catch (e) {
      setSubmitErr((e as Error).message);
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
          <div>
            <h1 className="text-xl font-semibold">Não consegui carregar</h1>
            <p className="mt-1 text-sm text-muted-foreground">{loadErr}</p>
            <Link
              to="/obrigado"
              search={{ d: diagnosisId, s }}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
            >
              Voltar
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
                  <span className={`text-xs font-medium ${st.tone}`}>
                    • {st.label}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  ID: {a.id ?? `act_${a.account_id ?? ""}`}
                  {a.currency ? ` · ${a.currency}` : ""}
                  {a.business_name && a.business_name !== a.name
                    ? ` · ${a.business_name}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => confirm(a)}
                disabled={disabled}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isSubmitting ? "A confirmar…" : "Analisar esta conta"}
              </button>
            </li>
          );
        })}
      </ul>

      {submitErr ? (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {submitErr}
        </div>
      ) : null}

      <p className="mt-6 text-xs text-muted-foreground">
        Não vês a conta certa? Verifica se o utilizador Facebook que conectaste
        tem acesso a essa conta de anúncio no Business Manager e tenta
        novamente.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <div className="rounded-2xl border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
