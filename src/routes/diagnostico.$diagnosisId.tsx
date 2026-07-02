import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { callDiagnosisApi } from "@/lib/diagnosis-api";
import { resolveSupabaseUrl } from "@/lib/supabase-config";
import {
  buildGestaoIntroMessage,
  whatsappGestaoHref,
} from "@/lib/gestao-whatsapp";
import { gestaoCheckoutSearch } from "@/lib/gestao-checkout-url";
import { gestaoUrgencyText } from "@/content/gestao-checkout";
import type { DiagnosisAnalysis } from "@/components/diagnosis-report/types";
import { DiagnosisExecutiveReport } from "@/components/diagnosis-report/executive/DiagnosisExecutiveReport";
import { InlineErrorBanner } from "@/components/diagnosis-funnel/InlineErrorBanner";
import { DiagnosisFailedPanel } from "@/components/diagnosis-funnel/DiagnosisFailedPanel";
import { parseDiagnosisFailedReason } from "@/lib/diagnosis-failed-reason";
import { reportFunnelError } from "@/lib/report-error";
import {
  DIAGNOSIS_PRODUCT,
  GESTAO_PRODUCT,
  trackMetaAddToCart,
  trackMetaViewContentOnce,
} from "@/lib/meta-pixel";
import {
  isDeterministicNarrative,
  isLegacyReport,
} from "@/lib/diagnosis-report-fallback";
import { buildPublicPageHead } from "@/lib/site-seo";
import "@/styles/diagnosis-executive.css";
import "@/styles/diagnosis.css";

type DiagnosticoSearch = { s?: string };

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
  }),
  head: () =>
    buildPublicPageHead({
      title: "Diagnóstico Executivo Meta Ads — Agency Opus",
      description: "Relatório executivo do diagnóstico Meta Ads da sua loja.",
      path: "/diagnostico",
      robots: "noindex,nofollow",
    }),
  component: DiagnosticoReportPage,
});

function DiagnosticoReportPage() {
  const { diagnosisId } = Route.useParams();
  const { s } = Route.useSearch();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (data?.diagnosis?.status !== "completed" || !analysis) return;
    trackMetaViewContentOnce(DIAGNOSIS_PRODUCT, diagnosisId, {
      content_name: "Relatório Diagnóstico Meta Ads",
      content_ids: [diagnosisId],
    });
  }, [data?.diagnosis?.status, analysis, diagnosisId]);

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

  function goToGestaoCheckout(gapFormatted?: string | null) {
    if (!s) return;
    void trackCta();
    trackMetaAddToCart(GESTAO_PRODUCT, {
      source: "report_cta",
      content_ids: [diagnosisId],
    });
    navigate({
      to: "/gestao-checkout",
      search: gestaoCheckoutSearch({
        diagnosisId,
        secretSlug: s,
        gapFormatted: gapFormatted,
      }),
    });
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
  const promptVersion = data.report?.prompt_version;
  const deterministicNarrative = isDeterministicNarrative(analysis);
  const legacyReport = isLegacyReport(promptVersion);

  return (
    <>
      {deterministicNarrative ? (
        <div className="exec-root" style={{ background: "transparent", minHeight: 0, paddingTop: 12 }}>
          <div className="exec-container">
            <p className="legacy-report-banner" role="status">
              Relatório com análise automática dos dados (sem camada consultiva de IA).
              Os números e prioridades estão corretos — a narrativa pode ser refinada
              com uma nova passagem de IA.
            </p>
          </div>
        </div>
      ) : legacyReport ? (
        <div className="exec-root" style={{ background: "transparent", minHeight: 0, paddingTop: 12 }}>
          <div className="exec-container">
            <p className="legacy-report-banner" role="status">
              Versão anterior do relatório ({promptVersion ?? "legado"}). Reprocesse para a versão
              mais recente quando disponível.
            </p>
          </div>
        </div>
      ) : null}
      <DiagnosisExecutiveReport
        analysis={analysis}
        primaryCtaLabel={
          gapCtaFormatted
            ? `Quero recuperar ${gapCtaFormatted}/mês`
            : "Agendar Reunião Estratégica"
        }
        onPrimaryCta={() => {
          if (ctaEligible) goToGestaoCheckout(gapCtaFormatted);
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
                    Você pode fazer internamente — ou contratar gestão especializada com pagamento seguro na próxima página.
                  </p>

                  <div className="exec-cta-row" style={{ marginTop: 24 }}>
                    <button
                      type="button"
                      className="exec-btn exec-btn-primary"
                      onClick={() => goToGestaoCheckout(gapCtaFormatted)}
                    >
                      {gapCtaFormatted
                        ? `Quero recuperar ${gapCtaFormatted}/mês`
                        : "Contratar gestão de tráfego"}
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
                    {gestaoUrgencyText()} · 2 vagas disponíveis.
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
