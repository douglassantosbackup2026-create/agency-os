import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { invokeDiagnosisFunction } from "@/lib/diagnosis-invoke";
import {
  buildGestaoIntroMessage,
  whatsappGestaoHref,
} from "@/lib/gestao-whatsapp";
import {
  NICHE_BENCHMARKS,
  formatBenchmark,
  matchMetricKey,
  matchNicheKey,
} from "@/lib/diagnosis-benchmarks";
import { useManagementCheckout } from "@/hooks/use-management-checkout";
import { DiagnosisBenchmarkMetrics } from "@/components/diagnosis-report/DiagnosisBenchmarkMetrics";
import { DiagnosisFiveChapters } from "@/components/diagnosis-report/DiagnosisFiveChapters";
import { DiagnosisIssueCard } from "@/components/diagnosis-report/DiagnosisIssueCard";
import { DiagnosisMaturityCard } from "@/components/diagnosis-report/DiagnosisMaturityCard";
import { DiagnosisRisksCard } from "@/components/diagnosis-report/DiagnosisRisksCard";
import { DiagnosisBusinessContextForm } from "@/components/diagnosis-report/DiagnosisBusinessContextForm";
import { DiagnosisPriorityPlan } from "@/components/diagnosis-report/DiagnosisPriorityPlan";
import { DiagnosisPrintCover } from "@/components/diagnosis-report/DiagnosisPrintCover";
import { DiagnosisReportShell } from "@/components/diagnosis-report/DiagnosisReportShell";
import type { DiagnosisAnalysis } from "@/components/diagnosis-report/types";
import {
  buildClientFinancialBalance,
  buildClientTopFindings,
  isLegacyReport,
} from "@/lib/diagnosis-report-fallback";
import { DiagnosisPresentationLayout } from "@/components/diagnosis-report/presentation/DiagnosisPresentationLayout";
import { buildRoadmapFromActionPlan } from "@/lib/diagnosis-roadmap";
import "@/styles/diagnosis.css";
import "@/styles/diagnosis-premium.css";

const GESTAO_URGENCY_TEXT =
  import.meta.env.VITE_GESTAO_URGENCY_TEXT?.trim() ||
  "Condição especial para as próximas 2 operações";


type DiagnosticoSearch = { s?: string; gestaoCheckout?: string };

type Analysis = DiagnosisAnalysis;

