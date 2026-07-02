import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { callDiagnosisApi } from "@/lib/diagnosis-api";
import {
  buildGestaoIntroMessage,
  whatsappGestaoHref,
} from "@/lib/gestao-whatsapp";
import { useDiagnosisPoll } from "@/hooks/use-diagnosis-poll";
import { InlineErrorBanner } from "@/components/diagnosis-funnel/InlineErrorBanner";
import { GESTAO_PRODUCT, trackMetaPurchase } from "@/lib/meta-pixel";
import { reportFunnelError } from "@/lib/report-error";
import { logManagementHandoff } from "@/lib/log-management-handoff";
import "@/styles/diagnosis.css";

type GestaoObrigadoSearch = { d?: string; s?: string };

type StatusPayload = {
  management_status?: string | null;
  management_business_name?: string | null;
  management_payment_method?: string | null;
  management_onboarding_status?: string | null;
  portal_slug?: string | null;
  subscription?: {
    status: string;
    next_payment_date: string | null;
    cancelled_at: string | null;
  } | null;
};

const POLL_MS = 5000;
const TIMEOUT_MS = 180_000;

export const Route = createFileRoute("/gestao-obrigado")({
  validateSearch: (search: Record<string, unknown>): GestaoObrigadoSearch => ({
    d: typeof search.d === "string" ? search.d : undefined,
    s: typeof search.s === "string" ? search.s : undefined,
  }),
  component: GestaoObrigadoPage,
});

