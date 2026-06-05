import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { callDiagnosisApi } from "@/lib/diagnosis-api";
import { resolveSupabaseUrl } from "@/lib/supabase-config";
import {
  buildGestaoIntroMessage,
  whatsappGestaoHref,
} from "@/lib/gestao-whatsapp";
import { useManagementCheckout } from "@/hooks/use-management-checkout";
import type { DiagnosisAnalysis } from "@/components/diagnosis-report/types";
import { DiagnosisExecutiveReport } from "@/components/diagnosis-report/executive/DiagnosisExecutiveReport";
import { InlineErrorBanner } from "@/components/diagnosis-funnel/InlineErrorBanner";
import { DiagnosisFailedPanel } from "@/components/diagnosis-funnel/DiagnosisFailedPanel";
import { parseDiagnosisFailedReason } from "@/lib/diagnosis-failed-reason";
import { reportFunnelError } from "@/lib/report-error";
import "@/styles/diagnosis-executive.css";

const GESTAO_URGENCY_TEXT =
  import.meta.env.VITE_GESTAO_URGENCY_TEXT?.trim() ||
  "Condição especial para as próximas 2 operações";

type DiagnosticoSearch = { s?: string; gestaoCheckout?: string };

type BusinessContext = {
  niche?: string | null;
  avg_ticket_brl?: number | null;
  margin_pct?: number | null;
  monthly_goal_brl?: number | null;
  target_roas?: number | null;
  notes?: string | null;
  saved_at?: string | null;
};

export const Route = createFileRoute("/diagnostico/$diagnosisId")({
  validateSearch: (search: Record<string, unknown>): DiagnosticoSearch => ({
    s: typeof search.s === "string" ? search.s : undefined,
    gestaoCheckout:
      typeof search.gestaoCheckout === "string"
        ? search.gestaoCheckout
        : undefined,
  }),
  component: DiagnosticoReportPage,
});