type BusinessContext = {
  niche?: string | null;
  avg_ticket_brl?: number | null;
  margin_pct?: number | null;
  monthly_goal_brl?: number | null;
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
  const [doneSteps, setDoneSteps] = useState<Record<string, boolean>>({});
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryMsg, setSummaryMsg] = useState<string | null>(null);
  const [scoreLegendOpen, setScoreLegendOpen] = useState(false);

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
      analysis_json?: Analysis | null;
      management_cta_eligible?: boolean;
      prompt_version?: string | null;
    } | null;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Diagnóstico Meta — Retentio";
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
    void invokeDiagnosisFunction("diagnosis-track", {
      method: "POST",
      body: JSON.stringify({
        diagnosis_id: diagnosisId,
        secret_slug: s,
        event: "viewed",
      }),
    });
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
        const res = await invokeDiagnosisFunction("diagnosis-report", {
          query: { d: diagnosisId, s },
        });
        const j = (await res.json()) as typeof data & { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Erro");
        if (alive) setData(j);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Erro");
      }
    })();
    return () => {
      alive = false;
    };
  }, [diagnosisId, s]);

  const analysis = data?.report?.analysis_json;
  const reportPromptVersion = data?.report?.prompt_version;
  const savedContext = data?.diagnosis?.business_context ?? null;

  const topFindings = useMemo(
    () => (analysis ? buildClientTopFindings(analysis) : []),
    [analysis],
  );
  const financialBalance = useMemo(
    () => (analysis ? buildClientFinancialBalance(analysis) : null),
    [analysis],
  );
  const legacyReport = isLegacyReport(reportPromptVersion);
  const seniorDerived = analysis?.seniorDerived ?? null;
  const hasSeniorV12 = !!(
    seniorDerived?.maturity && seniorDerived.diagnostics?.structure
  );

  async function trackCta() {
    if (!s) return;
    await invokeDiagnosisFunction("diagnosis-track", {
      method: "POST",
      body: JSON.stringify({
        diagnosis_id: diagnosisId,
        secret_slug: s,
        event: "cta",
      }),
    });
  }

  function trackEvent(event: string) {
    if (!s) return;
    void invokeDiagnosisFunction("diagnosis-track", {
      method: "POST",
      body: JSON.stringify({ diagnosis_id: diagnosisId, secret_slug: s, event }),
    }).catch(() => {});
  }

  const planStorageKey = `diag-plan-${diagnosisId}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(planStorageKey);
      if (raw) setDoneSteps(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, [planStorageKey]);

  function toggleStep(key: string) {
    setDoneSteps((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(planStorageKey, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
    trackEvent("plan_check");
  }

  async function copyReportLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMsg("Link copiado!");
      trackEvent("copy_link");
    } catch {
      setShareMsg("Não foi possível copiar. Copie da barra de endereço.");
    }
    setTimeout(() => setShareMsg(null), 2500);
  }

  function printReport() {
    trackEvent("print");
    const root = document.querySelector(".diagnosis-report-root");
    root?.classList.add("is-printing");
    const details = document.querySelectorAll<HTMLDetailsElement>(
      ".technical-details-block",
    );
    details.forEach((d) => {
      d.open = true;
    });
    const cleanup = () => {
      root?.classList.remove("is-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  function downloadReminder() {
    trackEvent("reminder");
    const dt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;
    const url = window.location.href;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Retentio//Diagnostico Meta//PT",
      "BEGIN:VEVENT",
      `UID:diag-${diagnosisId}@retentio`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${stamp}`,
      `DTEND:${stamp}`,
      "SUMMARY:Revisar diagnóstico Meta Ads",
      `DESCRIPTION:Revisitar o plano de ação e medir progresso.\\n${url}`,
      `URL:${url}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "revisar-diagnostico-30dias.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
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

  if (!s) {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <div className="card">
            <h1>Link incompleto</h1>
            <p className="muted">
              Abra o diagnóstico pelo botão da página de obrigado (URL com
              ?s=...).
            </p>
            <Link to="/" className="btn btn-outline">
              Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <div className="card">
            <p style={{ color: "#b91c1c" }}>{err}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.diagnosis) {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <p className="muted">Carregando…</p>
        </div>
      </div>
    );
  }

  if (
    data.diagnosis.status === "processing" ||
    data.diagnosis.status === "awaiting_connection"
  ) {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <div className="card">
            <h1>Ainda processando</h1>
            <p className="muted">
              Volte em instantes ou mantenha a página de obrigado aberta.
            </p>
            <Link
              to="/obrigado"
              search={{ d: diagnosisId, s }}
              className="btn btn-outline"
            >
              Status do pedido
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (data.diagnosis.status === "failed") {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <div className="card">
            <h1>Diagnóstico falhou</h1>
            <p>{data.diagnosis.failed_reason}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <p className="muted">Relatório indisponível.</p>
        </div>
      </div>
    );
  }

  const score = analysis.score ?? 0;
  const scoreTier = score < 40 ? "low" : score < 70 ? "mid" : "high";
  const consultWhatsappHref = whatsappGestaoHref(
    `Olá! Concluí o diagnóstico Meta Ads (score ${score}/100). Gostaria de conversar sobre os próximos passos. ID: ${diagnosisId}`,
  );
  const heroPain =
    score < 40
      ? "Sua conta está sangrando dinheiro todos os dias."
      : score < 70
        ? "Você está deixando resultado em cima da mesa — e nem sabe quanto."
        : "Está bem — mas tem um teto invisível te travando.";

  const statusClass = (status: string) => {
    const s = (status ?? "").toLowerCase().trim();
    if (/(mau|bad|baixo|crítico|critico|red|vermelho|low|alerta)/.test(s))
      return "is-bad";
    if (/(médio|medio|mid|atenção|atencao|warning|warn|amber|amarelo)/.test(s))
      return "is-mid";
    if (/(bom|good|ok|verde|green|saudável|saudavel|high)/.test(s))
      return "is-good";
    return "is-neutral";
  };

  const statusLabelPt = (status: string) => {
    const s = (status ?? "").toLowerCase().trim();
    if (/(mau|bad|baixo|crítico|critico|red|vermelho|low|alerta)/.test(s)) return "Alerta";
    if (/(médio|medio|mid|atenção|atencao|warning|warn|amber|amarelo)/.test(s)) return "Atenção";
    if (/(bom|good|ok|verde|green|saudável|saudavel|high)/.test(s)) return "Bom";
    if (/sem tracking/.test(s)) return "Sem tracking";
    if (/sem dados/.test(s)) return "Sem dados";
    return status || "—";
  };

  const axisLabelPt = (axis: string) => {
    const map: Record<string, string> = {
      structure: "Estrutura",
      audience: "Públicos",
      creative: "Criativo",
      sales: "Vendas",
      scale: "Escala",
      financial: "Financeiro",
    };
    return map[axis] ?? axis;
  };

  const priorityBadge = (priority: string) => {
    const p = (priority ?? "").toLowerCase();
    if (/(alta|high|crítica|critica|urgente)/.test(p)) return "badge-high";
    if (/(média|media|medium|moderada)/.test(p)) return "badge-medium";
    return "badge-low";
  };

  const confidenceLabelPt = (c: string) => {
    const s = (c ?? "").toLowerCase().trim();
    if (s === "high" || s === "alta") return "Alta";
    if (s === "medium" || s === "média" || s === "media") return "Média";
    if (s === "low" || s === "baixa") return "Baixa";
    return c || "—";
  };

  const priorityWeight = (p: string) => {
    const s = (p ?? "").toLowerCase();
    if (/(alta|high|crítica|critica|urgente)/.test(s)) return 0;
    if (/(média|media|medium|moderada)/.test(s)) return 1;
    return 2;
  };

  const topPriorities = (() => {
    const issues = (analysis.criticalIssues ?? [])
      .slice()
      .sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority))
      .slice(0, 3)
      .map((i) => ({
        title: i.title,
        description: i.description,
        meta: i.priority,
        href: "#sec-issues",
      }));
    if (issues.length >= 3) return issues;
    const planSteps = (analysis.actionPlan ?? [])
      .slice()
      .sort((a, b) => (a.step ?? 0) - (b.step ?? 0))
      .slice(0, 3 - issues.length)
      .map((a) => ({
        title: a.action,
        description: `Impacto: ${a.impact} · Prazo: ${a.eta}`,
        meta: "Plano",
        href: "#sec-plan",
      }));
    return [...issues, ...planSteps];
  })();

  const hasObjectiveV2 = Boolean(
    analysis.accountObjectiveSummary?.by_family?.length ||
      analysis.campaignBreakdown?.some((c) => c.objective_label),
  );

  const fi = analysis.financialImpact;
  const story = analysis.storyExecutive;
  const narrativeHook =
    analysis.narrativeHook?.trim() ||
    story?.headline ||
    heroPain;
  const executiveBrief = analysis.executiveSummary;

  const nicheKey =
    matchNicheKey(savedContext?.niche ?? null) ?? "ecom_geral";
  const niche = NICHE_BENCHMARKS[nicheKey];
  const serverBenchmarks = analysis.benchmarkComparison?.gaps ?? [];

  const tocItems: { id: string; label: string }[] = [];
  tocItems.push({ id: "veredito", label: "Veredito" });
  if (topFindings.length) tocItems.push({ id: "achados", label: "Achados" });
  if (hasSeniorV12) {
    tocItems.push({ id: "maturidade", label: "Maturidade" });
    if (seniorDerived?.leakByAxis?.length) {
      tocItems.push({ id: "vazamentos", label: "Vazamentos" });
    }
    tocItems.push({ id: "capitulos", label: "5 diagnósticos" });
    tocItems.push({ id: "crescimento", label: "Crescimento" });
  } else if (financialBalance) {
    tocItems.push({ id: "financeiro", label: "Balanço" });
  }
  if (serverBenchmarks.length) tocItems.push({ id: "benchmark", label: "Mercado" });
  if (!hasSeniorV12 && topPriorities.length) {
    tocItems.push({ id: "sec-top", label: "Top 3 prioridades" });
  }
  if (hasObjectiveV2) tocItems.push({ id: "sec-funnel", label: "Funil" });
  if (analysis.metrics?.length) tocItems.push({ id: "sec-metrics", label: "Métricas" });
  if (analysis.campaignBreakdown?.length) tocItems.push({ id: "sec-campaigns", label: "Campanhas" });
  if (analysis.criticalIssues?.length) tocItems.push({ id: "sec-issues", label: "Problemas" });
  if (analysis.budgetLeaks?.length) tocItems.push({ id: "sec-leaks", label: "Vazamentos" });
  // anti-patterns inserted later if present
  if (analysis.opportunities?.length) tocItems.push({ id: "sec-opps", label: "Oportunidades" });
  if (analysis.creativesSummary) tocItems.push({ id: "sec-creatives", label: "Criativos" });
  if (analysis.audiencesSummary) tocItems.push({ id: "sec-audiences", label: "Públicos" });
  if (analysis.structureNotes?.length) tocItems.push({ id: "sec-structure", label: "Fundação" });
  if (analysis.actionPlan?.length) tocItems.push({ id: "sec-plan", label: "Plano de ação" });
  if (analysis.actionPlan?.length) tocItems.push({ id: "sec-roadmap", label: "Roadmap 30/60/90" });
  if (analysis.improvementScenario?.note) tocItems.push({ id: "sec-scenario", label: "Cenário" });

  if (analysis.dataLimitations?.length) tocItems.push({ id: "sec-limits", label: "Limitações" });
  if (data.report?.management_cta_eligible) tocItems.push({ id: "sec-cta", label: "Próximo passo" });

  const roadmap = buildRoadmapFromActionPlan(analysis.actionPlan ?? []);

  function scrollToManagementCta() {
    document.getElementById("sec-cta")?.scrollIntoView({ behavior: "smooth" });
    trackEvent("cta_scroll");
  }

  // P6 — anti-padrões: armadilhas comuns derivadas do próprio diagnóstico
  const antiPatterns: { title: string; reason: string }[] = (() => {
    const out: { title: string; reason: string }[] = [];
    const badCamps = (analysis.campaignBreakdown ?? []).filter((c) =>
      statusClass(c.status) === "is-bad",
    );
    if (badCamps.length) {
      out.push({
        title: "Não aumentar budget de campanhas no vermelho",
        reason: `${badCamps.length} campanha(s) com performance ruim. Escalar agora multiplica o vazamento.`,
      });
    }
    const hiFreq = (analysis.campaignBreakdown ?? []).filter((c) => {
      const f = Number((c.frequency ?? "").replace(",", "."));
      return Number.isFinite(f) && f >= 3;
    });
    if (hiFreq.length) {
      out.push({
        title: "Não duplicar criativos fatigados",
        reason: `${hiFreq.length} campanha(s) com frequência ≥ 3. Duplicar não renova fadiga — produza criativo novo.`,
      });
    }
    const noTracking = (analysis.metrics ?? []).some((m) =>
      /sem tracking|sem dados/i.test(m.status),
    );
    if (noTracking) {
      out.push({
        title: "Não decidir corte sem tracking validado",
        reason: "Há métricas sem tracking. Corrigir mensuração antes de pausar campanhas evita falsos negativos.",
      });
    }
    if ((analysis.budgetLeaks ?? []).length >= 2) {
      out.push({
        title: "Não focar só em criativo",
        reason: "Há vazamentos estruturais identificados. Trocar criativo sem fechar o ralo só adia o problema.",
      });
    }
    return out.slice(0, 5);
  })();

  if (antiPatterns.length) {
    const idx = tocItems.findIndex((t) => t.id === "sec-leaks");
    const entry = { id: "sec-anti", label: "Anti-padrões" };
    if (idx >= 0) tocItems.splice(idx + 1, 0, entry);
    else tocItems.push(entry);
  }


  // P7 — resumo executivo (texto plano para WhatsApp / e-mail / copy)
  const execSummaryPlain = (() => {
    const lines: string[] = [];
    lines.push(`Diagnóstico Meta Ads — score ${score}/100 (${analysis.scoreLabel})`);
    lines.push("");
    if (analysis.verdictLine) {
      lines.push(analysis.verdictLine);
      lines.push("");
    }
    if (topFindings.length) {
      lines.push("Top achados:");
      topFindings.forEach((f) =>
        lines.push(`${f.rank}. ${f.headline} (${f.monthlyImpactFormatted})`),
      );
      lines.push("");
    } else if (topPriorities.length) {
      lines.push("Top 3 prioridades:");
      topPriorities.forEach((p, i) => lines.push(`${i + 1}. ${p.title}`));
      lines.push("");
    }
    if ((analysis.budgetLeaks ?? []).length) {
      lines.push(`Vazamentos identificados: ${analysis.budgetLeaks!.length}`);
    }
    const firstAction = (analysis.actionPlan ?? [])
      .slice()
      .sort((a, b) => (a.step ?? 0) - (b.step ?? 0))[0];
    if (firstAction) {
      lines.push("");
      lines.push(`Próximo passo: ${firstAction.action} (${firstAction.eta})`);
    }
    lines.push("");
    lines.push(`Relatório completo: ${typeof window !== "undefined" ? window.location.href : ""}`);
    return lines.join("\n");
  })();

  async function copyExecSummary() {
    try {
      await navigator.clipboard.writeText(execSummaryPlain);
      setSummaryMsg("Resumo copiado!");
      trackEvent("summary_copy");
    } catch {
      setSummaryMsg("Não foi possível copiar.");
    }
    setTimeout(() => setSummaryMsg(null), 2500);
  }

  function shareSummaryWhatsApp() {
    trackEvent("summary_whatsapp");
    const url = `https://wa.me/?text=${encodeURIComponent(execSummaryPlain)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function shareSummaryEmail() {
    trackEvent("summary_email");
    const subject = encodeURIComponent(`Diagnóstico Meta Ads — score ${score}/100`);
    const body = encodeURIComponent(execSummaryPlain);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }


  const accountPrintLabel =
    data?.diagnosis?.management_business_name?.trim() || undefined;

  const completedAtLabel = data?.diagnosis?.completed_at
    ? new Date(data.diagnosis.completed_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <DiagnosisReportShell
      shareMsg={shareMsg}
      summaryOpen={summaryOpen}
      layoutWide
      onCopyLink={() => void copyReportLink()}
      onPrint={printReport}
      onToggleSummary={() => {
        setSummaryOpen((v) => !v);
        if (!summaryOpen) trackEvent("summary_open");
      }}
      onReminder={downloadReminder}
    >
        <DiagnosisPrintCover
          score={score}
          scoreLabel={analysis.scoreLabel}
          accountLabel={accountPrintLabel}
          maturityLevel={seniorDerived?.maturity.level}
          maturityLabel={seniorDerived?.maturity.label}
          leakTotalFormatted={
            seniorDerived?.leakByAxis?.length
              ? seniorDerived.leakByAxis
                  .reduce((s, i) => s + i.monthlyBrl, 0)
                  .toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    maximumFractionDigits: 0,
                  })
              : undefined
          }
        />

        {legacyReport ? (
          <p className="legacy-report-banner no-print" role="status">
            Relatório gerado antes da versão Growth Intelligence v3 — reprocessar para
            motores Enterprise (8 blocos), conclusão executiva e layout completo.
          </p>
        ) : null}

        {s ? (
          <DiagnosisBusinessContextForm
            diagnosisId={diagnosisId}
            secretSlug={s}
            initial={savedContext}
            reportCompleted={data?.diagnosis?.status === "completed"}
          />
        ) : null}

        <p className="followup-banner no-print muted" role="note">
          Reavaliação automática das métricas da conta em 30 dias (sem novo relatório de IA).
        </p>

        <DiagnosisPresentationLayout
          analysis={analysis}
          metaSenior={analysis.metaSenior ?? null}
          consultative={analysis.consultativeDerived ?? null}
          seniorDerived={seniorDerived}
          financialBalance={financialBalance}
          topFindings={topFindings}
          score={score}
          scoreTier={scoreTier}
          scoreLabel={analysis.scoreLabel}
          priorityBadge={priorityBadge}
          axisLabelPt={axisLabelPt}
          onScrollToManagementCta={scrollToManagementCta}
          whatsappGestaoHref={consultWhatsappHref}
          accountLabel={accountPrintLabel}
          completedAtLabel={completedAtLabel}
        />

        {summaryOpen ? (
          <section className="card summary-panel no-print" aria-label="Resumo executivo">
            <div className="summary-head">
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Resumo executivo</h2>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => setSummaryOpen(false)}
                aria-label="Fechar resumo"
              >
                ✕
              </button>
            </div>
            <p className="section-hint" style={{ marginTop: "0.25rem" }}>
              Uma página para compartilhar com sócio, gestor ou agência.
            </p>
            <pre className="summary-text">{execSummaryPlain}</pre>
            <div className="summary-actions">
              <button type="button" className="toolbar-btn" onClick={() => void copyExecSummary()}>
                Copiar texto
              </button>
              <button type="button" className="toolbar-btn" onClick={shareSummaryWhatsApp}>
                WhatsApp
              </button>
              <button type="button" className="toolbar-btn" onClick={shareSummaryEmail}>
                E-mail
              </button>
              {summaryMsg ? (
                <span className="toolbar-msg" role="status">{summaryMsg}</span>
              ) : null}
            </div>
          </section>
        ) : null}






        {!hasSeniorV12 && tocItems.length > 1 ? (
          <nav className="report-toc" aria-label="Índice do relatório">
            {tocItems.map((it) => (
              <a key={it.id} href={`#${it.id}`} className="report-toc-link">
                {it.label}
              </a>
            ))}
          </nav>
        ) : null}

        {!hasSeniorV12 && topPriorities.length ? (
          <section className="card top-priorities" id="sec-top">
            <h2>Top 3 prioridades</h2>
            <p className="section-hint">
              O que tratar primeiro, com base no impacto identificado.
            </p>
            <ol className="top-priorities-list">
              {topPriorities.map((p, idx) => (
                <li key={`${idx}-${p.title}`} className="top-priority-item">
                  <div className="top-priority-num">{idx + 1}</div>
                  <div className="top-priority-body">
                    <div className="top-priority-title">{p.title}</div>
                    <p className="muted" style={{ margin: "0.25rem 0 0.4rem" }}>
                      {p.description}
                    </p>
                    <div className="top-priority-meta">
                      <span className={`badge ${priorityBadge(p.meta)}`}>{p.meta}</span>
                      <a href={p.href} className="top-priority-link">
                        Ver detalhe →
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {!hasSeniorV12 && analysis.criticalIssues?.length ? (
          <section className="card" id="sec-issues">
            <h2>O que está travando seu resultado</h2>
            <p className="section-hint">
              Causa, consequência e impacto — para você decidir com clareza.
            </p>
            {analysis.criticalIssues.map((i) => (
              <DiagnosisIssueCard
                key={i.title}
                issue={i}
                priorityBadge={priorityBadge}
                axisLabelPt={axisLabelPt}
              />
            ))}
          </section>
        ) : null}

        {!hasSeniorV12 && analysis.budgetLeaks?.length ? (
          <section className="card" id="sec-leaks">
            <h2>Quanto isso custa por mês</h2>
            <p className="section-hint">
              Valores indicativos com base nos dados da sua conta (últimos 30 dias).
            </p>
            {analysis.budgetLeaks.map((b) => (
              <div key={b.title} className="leak-card">
                <div className="leak-icon">💸</div>
                <div>
                  <h3>{b.title}</h3>
                  {b.monthlyBrl != null && b.monthlyBrl > 0 ? (
                    <p className="leak-amount">
                      ~{b.monthlyBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}/mês
                    </p>
                  ) : null}
                  <p style={{ margin: "0 0 0.35rem", fontWeight: 600, color: "#991b1b" }}>
                    {b.estimateNote}
                  </p>
                  <p className="muted" style={{ margin: 0 }}>{b.hint}</p>
                </div>
              </div>
            ))}
            <div className="pain-line">
              Some o que está acima — é o custo de adiar correções.
            </div>
          </section>
        ) : null}

        {!hasSeniorV12 && antiPatterns.length ? (
          <section className="card anti-card" id="sec-anti">
            <h2>O que NÃO fazer agora</h2>
            <p className="section-hint">
              Armadilhas comuns que estragam o ganho das correções.
            </p>
            <ul className="anti-list">
              {antiPatterns.map((a) => (
                <li key={a.title} className="anti-item">
                  <span className="anti-icon" aria-hidden>🚫</span>
                  <div>
                    <div className="anti-title">{a.title}</div>
                    <p className="muted" style={{ margin: "0.15rem 0 0" }}>{a.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!hasSeniorV12 && analysis.opportunities?.length ? (
          <section className="card" id="sec-opps">
            <h2>Potencial de ganho</h2>
            <p className="section-hint">
              Oportunidades observadas nos seus dados — não são promessa de resultado.
            </p>
            {analysis.opportunities.map((o) => (
              <div key={o.title} className="opp-card">
                <div className="opp-icon">📈</div>
                <div>
                  <h3>{o.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>{o.potentialNote}</p>
                </div>
                <span className="badge badge-medium">{o.complexity}</span>
              </div>
            ))}
          </section>
        ) : null}

        <details className="card technical-details-block" id="sec-technical">
          <summary className="technical-details-summary">
            {hasSeniorV12
              ? "Anexo técnico — problemas, campanhas, plano de ação e métricas"
              : "Detalhe técnico — campanhas, métricas e estrutura"}
          </summary>
          <div className="technical-details-inner">

        {hasSeniorV12 && seniorDerived ? (
          <>
            <section className="card technical-inner-card" id="maturidade">
              <DiagnosisMaturityCard maturity={seniorDerived.maturity} />
            </section>
            <section className="card technical-inner-card" id="capitulos">
              <DiagnosisFiveChapters
                senior={seniorDerived}
                narratives={analysis.chapterNarratives}
                financialBalance={financialBalance}
              />
            </section>
            {seniorDerived.risks.length ? (
              <section className="card technical-inner-card">
                <DiagnosisRisksCard risks={seniorDerived.risks} />
              </section>
            ) : null}
          </>
        ) : null}

        {serverBenchmarks.length ? (
          <section className="card technical-inner-card" id="benchmark">
            <DiagnosisBenchmarkMetrics
              nicheLabel={analysis.benchmarkComparison?.nicheLabel ?? niche.label}
              gaps={serverBenchmarks}
            />
          </section>
        ) : null}

        <section className="card technical-inner-card summary-brief" id="sec-summary-text">
          <h2>Resumo narrativo</h2>
          <p className="muted" style={{ margin: 0 }}>{analysis.summary}</p>
          {executiveBrief?.oneLiner ? (
            <p className="exec-one-liner" style={{ marginTop: "0.75rem" }}>
              {executiveBrief.oneLiner}
            </p>
          ) : null}
        </section>

        {analysis.prioritizedActions?.length || analysis.actionPlan?.length ? (
          <section className="card technical-inner-card">
            <DiagnosisPriorityPlan
              actions={
                analysis.prioritizedActions?.length
                  ? analysis.prioritizedActions
                  : (analysis.actionPlan ?? [])
              }
              mondayActions={analysis.mondayActions}
              axisLabelPt={axisLabelPt}
            />
          </section>
        ) : null}

        {hasSeniorV12 && analysis.criticalIssues?.length ? (
          <section className="card technical-inner-card" id="sec-issues">
            <h2>O que está travando seu resultado</h2>
            <p className="section-hint">
              Causa, consequência e impacto — para você decidir com clareza.
            </p>
            {analysis.criticalIssues.map((i) => (
              <DiagnosisIssueCard
                key={i.title}
                issue={i}
                priorityBadge={priorityBadge}
                axisLabelPt={axisLabelPt}
              />
            ))}
          </section>
        ) : null}

        {hasSeniorV12 && analysis.budgetLeaks?.length ? (
          <section className="card technical-inner-card" id="sec-leaks">
            <h2>Quanto isso custa por mês</h2>
            <p className="section-hint">
              Valores indicativos com base nos dados da sua conta (últimos 30 dias).
            </p>
            {analysis.budgetLeaks.map((b) => (
              <div key={b.title} className="leak-card">
                <div className="leak-icon">💸</div>
                <div>
                  <h3>{b.title}</h3>
                  {b.monthlyBrl != null && b.monthlyBrl > 0 ? (
                    <p className="leak-amount">
                      ~{b.monthlyBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}/mês
                    </p>
                  ) : null}
                  <p style={{ margin: "0 0 0.35rem", fontWeight: 600, color: "#991b1b" }}>
                    {b.estimateNote}
                  </p>
                  <p className="muted" style={{ margin: 0 }}>{b.hint}</p>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {hasSeniorV12 && antiPatterns.length ? (
          <section className="card technical-inner-card anti-card" id="sec-anti">
            <h2>O que NÃO fazer agora</h2>
            <ul className="anti-list">
              {antiPatterns.map((a) => (
                <li key={a.title} className="anti-item">
                  <span className="anti-icon" aria-hidden>🚫</span>
                  <div>
                    <div className="anti-title">{a.title}</div>
                    <p className="muted" style={{ margin: "0.15rem 0 0" }}>{a.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {hasSeniorV12 && analysis.opportunities?.length ? (
          <section className="card technical-inner-card" id="sec-opps">
            <h2>Potencial de ganho</h2>
            {analysis.opportunities.map((o) => (
              <div key={o.title} className="opp-card">
                <div className="opp-icon">📈</div>
                <div>
                  <h3>{o.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>{o.potentialNote}</p>
                </div>
                <span className="badge badge-medium">{o.complexity}</span>
              </div>
            ))}
          </section>
        ) : null}

        {hasObjectiveV2 && analysis.accountObjectiveSummary ? (
          <section className="card technical-inner-card" id="sec-funnel">
            <h2>Como sua conta está organizada</h2>
            <p className="section-hint">
              Avaliação por objetivo de campanha (como no Gerenciador de Anúncios da Meta).
              {analysis.accountObjectiveSummary.mixed_funnel
                ? " Esta conta mistura funil completo — ROAS abaixo refere-se só a campanhas de Vendas."
                : ""}
            </p>
            <div className="funnel-chips">
              {analysis.accountObjectiveSummary.by_family.map((f) => (
                <span
                  key={f.family}
                  className={`funnel-chip objective-${f.family}`}
                  title={f.headline_kpi}
                >
                  {f.label} · {f.spend_pct}%
                </span>
              ))}
            </div>
            {analysis.accountObjectiveSummary.sales_block ? (
              <p className="section-hint" style={{ marginTop: "0.75rem" }}>
                <strong>Vendas ({analysis.accountObjectiveSummary.sales_block.campaign_count}{" "}
                campanha{analysis.accountObjectiveSummary.sales_block.campaign_count !== 1 ? "s" : ""}):</strong>{" "}
                gasto {analysis.accountObjectiveSummary.sales_block.spend_formatted}, ROAS{" "}
                {analysis.accountObjectiveSummary.sales_block.roas_formatted}, custo/compra{" "}
                {analysis.accountObjectiveSummary.sales_block.cpa_formatted}
              </p>
            ) : null}
          </section>
        ) : null}

        {analysis.metrics?.length ? (
          <section className="card technical-inner-card" id="sec-metrics">
            <h2>Onde seu dinheiro está agora</h2>
            <p className="section-hint">
              {hasObjectiveV2
                ? "Métricas principais de campanhas de Vendas (compras rastreadas). CTR/CPM da conta inteira aparecem abaixo como contexto."
                : "Os números reais da sua conta, comparados com a referência que usamos como base."}
            </p>
            <div className="metric-grid">
              {analysis.metrics.map((m) => {
                const cls = statusClass(m.status);
                const badgeCls =
                  cls === "is-bad"
                    ? "badge-bad"
                    : cls === "is-mid"
                      ? "badge-mid"
                      : cls === "is-good"
                        ? "badge-good"
                        : "badge-medium";
                return (
                  <div key={m.name} className={`metric-card ${cls}`}>
                    <div>
                      <div className="metric-name">{m.name}</div>
                      <div className="metric-ref">Referência: {m.reference}</div>
                      {niche && (() => {
                        const mk = matchMetricKey(m.name);
                        const range = mk ? niche.ranges[mk] : undefined;
                        if (!range) return null;
                        return (
                          <div className="metric-bench" title={`Faixa típica em ${niche.label}`}>
                            <span className="metric-bench-tag">{niche.label}</span>{" "}
                            {formatBenchmark(mk!, range)}
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <div className="metric-value">{m.current}</div>
                      <div style={{ textAlign: "right", marginTop: "0.25rem" }}>
                        <span className={`badge ${badgeCls}`}>
                          {statusLabelPt(m.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {niche ? (
              <p className="section-hint" style={{ marginTop: "0.75rem" }}>
                Faixas de referência indicativas para <strong>{niche.label}</strong>,
                baseadas no contexto que você informou.
              </p>
            ) : (
              <p className="section-hint" style={{ marginTop: "0.75rem" }}>
                Faixas de referência indicativas para <strong>{niche.label}</strong> (padrão e-commerce).
              </p>
            )}
            <div className="pain-line">
              Cada métrica fora da referência = real saindo da conta sem
              voltar.
            </div>
            {analysis.accountContextMetrics?.length ? (
              <details className="account-context-metrics" style={{ marginTop: "1rem" }}>
                <summary className="section-hint" style={{ cursor: "pointer" }}>
                  Contexto geral da conta (todas as campanhas)
                </summary>
                <div className="metric-grid" style={{ marginTop: "0.75rem" }}>
                  {analysis.accountContextMetrics.map((m) => {
                    const cls = statusClass(m.status);
                    const badgeCls =
                      cls === "is-bad"
                        ? "badge-bad"
                        : cls === "is-mid"
                          ? "badge-mid"
                          : cls === "is-good"
                            ? "badge-good"
                            : "badge-medium";
                    return (
                      <div key={m.name} className={`metric-card ${cls}`}>
                        <div>
                          <div className="metric-name">{m.name}</div>
                          <div className="metric-ref">Referência: {m.reference}</div>
                        </div>
                        <div>
                          <div className="metric-value">{m.current}</div>
                          <div style={{ textAlign: "right", marginTop: "0.25rem" }}>
                            <span className={`badge ${badgeCls}`}>
                              {statusLabelPt(m.status)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            ) : null}
          </section>
        ) : null}


        {analysis.campaignBreakdown?.length ? (
          <section className="card technical-inner-card" id="sec-campaigns">
            <h2>Desempenho por campanha</h2>
            <p className="section-hint">
              Top campanhas por gasto nos últimos 30 dias — objetivo, resultado
              e custo por resultado como no Gerenciador de Anúncios.
            </p>
            <div className="campaign-table-wrap">
              <table className="campaign-table">
                <thead>
                  <tr>
                    <th>Campanha</th>
                    {hasObjectiveV2 ? (
                      <>
                        <th>Objetivo</th>
                        <th>Resultados</th>
                        <th>Custo / resultado</th>
                      </>
                    ) : null}
                    <th>Gasto</th>
                    <th>ROAS</th>
                    {!hasObjectiveV2 ? (
                      <>
                        <th>CTR</th>
                        <th>CPM</th>
                        <th>Freq.</th>
                      </>
                    ) : null}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.campaignBreakdown.map((c) => {
                    const cls = statusClass(c.status);
                    const badgeCls =
                      cls === "is-bad"
                        ? "badge-bad"
                        : cls === "is-mid"
                          ? "badge-mid"
                          : cls === "is-good"
                            ? "badge-good"
                            : "badge-medium";
                    const roasNa = c.roas === "—" || c.roas === "sem tracking";
                    return (
                      <tr key={c.name} className={cls}>
                        <td className="campaign-name" title={c.name}>{c.name}</td>
                        {hasObjectiveV2 ? (
                          <>
                            <td>
                              {c.objective_label ? (
                                <span className="objective-badge">{c.objective_label}</span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              {c.results_count && c.results_count !== "—" ? (
                                <>
                                  <strong>{c.results_count}</strong>
                                  {c.result_label ? (
                                    <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>
                                      {c.result_label}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>{c.cost_per_result ?? "—"}</td>
                          </>
                        ) : null}
                        <td>{c.spend}</td>
                        <td className={roasNa ? "roas-na" : undefined} title={roasNa ? "ROAS não se aplica a este objetivo de campanha" : undefined}>
                          {c.roas}
                        </td>
                        {!hasObjectiveV2 ? (
                          <>
                            <td>{c.ctr}</td>
                            <td>{c.cpm}</td>
                            <td>{c.frequency}</td>
                          </>
                        ) : null}
                        <td title={c.status_reason}>
                          <span className={`badge ${badgeCls}`}>
                            {statusLabelPt(c.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pain-line">
              {hasObjectiveV2
                ? "Status por objetivo: alcance e tráfego não são julgados por ROAS de compra."
                : "Campanhas no vermelho concentram gasto e devolvem pouco — onde cortar primeiro."}
            </div>
          </section>
        ) : null}

        {analysis.creativesSummary ? (
          <section className="card technical-inner-card" id="sec-creatives">
            <h2>Criativos: o que vende e o que queima</h2>
            <p className="section-hint">
              O que está funcionando — e o que está sugando budget.
            </p>
            <div className="creatives-grid">
              <div className="creative-col creative-best">
                <h4 style={{ color: "#166534" }}>✅ Melhor</h4>
                <p style={{ margin: 0 }}>
                  {analysis.creativesSummary.best?.trim()
                    ? analysis.creativesSummary.best
                    : "Sem criativo destaque identificado no período analisado."}
                </p>
              </div>
              <div className="creative-col creative-worst">
                <h4 style={{ color: "#991b1b" }}>❌ Pior</h4>
                <p style={{ margin: 0 }}>
                  {analysis.creativesSummary.worst?.trim()
                    ? analysis.creativesSummary.worst
                    : "Sem criativo com performance claramente negativa no período."}
                </p>
              </div>
            </div>
            <div className="creative-reco">
              {analysis.creativesSummary.recommendation}
            </div>
          </section>
        ) : null}

        {analysis.audiencesSummary ? (
          <section className="card technical-inner-card" id="sec-audiences">
            <h2>Você está falando com as pessoas erradas?</h2>
            <p style={{ marginTop: 0 }}>
              <strong>{analysis.audiencesSummary.segmentation}</strong>
            </p>
            <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
              {analysis.audiencesSummary.notes?.map((n) => (
                <li key={n} style={{ marginBottom: "0.35rem" }}>{n}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {analysis.structureNotes?.length ? (
          <section className="card technical-inner-card" id="sec-structure">
            <h2>A fundação da conta</h2>
            <p className="section-hint">
              Sem isso ajustado, nenhuma otimização se sustenta.
            </p>
            <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
              {analysis.structureNotes.map((n) => (
                <li key={n} style={{ marginBottom: "0.35rem" }}>{n}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {hasSeniorV12 && analysis.actionPlan?.length ? (() => {
          const planItems = [...analysis.actionPlan].sort(
            (a, b) => (a.step ?? 0) - (b.step ?? 0),
          );
          const doneCount = planItems.filter(
            (a) => doneSteps[`${a.step}-${a.action}`],
          ).length;
          const pct = Math.round((doneCount / planItems.length) * 100);
          return (
            <section className="card technical-inner-card" id="sec-plan">
              <h2>Plano de ação</h2>
              <p className="section-hint">
                A sequência sugerida pela análise — ordenada por impacto.
              </p>
              <div className="plan-progress no-print" aria-label="Progresso do plano">
                <div className="plan-progress-bar">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <span className="plan-progress-label">
                  {doneCount}/{planItems.length} concluídos · {pct}%
                </span>
              </div>
              <ol className="action-plan">
                {planItems.map((a) => {
                  const key = `${a.step}-${a.action}`;
                  const done = !!doneSteps[key];
                  return (
                    <li
                      key={key}
                      className={`action-step${done ? " action-step-done" : ""}`}
                    >
                      <label className="action-step-check no-print">
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => toggleStep(key)}
                          aria-label={`Marcar passo ${a.step} como concluído`}
                        />
                      </label>
                      <div className="action-step-num">{a.step}</div>
                      <div className="action-step-body">
                        <div className="action-step-title">{a.action}</div>
                        <div className="action-step-meta">
                          {"relatedAxis" in a && a.relatedAxis ? (
                            <span className="badge badge-medium action-axis-badge">
                              {axisLabelPt(String(a.relatedAxis))}
                            </span>
                          ) : null}
                          <span><strong>Impacto:</strong> {a.impact}</span>
                          <span><strong>Prazo:</strong> {a.eta}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })() : null}

        {hasSeniorV12 && analysis.actionPlan?.length ? (
          <section className="card technical-inner-card" id="sec-roadmap">
            <h2>Roadmap 30 / 60 / 90 dias</h2>
            <div className="roadmap-grid">
              {([
                { key: "short", title: "0–14 dias", subtitle: "Quick wins", items: roadmap.short },
                { key: "mid", title: "15–45 dias", subtitle: "Otimização", items: roadmap.mid },
                { key: "long", title: "46–90 dias", subtitle: "Estrutura", items: roadmap.long },
              ] as const).map((col) => (
                <div key={col.key} className={`roadmap-col roadmap-${col.key}`}>
                  <div className="roadmap-head">
                    <span className="roadmap-title">{col.title}</span>
                    <span className="roadmap-sub">{col.subtitle}</span>
                  </div>
                  {col.items && col.items.length ? (
                    <ul className="roadmap-list">
                      {col.items.map((a) => (
                        <li key={`${col.key}-${a.step}-${a.action}`}>
                          <span className="roadmap-step">#{a.step}</span>
                          <span className="roadmap-action">{a.action}</span>
                          <span className="roadmap-eta muted">{a.eta}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                      Nada nesta janela.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}

          </div>
        </details>

        {!hasSeniorV12 && analysis.actionPlan?.length ? (() => {
          const planItems = [...analysis.actionPlan].sort(
            (a, b) => (a.step ?? 0) - (b.step ?? 0),
          );
          const doneCount = planItems.filter(
            (a) => doneSteps[`${a.step}-${a.action}`],
          ).length;
          const pct = Math.round((doneCount / planItems.length) * 100);
          return (
            <section className="card" id="sec-plan">
              <h2>Plano de ação</h2>
              <p className="section-hint">
                A sequência sugerida pela análise — ordenada por impacto.
                Marque cada item conforme for executando.
              </p>
              <div className="plan-progress no-print" aria-label="Progresso do plano">
                <div className="plan-progress-bar">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <span className="plan-progress-label">
                  {doneCount}/{planItems.length} concluídos · {pct}%
                </span>
              </div>
              <ol className="action-plan">
                {planItems.map((a) => {
                  const key = `${a.step}-${a.action}`;
                  const done = !!doneSteps[key];
                  return (
                    <li
                      key={key}
                      className={`action-step${done ? " action-step-done" : ""}`}
                    >
                      <label className="action-step-check no-print">
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => toggleStep(key)}
                          aria-label={`Marcar passo ${a.step} como concluído`}
                        />
                      </label>
                      <div className="action-step-num">{a.step}</div>
                      <div className="action-step-body">
                        <div className="action-step-title">{a.action}</div>
                        <div className="action-step-meta">
                          {"relatedAxis" in a && a.relatedAxis ? (
                            <span className="badge badge-medium action-axis-badge">
                              {axisLabelPt(String(a.relatedAxis))}
                            </span>
                          ) : null}
                          <span><strong>Impacto:</strong> {a.impact}</span>
                          <span><strong>Prazo:</strong> {a.eta}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })() : null}

        {!hasSeniorV12 && analysis.actionPlan?.length ? (
          <section className="card" id="sec-roadmap">
            <h2>Roadmap 30 / 60 / 90 dias</h2>
            <p className="section-hint">
              O plano organizado pelo horizonte sugerido. Comece pela coluna
              de curto prazo — são os ajustes com retorno mais rápido.
            </p>
            <div className="roadmap-grid">
              {([
                { key: "short", title: "0–14 dias", subtitle: "Quick wins", items: roadmap.short },
                { key: "mid", title: "15–45 dias", subtitle: "Otimização", items: roadmap.mid },
                { key: "long", title: "46–90 dias", subtitle: "Estrutura", items: roadmap.long },
              ] as const).map((col) => (
                <div key={col.key} className={`roadmap-col roadmap-${col.key}`}>
                  <div className="roadmap-head">
                    <span className="roadmap-title">{col.title}</span>
                    <span className="roadmap-sub">{col.subtitle}</span>
                  </div>
                  {col.items && col.items.length ? (
                    <ul className="roadmap-list">
                      {col.items.map((a) => (
                        <li key={`${col.key}-${a.step}-${a.action}`}>
                          <span className="roadmap-step">#{a.step}</span>
                          <span className="roadmap-action">{a.action}</span>
                          <span className="roadmap-eta muted">{a.eta}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                      Nada nesta janela.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}




        {analysis.improvementScenario?.note ? (
          <section className="card" id="sec-scenario">
            <h2>Cenário de melhoria</h2>
            <p style={{ margin: "0 0 0.5rem" }}>
              {analysis.improvementScenario.note}
            </p>
            <span className="badge badge-medium">
              Confiança: {confidenceLabelPt(analysis.improvementScenario.confidence)}
            </span>
          </section>
        ) : null}

        {analysis.dataLimitations?.length ? (
          <section className="card" id="sec-limits">
            <h2>Limitações dos dados</h2>
            <p className="section-hint">
              O que não foi possível observar — para que você saiba o que
              está, e o que não está, sustentado por dado.
            </p>
            <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
              {analysis.dataLimitations.map((n) => (
                <li key={n} style={{ marginBottom: "0.35rem" }}>{n}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.report?.management_cta_eligible ? (
          <section className="card cta-pain" id="sec-cta">
            <span className="cta-stamp">Recomendado pela análise</span>
            {gestaoCheckout === "falha" ? (
              <p role="alert" style={{ color: "#b91c1c", marginBottom: "1rem" }}>
                O Mercado Pago não concluiu o pagamento. Você pode tentar de
                novo em seguida.
              </p>
            ) : gestaoCheckout === "pending" ? (
              <p className="muted" style={{ marginBottom: "1rem" }}>
                Pagamento pendente no Mercado Pago. Esta página será
                atualizada quando o relatório revisar o status da gestão.
              </p>
            ) : null}
            {managementPaid ? (
              <>
                <h2>Estamos prontos pra começar</h2>
                <p>
                  Pagamento registrado — obrigado! Fala com a gente no
                  WhatsApp pelo link abaixo (já incluímos os dados da loja
                  que você indicou).
                </p>
                {whatsappGestaoLink ? (
                  <a
                    className="btn btn-primary"
                    href={whatsappGestaoLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => void trackCta()}
                  >
                    WhatsApp — próximos passos
                  </a>
                ) : null}
              </>
            ) : (
              <>
                <h2>
                  {(fi?.lossMonthlyBrl ?? 0) > 0
                    ? `${fi?.lossMonthlyFormatted ?? story?.lossMonthlyFormatted} ainda em risco — quem corrige isso com você?`
                    : "Seu diagnóstico apontou gargalos — vamos fechá-los juntos?"}
                </h2>
                <p style={{ marginTop: "0.5rem" }}>
                  Você pode executar o plano internamente. Ou ter uma equipe
                  especializada aplicando as correções deste relatório todos os dias.
                </p>
                <p>
                  Cada semana sem ajuste em campanhas críticas mantém a mesma
                  ineficiência no ar — e o leilão da Meta não espera.
                </p>
                <p>
                  O diagnóstico mostrou exatamente onde sua operação está
                  perdendo eficiência. Mas Meta Ads, Google Ads e mensuração
                  não são problemas que se resolvem uma única vez.
                </p>
                <ul className="pain-list">
                  <li><span className="pain-emoji">•</span><span>Novos concorrentes entram no leilão.</span></li>
                  <li><span className="pain-emoji">•</span><span>Criativos saturam.</span></li>
                  <li><span className="pain-emoji">•</span><span>Custos oscilam.</span></li>
                  <li><span className="pain-emoji">•</span><span>O comportamento do consumidor muda.</span></li>
                </ul>
                <p>
                  E pequenas decisões erradas podem custar milhares de reais
                  ao longo dos próximos meses.
                </p>

                <h3 style={{ marginTop: "1.5rem" }}>O que nossa equipe assume</h3>
                <div className="services-grid">
                  <div className="service-col">
                    <h4>Meta Ads</h4>
                    <ul>
                      <li>✓ Gestão e otimização contínua</li>
                      <li>✓ Controle de CPA e ROAS</li>
                      <li>✓ Planejamento de testes</li>
                      <li>✓ Escala de campanhas vencedoras</li>
                      <li>✓ Públicos e remarketing</li>
                    </ul>
                  </div>
                  <div className="service-col">
                    <h4>Google Ads</h4>
                    <ul>
                      <li>✓ Pesquisa</li>
                      <li>✓ Performance Max</li>
                      <li>✓ Remarketing</li>
                      <li>✓ Otimização de verba</li>
                    </ul>
                  </div>
                  <div className="service-col">
                    <h4>Dados e Mensuração</h4>
                    <ul>
                      <li>✓ Google Analytics 4</li>
                      <li>✓ Auditoria de tracking</li>
                      <li>✓ Validação de eventos</li>
                      <li>✓ Análise de atribuição</li>
                      <li>✓ Apoio estratégico baseado em dados</li>
                    </ul>
                  </div>
                </div>

                <div className="vagas-box">
                  <h3 style={{ marginTop: 0 }}>
                    {GESTAO_URGENCY_TEXT}
                  </h3>
                  <p>
                    Nossa gestão completa possui investimento de{" "}
                    <strong>R$ 5.000</strong>. Mas estamos abrindo{" "}
                    <strong>2 novas operações</strong> para entrar no
                    processo por <strong>R$ 1.997</strong>.
                  </p>
                  <p>
                    O objetivo é selecionar empresas com potencial de
                    crescimento e construir novos cases de performance.
                    Após o preenchimento das vagas, novas entradas retornam
                    para a condição padrão.
                  </p>
                  <p style={{ fontWeight: 700, color: "#991b1b" }}>
                    Restam apenas 2 vagas disponíveis.
                  </p>
                </div>

                <p className="form-intro">
                  Preencha os dados abaixo para solicitar uma avaliação da
                  sua operação. Se houver compatibilidade, entraremos em
                  contato para apresentar o plano de crescimento e iniciar a
                  gestão.
                </p>
                <div
                  style={{
                    display: "grid",
                    gap: "0.75rem",
                    marginBottom: "1rem",
                  }}
                >
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      Nome da loja
                    </span>
                    <input
                      className="field-input"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      autoComplete="organization"
                      maxLength={240}
                      required
                    />
                  </label>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      Site / URL principal
                    </span>
                    <input
                      className="field-input"
                      type="url"
                      inputMode="url"
                      placeholder="https://..."
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      maxLength={500}
                      required
                    />
                  </label>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      Instagram (@conta ou URL)
                    </span>
                    <input
                      className="field-input"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      maxLength={240}
                      placeholder="@loja ou link"
                      required
                    />
                  </label>
                </div>
                {mgmt.error ? (
                  <p style={{ color: "#b91c1c", marginBottom: "0.5rem" }}>
                    {mgmt.error}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="btn btn-pain"
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
                    : "Reservar uma das 2 vagas por R$ 1.997 →"}
                </button>
              </>
            )}
          </section>
        ) : null}

        <p className="muted" style={{ fontSize: "0.8rem", textAlign: "center" }}>
          {analysis.disclaimer}
        </p>
    </DiagnosisReportShell>
  );
}
