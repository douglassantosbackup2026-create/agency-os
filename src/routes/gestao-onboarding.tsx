import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { callDiagnosisApi } from "@/lib/diagnosis-api";
import { invokeDiagnosisFunction } from "@/lib/diagnosis-invoke";
import { InlineErrorBanner } from "@/components/diagnosis-funnel/InlineErrorBanner";
import { ACCESS_CHECKLIST_OPTIONS } from "@/lib/management-onboarding";
import { Loader2 } from "lucide-react";
import "@/styles/diagnosis.css";

type Search = { d?: string; s?: string };

export const Route = createFileRoute("/gestao-onboarding")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    d: typeof search.d === "string" ? search.d : undefined,
    s: typeof search.s === "string" ? search.s : undefined,
  }),
  component: GestaoOnboardingPage,
});

function GestaoOnboardingPage() {
  const { d, s } = Route.useSearch();
  const [loading, setLoading] = useState(true);
  const [gateError, setGateError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [roasGoal, setRoasGoal] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [accessChecklist, setAccessChecklist] = useState<string[]>([]);

  useEffect(() => {
    if (!d || !s) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const j = await callDiagnosisApi<{ management_status?: string }>(
          "management-payment-status",
          { query: { d, s } },
        );
        if (cancelled) return;
        if (j.management_status !== "paid") {
          setGateError("O pagamento da gestão ainda não foi confirmado.");
        }
      } catch (e) {
        if (!cancelled) {
          setGateError(
            e instanceof Error ? e.message : "Não foi possível validar o pagamento.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [d, s]);

  function toggleAccess(id: string) {
    setAccessChecklist((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!d || !s) return;
    setSubmitError(null);
    setLoading(true);
    try {
      await invokeDiagnosisFunction("submit-management-onboarding", {
        method: "POST",
        body: JSON.stringify({
          diagnosis_id: d,
          secret_slug: s,
          monthly_ad_budget: monthlyBudget ? Number(monthlyBudget) : null,
          roas_goal: roasGoal,
          preferred_contact_time: preferredTime,
          access_notes: accessNotes,
          access_checklist: accessChecklist,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Falha ao enviar formulário.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!d || !s) {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <div className="card">
            <h1>Link incompleto</h1>
            <p className="muted">Use o link completo após o pagamento (d e s).</p>
            <Link to="/" className="btn btn-outline">
              Voltar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="diagnosis-funnel">
      <div className="container">
        <div className="card">
          <h1 style={{ marginTop: 0 }}>Onboarding — gestão de tráfego</h1>
          <p className="muted">
            Preencha em ~5 minutos para iniciarmos em até 24h. Dúvidas urgentes:
            use o WhatsApp na página anterior.
          </p>

          {loading && !submitted ? (
            <p className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> A validar pagamento…
            </p>
          ) : null}

          {gateError ? (
            <InlineErrorBanner message={gateError} className="mt-4" />
          ) : null}

          {submitted ? (
            <div className="mt-4">
              <p>
                <strong>Formulário enviado.</strong> Entraremos em contacto em até
                24h para alinhar acessos e prioridades.
              </p>
              <Link
                to="/gestao-obrigado"
                search={{ d, s }}
                className="btn btn-outline mt-4"
              >
                Voltar à confirmação
              </Link>
            </div>
          ) : !gateError ? (
            <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Budget mensal de mídia (R$)</span>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  placeholder="Ex.: 15000"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Meta de ROAS ou CPA</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  value={roasGoal}
                  onChange={(e) => setRoasGoal(e.target.value)}
                  placeholder="Ex.: ROAS 4x ou CPA R$ 45"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Melhor horário para kickoff</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  placeholder="Ex.: manhãs, 14h–17h"
                />
              </label>
              <fieldset>
                <legend className="text-sm font-medium">Acessos a preparar</legend>
                <div className="mt-2 space-y-2">
                  {ACCESS_CHECKLIST_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={accessChecklist.includes(opt.id)}
                        onChange={() => toggleAccess(opt.id)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className="text-sm font-medium">Observações</span>
                <textarea
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  rows={3}
                  value={accessNotes}
                  onChange={(e) => setAccessNotes(e.target.value)}
                  placeholder="Links, senhas provisórias, contexto do negócio…"
                />
              </label>
              {submitError ? (
                <InlineErrorBanner message={submitError} />
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading ? (
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                ) : null}
                Enviar onboarding
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