function GestaoObrigadoPage() {
  const { d, s } = Route.useSearch();
  const [snapshot, setSnapshot] = useState<StatusPayload | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!d || !s) return;
    try {
      localStorage.setItem(`diagnosis_${d}`, s);
    } catch {
      /* ignore */
    }
  }, [d, s]);

  const { pollError, retryNow } = useDiagnosisPoll({
    enabled: Boolean(d && s),
    intervalMs: POLL_MS,
    maxDurationMs: TIMEOUT_MS,
    onTick: async () => {
      const j = await callDiagnosisApi<StatusPayload>("management-payment-status", {
        query: { d: d!, s: s! },
      });
      setSnapshot(j);
      if (j.management_status === "paid") {
        setTimedOut(false);
        return "stop";
      }
      return "continue";
    },
  });

  const confirmed = snapshot?.management_status === "paid";
  const hasPortal = Boolean(snapshot?.portal_slug);

  // Poll leve pós-pagamento até o portal estar disponível (provisionamento).
  useEffect(() => {
    if (!d || !s || !confirmed || hasPortal) return;

    let alive = true;
    const pollPortal = async () => {
      try {
        const j = await callDiagnosisApi<StatusPayload>("management-payment-status", {
          query: { d, s },
        });
        if (!alive) return;
        setSnapshot((prev) => (prev ? { ...prev, ...j } : j));
      } catch {
        /* ignore — poll silencioso */
      }
    };

    void pollPortal();
    const id = window.setInterval(() => void pollPortal(), 30_000);
    const stopAt = window.setTimeout(() => {
      alive = false;
      window.clearInterval(id);
    }, 30 * 60_000);

    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearTimeout(stopAt);
    };
  }, [d, s, confirmed, hasPortal]);

  useEffect(() => {
    if (!d || !s) return;
    if (snapshot?.management_status === "paid") return;
    const t = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [d, s, snapshot?.management_status]);

  useEffect(() => {
    if (pollError) {
      reportFunnelError("gestao.status_poll_failed", pollError);
    }
  }, [pollError]);

  useEffect(() => {
    if (!d || snapshot?.management_status !== "paid") return;
    trackMetaPurchase(GESTAO_PRODUCT, d);
  }, [d, snapshot?.management_status]);

  // Regista 1× que o cliente visualizou o estado pago (botão de WhatsApp visível).
  const viewLoggedRef = useRef(false);
  useEffect(() => {
    if (!d || !s) return;
    if (snapshot?.management_status !== "paid") return;
    if (viewLoggedRef.current) return;
    viewLoggedRef.current = true;
    logManagementHandoff({
      diagnosisId: d,
      secretSlug: s,
      kind: "whatsapp_view",
    });
  }, [d, s, snapshot?.management_status]);

  const waHref = useMemo(() => {
    if (!d) return "";
    const name =
      snapshot?.management_status === "paid"
        ? snapshot.management_business_name
        : null;
    return whatsappGestaoHref(
      buildGestaoIntroMessage({ diagnosisId: d, storeName: name }),
    );
  }, [d, snapshot?.management_status, snapshot?.management_business_name]);

  if (!d || !s) {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <div className="card">
            <h1>Link incompleto</h1>
            <p className="muted">
              Usa o link completo voltando do Mercado Pago (parâmetros d e s).
            </p>
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
        <div className="steps">
          <span className="step done">1. Diagnóstico</span>
          <span className="step done">2. Gestão — pagamento</span>
          <span className={confirmed ? "step done" : "step current"}>
            3. Confirmação
          </span>
        </div>

        <div className="card">
          <h1 style={{ marginTop: 0 }}>Gestão de tráfego para escala</h1>
          {!confirmed ? (
            <p>
              {timedOut
                ? "Ainda não recebemos a confirmação final do Mercado Pago nesta página. O pagamento pode demorar alguns minutos — actualiza dentro de instantes ou abre novamente este link pelo teu relatório."
                : "A aguardar confirmação do Mercado Pago… Esta página atualiza automaticamente."}
            </p>
          ) : (
            <>
              <p>
                <strong>1ª mensalidade confirmada</strong> para o pedido ligado ao
                teu diagnóstico (ID <code>{d}</code>). Próximo passo: preenche o
                formulário de onboarding para começarmos a estruturar a escala da sua operação.
              </p>
              {snapshot?.management_payment_method === "card" && snapshot?.subscription?.status === "authorized" ? (
                <p className="muted">
                  <strong>Renovação automática ativa.</strong>{" "}
                  {snapshot.subscription.next_payment_date
                    ? `Próxima cobrança em ${new Date(snapshot.subscription.next_payment_date).toLocaleDateString("pt-BR")}.`
                    : "Próxima cobrança em 30 dias."}{" "}
                  Sem fidelidade: para cancelar, basta nos avisar pelo WhatsApp antes do próximo ciclo.
                </p>
              ) : (
                <p className="muted">
                  A próxima cobrança acontece daqui a 30 dias — enviaremos um novo
                  link de pagamento pelo WhatsApp. Sem fidelidade: cancele quando
                  quiser antes do próximo ciclo.
                </p>
              )}
            </>
          )}
          {pollError ? (
            <InlineErrorBanner
              message={pollError}
              onRetry={retryNow}
              className="mt-4"
            />
          ) : null}
        </div>

        {(confirmed || timedOut) ? (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Próximos passos</h2>
            {confirmed ? (
              <>
                <Link
                  to="/gestao-onboarding"
                  search={{ d, s }}
                  className="btn btn-primary"
                  style={{ display: "block", textAlign: "center", marginBottom: "0.75rem" }}
                >
                  Preencher onboarding (5 min)
                </Link>
                {hasPortal && snapshot?.portal_slug ? (
                  <a
                    className="btn btn-outline"
                    href={`/p/${snapshot.portal_slug}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "block", textAlign: "center", marginBottom: "0.75rem" }}
                  >
                    Abrir portal do cliente
                  </a>
                ) : null}
              </>
            ) : null}
            {waHref ? (
              <>
                <p className="muted" style={{ fontSize: "0.9rem" }}>
                  Dúvidas urgentes:
                </p>
                <a
                  className="btn btn-outline"
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    logManagementHandoff({
                      diagnosisId: d,
                      secretSlug: s,
                      kind: "whatsapp_click",
                      payload: {
                        business_name:
                          snapshot?.management_business_name ?? null,
                        timed_out: timedOut,
                        confirmed,
                      },
                    });
                  }}
                >
                  WhatsApp — dúvidas urgentes
                </a>
              </>
            ) : null}
            <div style={{ marginTop: "1rem" }}>
              <Link
                to="/diagnostico/$diagnosisId"
                params={{ diagnosisId: d }}
                search={{ s }}
                className="btn btn-outline"
                onClick={() => {
                  logManagementHandoff({
                    diagnosisId: d,
                    secretSlug: s,
                    kind: "report_back_click",
                  });
                }}
              >
                Voltar ao relatório
              </Link>
            </div>
          </div>
        ) : null}

        {!confirmed ? (
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Estado da gestão:{" "}
            <strong>{snapshot?.management_status ?? "…"}</strong>
          </p>
        ) : null}
      </div>
    </div>
  );
}