function DiagnosticoReportPage() {
  const { diagnosisId } = Route.useParams();
  const { s, gestaoCheckout } = Route.useSearch();
  const mgmt = useManagementCheckout();
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");

  const [data, setData] = useState<{
    diagnosis?: {
      status?: string;
      failed_reason?: string | null;
      management_status?: string | null;
      management_business_name?: string | null;
      business_context?: BusinessContext | null;
      completed_at?: string | null;
    };
    report?: {
      analysis_json?: DiagnosisAnalysis | null;
      management_cta_eligible?: boolean;
      prompt_version?: string | null;
    } | null;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  const refetchReport = useCallback(() => {
    setErr(null);
    setData(null);
    setLoadKey((k) => k + 1);
  }, []);

  const metaOAuthUrl = useMemo(() => {
    if (!s) return "";
    const base = resolveSupabaseUrl();
    return base
      ? `${base}/functions/v1/meta-oauth-start?d=${encodeURIComponent(diagnosisId)}&s=${encodeURIComponent(s)}`
      : "";
  }, [diagnosisId, s]);

  useEffect(() => {
    document.title = "Diagnóstico Executivo Meta Ads — Retentio";
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, nofollow");
  }, []);

  useEffect(() => {
    if (!s) return;
    void callDiagnosisApi("diagnosis-track", {
      method: "POST",
      body: JSON.stringify({
        diagnosis_id: diagnosisId,
        secret_slug: s,
        event: "viewed",
      }),
    }).catch((e) => reportFunnelError("diagnosis.track_failed", e));
  }, [diagnosisId, s]);

  useEffect(() => {
    if (!s) {
      setErr(
        "Falta o parâmetro secreto (s) na URL. Usa o link completo guardado.",
      );
      return;
    }
    let alive = true;
    (async () => {
      try {
        const j = await callDiagnosisApi<typeof data>("diagnosis-report", {
          query: { d: diagnosisId, s },
        });
        if (alive) setData(j);
      } catch (e) {
        if (alive) {
          const message = e instanceof Error ? e.message : "Erro";
          setErr(message);
          reportFunnelError("diagnosis.report_fetch_failed", e);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [diagnosisId, s, loadKey]);

  useEffect(() => {
    if (data?.diagnosis?.status !== "failed" || !data.diagnosis.failed_reason) {
      return;
    }
    const parsed = parseDiagnosisFailedReason(data.diagnosis.failed_reason);
    if (parsed.telemetryKind) {
      reportFunnelError("diagnosis.ai_providers_failed", {
        kind: parsed.telemetryKind,
        diagnosisId,
      });
    }
  }, [data?.diagnosis?.status, data?.diagnosis?.failed_reason, diagnosisId]);

  const analysis = data?.report?.analysis_json;

  function trackEvent(event: string) {
    if (!s) return;
    void callDiagnosisApi("diagnosis-track", {
      method: "POST",
      body: JSON.stringify({ diagnosis_id: diagnosisId, secret_slug: s, event }),
    }).catch((e) => reportFunnelError("diagnosis.track_failed", e));
  }

  async function trackCta() {
    if (!s) return;
    try {
      await callDiagnosisApi("diagnosis-track", {
        method: "POST",
        body: JSON.stringify({
          diagnosis_id: diagnosisId,
          secret_slug: s,
          event: "cta",
        }),
      });
    } catch (e) {
      reportFunnelError("diagnosis.track_failed", e);
    }
  }

  const managementPaid = data?.diagnosis?.management_status === "paid";
  const whatsappGestaoLink = useMemo(() => {
    if (!managementPaid || !data?.diagnosis) return "";
    return whatsappGestaoHref(
      buildGestaoIntroMessage({
        diagnosisId,
        storeName: data.diagnosis.management_business_name ?? undefined,
      }),
    );
  }, [managementPaid, data?.diagnosis, diagnosisId]);

  function scrollToManagementCta() {
    document.getElementById("sec-cta")?.scrollIntoView({ behavior: "smooth", block: "start" });
    trackEvent("cta_scroll");
  }

  // ---------- Error / loading shells (premium dark) ----------
  if (!s) {
    return (
      <div className="exec-root">
        <div className="exec-state">
          <div className="exec-state-card">
            <h1>Link incompleto</h1>
            <p>Abre o diagnóstico pelo link completo da página de obrigado (URL com ?s=...).</p>
            <Link to="/" className="exec-btn exec-btn-ghost">Voltar ao início</Link>
          </div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="exec-root">
        <div className="exec-state">
          <div className="exec-state-card">
            <h1>Não foi possível abrir</h1>
            <InlineErrorBanner
              message={err}
              onRetry={refetchReport}
              className="mt-4 text-left"
            />
            {s ? (
              <Link
                to="/obrigado"
                search={{ d: diagnosisId, s }}
                className="exec-btn exec-btn-ghost mt-4 inline-flex"
              >
                Ver status do pedido
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (!data?.diagnosis) {
    return (
      <div className="exec-root">
        <div className="exec-state">
          <div className="exec-state-card">
            <p style={{ letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 12, opacity: 0.6 }}>
              Carregando análise…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (
    data.diagnosis.status === "processing" ||
    data.diagnosis.status === "awaiting_connection"
  ) {
    return (
      <div className="exec-root">
        <div className="exec-state">
          <div className="exec-state-card">
            <h1>Ainda processando</h1>
            <p>Volta em instantes ou mantém a página de obrigado aberta.</p>
            <Link to="/obrigado" search={{ d: diagnosisId, s }} className="exec-btn exec-btn-ghost">
              Status do pedido
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (data.diagnosis.status === "failed") {
    return (
      <div className="exec-root">
        <div className="exec-state">
          <div className="exec-state-card exec-state-card-wide">
            <DiagnosisFailedPanel
              failedReason={data.diagnosis.failed_reason}
              diagnosisId={diagnosisId}
              secretSlug={s!}
              metaOAuthUrl={metaOAuthUrl}
              title="Diagnóstico falhou"
              className=""
              showHomeLink={false}
              showStatusLink
              onRetrySuccess={refetchReport}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="exec-root">
        <div className="exec-state">
          <div className="exec-state-card">
            <p>Relatório indisponível.</p>
          </div>
        </div>
      </div>
    );
  }

  const score = analysis.score ?? 0;
  const gapCta =
    analysis.growthIntelligenceDerived?.executiveImpact.gapMonthlyBrl ??
    analysis.financialImpact?.primaryGapMonthlyBrl ??
    analysis.financialImpact?.lossMonthlyBrl ??
    0;
  const gapCtaFormatted =
    gapCta > 0
      ? gapCta.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        })
      : null;
  const consultWhatsappHref = whatsappGestaoHref(
    gapCtaFormatted
      ? `Olá! Concluí o diagnóstico Meta Ads (score ${score}/100). Quero recuperar ${gapCtaFormatted}/mês que estão ficando na mesa. ID: ${diagnosisId}`
      : `Olá! Concluí o diagnóstico Meta Ads (score ${score}/100). Gostaria de conversar sobre os próximos passos. ID: ${diagnosisId}`,
  );

  const fi = analysis.financialImpact;
  const annualOpp =
    analysis.growthIntelligenceDerived?.executiveImpact.gapAnnualBrl ??
    (gapCta > 0 ? gapCta * 12 : (fi?.recoveryOptimisticBrl ?? fi?.recoveryConservativeBrl ?? fi?.lossMonthlyBrl ?? 0) * 12);
  const annualFormatted = annualOpp > 0
    ? annualOpp.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : null;

  const ctaEligible = data.report?.management_cta_eligible;

  return (
    <>
      <DiagnosisExecutiveReport
        analysis={analysis}
        primaryCtaLabel="Agendar Reunião Estratégica"
        onPrimaryCta={() => {
          if (ctaEligible) scrollToManagementCta();
          else {
            void trackCta();
            window.open(consultWhatsappHref, "_blank", "noopener,noreferrer");
          }
        }}
      />

      {/* ============ SECTION 10 — CTA FINAL ============ */}
      {ctaEligible ? (
        <div className="exec-root" style={{ background: "transparent", minHeight: 0 }}>
          <div className="exec-container" style={{ paddingBottom: 96 }}>
            <section className="exec-cta-final" id="sec-cta">
              {gestaoCheckout === "falha" ? (
                <p className="exec-cta-error" role="alert">
                  O Mercado Pago não concluiu o pagamento. Você pode tentar de novo a seguir.
                </p>
              ) : gestaoCheckout === "pending" ? (
                <p className="exec-cta-note" style={{ marginBottom: 16 }}>
                  Pagamento pendente no Mercado Pago. Esta página será atualizada quando o status for confirmado.
                </p>
              ) : null}

              {managementPaid ? (
                <>
                  <div className="exec-eyebrow">
                    <span className="exec-eyebrow-num">10</span>
                    <span className="exec-eyebrow-rule" />
                    <span>Próximo passo</span>
                  </div>
                  <h2 className="exec-headline">
                    Estamos prontos para <span className="accent">começar</span>.
                  </h2>
                  <p className="exec-subhead">
                    Pagamento registrado. Fale com a gente no WhatsApp pelo link abaixo — já incluímos os dados da loja indicada.
                  </p>
                  {whatsappGestaoLink ? (
                    <div className="exec-cta-row">
                      <a
                        className="exec-btn exec-btn-primary"
                        href={whatsappGestaoLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => void trackCta()}
                      >
                        Abrir WhatsApp <span className="exec-btn-arrow">→</span>
                      </a>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="exec-eyebrow">
                    <span className="exec-eyebrow-num">10</span>
                    <span className="exec-eyebrow-rule" />
                    <span>Próximo passo recomendado</span>
                  </div>
                  <h2 className="exec-headline">
                    {gapCtaFormatted ? (
                      <>
                        Quero recuperar <span className="accent">{gapCtaFormatted}</span> que estão ficando na mesa.
                      </>
                    ) : annualFormatted ? (
                      <>
                        Existe uma oportunidade estimada de <span className="accent">{annualFormatted}</span> por ano identificada nesta análise.
                      </>
                    ) : (
                      <>O próximo passo é definir um <span className="accent">plano de implementação</span>.</>
                    )}
                  </h2>
                  <p className="exec-subhead">
                    Agora que os gargalos foram identificados, o próximo passo é executar.
                    Você pode fazer internamente — ou ter uma equipe especializada aplicando as correções deste relatório todos os dias.
                  </p>

                  <div className="exec-cta-form">
                    <div className="exec-cta-field">
                      <span className="exec-cta-field-label">Nome da loja</span>
                      <input
                        className="exec-cta-input"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        autoComplete="organization"
                        maxLength={240}
                        required
                      />
                    </div>
                    <div className="exec-cta-field">
                      <span className="exec-cta-field-label">Site principal</span>
                      <input
                        className="exec-cta-input"
                        type="url"
                        inputMode="url"
                        placeholder="https://..."
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        maxLength={500}
                        required
                      />
                    </div>
                    <div className="exec-cta-field">
                      <span className="exec-cta-field-label">Instagram</span>
                      <input
                        className="exec-cta-input"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        maxLength={240}
                        placeholder="@loja ou link"
                        required
                      />
                    </div>
                  </div>

                  {mgmt.error ? <p className="exec-cta-error">{mgmt.error}</p> : null}

                  <div className="exec-cta-row" style={{ marginTop: 24 }}>
                    <button
                      type="button"
                      className="exec-btn exec-btn-primary"
                      disabled={
                        mgmt.loading ||
                        !businessName.trim() ||
                        !website.trim() ||
                        !instagram.trim()
                      }
                      onClick={() =>
                        void mgmt.checkout({
                          diagnosisId,
                          secretSlug: s ?? "",
                          business_name: businessName.trim(),
                          website: website.trim(),
                          instagram: instagram.trim(),
                        })
                      }
                    >
                      {mgmt.loading
                        ? "Abrindo Mercado Pago…"
                        : gapCtaFormatted
                          ? `Quero recuperar ${gapCtaFormatted}/mês`
                          : "Solicitar Reunião Estratégica"}
                      <span className="exec-btn-arrow">→</span>
                    </button>
                    <a
                      className="exec-btn exec-btn-ghost"
                      href={consultWhatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => void trackCta()}
                    >
                      Receber Plano Completo
                    </a>
                  </div>

                  <p className="exec-cta-note" style={{ marginTop: 20 }}>
                    {GESTAO_URGENCY_TEXT} · 2 vagas disponíveis.
                  </p>
                </>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
