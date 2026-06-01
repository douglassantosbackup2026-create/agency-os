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
import "@/styles/diagnosis.css";


type DiagnosticoSearch = { s?: string; gestaoCheckout?: string };

type Analysis = {
  score: number;
  scoreLabel: string;
  summary: string;
  metrics?: {
    name: string;
    current: string;
    reference: string;
    status: string;
  }[];
  criticalIssues?: { title: string; description: string; priority: string }[];
  budgetLeaks?: { title: string; estimateNote: string; hint: string }[];
  opportunities?: {
    title: string;
    potentialNote: string;
    complexity: string;
  }[];
  creativesSummary?: { best: string | null; worst: string | null; recommendation: string };
  audiencesSummary?: { segmentation: string; notes: string[] };
  structureNotes?: string[];
  actionPlan?: { step: number; action: string; impact: string; eta: string }[];
  improvementScenario?: { note: string; confidence: string };
  campaignBreakdown?: {
    name: string;
    spend: string;
    roas: string;
    ctr: string;
    cpm: string;
    frequency: string;
    status: string;
  }[];
  dataLimitations?: string[];
  disclaimer?: string;
};

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
  const [ctxNiche, setCtxNiche] = useState("");
  const [ctxTicket, setCtxTicket] = useState("");
  const [ctxMargin, setCtxMargin] = useState("");
  const [ctxGoal, setCtxGoal] = useState("");
  const [ctxNotes, setCtxNotes] = useState("");
  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxSaving, setCtxSaving] = useState(false);
  const [ctxSavedAt, setCtxSavedAt] = useState<string | null>(null);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [doneSteps, setDoneSteps] = useState<Record<string, boolean>>({});
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [simCpa, setSimCpa] = useState(15);
  const [simCtr, setSimCtr] = useState(20);
  const [simLeak, setSimLeak] = useState(40);
  const [simSpendInput, setSimSpendInput] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryMsg, setSummaryMsg] = useState<string | null>(null);

  const [data, setData] = useState<{
    diagnosis?: {
      status?: string;
      failed_reason?: string | null;
      management_status?: string | null;
      management_business_name?: string | null;
      business_context?: BusinessContext | null;
    };
    report?: {
      analysis_json?: Analysis | null;
      management_cta_eligible?: boolean;
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
  const savedContext = data?.diagnosis?.business_context ?? null;

  useEffect(() => {
    if (!savedContext) return;
    setCtxNiche(savedContext.niche ?? "");
    setCtxTicket(savedContext.avg_ticket_brl != null ? String(savedContext.avg_ticket_brl) : "");
    setCtxMargin(savedContext.margin_pct != null ? String(savedContext.margin_pct) : "");
    setCtxGoal(savedContext.monthly_goal_brl != null ? String(savedContext.monthly_goal_brl) : "");
    setCtxNotes(savedContext.notes ?? "");
    setCtxSavedAt(savedContext.saved_at ?? null);
  }, [savedContext]);

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


  async function saveBusinessContext() {
    if (!s) return;
    setCtxError(null);
    setCtxSaving(true);
    try {
      const res = await invokeDiagnosisFunction("diagnosis-context", {
        method: "POST",
        body: JSON.stringify({
          diagnosis_id: diagnosisId,
          secret_slug: s,
          context: {
            niche: ctxNiche.trim() || null,
            avg_ticket_brl: ctxTicket || null,
            margin_pct: ctxMargin || null,
            monthly_goal_brl: ctxGoal || null,
            notes: ctxNotes.trim() || null,
          },
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; context?: BusinessContext };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Falha ao salvar");
      setCtxSavedAt(j.context?.saved_at ?? new Date().toISOString());
      setData((d) =>
        d
          ? {
              ...d,
              diagnosis: { ...d.diagnosis, business_context: j.context ?? null },
            }
          : d,
      );
    } catch (e) {
      setCtxError(e instanceof Error ? e.message : "Erro");
    } finally {
      setCtxSaving(false);
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

  const tocItems: { id: string; label: string }[] = [];
  if (topPriorities.length) tocItems.push({ id: "sec-top", label: "Top 3 prioridades" });
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
  tocItems.push({ id: "sec-business", label: "Negócio" });
  tocItems.push({ id: "sec-sim", label: "Simulador" });
  if (analysis.improvementScenario?.note) tocItems.push({ id: "sec-scenario", label: "Cenário" });

  if (analysis.dataLimitations?.length) tocItems.push({ id: "sec-limits", label: "Limitações" });
  if (data.report?.management_cta_eligible) tocItems.push({ id: "sec-cta", label: "Próximo passo" });

  const parseNum = (v: string): number | null => {
    if (!v) return null;
    const n = Number(v.replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const ticketNum = parseNum(ctxTicket);
  const marginNum = parseNum(ctxMargin);
  const goalNum = parseNum(ctxGoal);
  const fmtBRL = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");

  const observedRoasMetric = analysis.metrics?.find((m) => /roas/i.test(m.name));
  const observedRoas = observedRoasMetric
    ? Number((observedRoasMetric.current ?? "").replace(/[^\d.,-]/g, "").replace(",", "."))
    : null;

  const breakevenRoas = marginNum && marginNum > 0 ? 100 / marginNum : null;
  const salesNeeded = goalNum && ticketNum && ticketNum > 0 ? goalNum / ticketNum : null;
  const contributionAtGoal = goalNum && marginNum ? (goalNum * marginNum) / 100 : null;
  const roasGap = observedRoas && breakevenRoas ? observedRoas - breakevenRoas : null;
  const hasInterpretation =
    Boolean(savedContext) && (breakevenRoas || salesNeeded || contributionAtGoal);

  // P5 — benchmarks por nicho
  const nicheKey = matchNicheKey(savedContext?.niche ?? null);
  const niche = nicheKey ? NICHE_BENCHMARKS[nicheKey] : null;

  // P5 — gasto mensal estimado a partir das métricas (procura "Investimento", "Gasto" etc.)
  const spendMetric = analysis.metrics?.find((m) =>
    /investimento|gasto|spend|orç|invest/i.test(m.name),
  );
  const observedMonthlySpend = spendMetric
    ? Number((spendMetric.current ?? "").replace(/[^\d.,-]/g, "").replace(",", "."))
    : null;

  // P5 — simulador interativo (estado declarado no topo)
  const simSpendNum = parseNum(simSpendInput);
  const monthlySpend = observedMonthlySpend || simSpendNum;

  const simulation = (() => {
    if (!observedRoas || !monthlySpend) return null;
    const gain = simCpa / 100 + (simCtr * 0.5) / 100 + (simLeak * 0.7) / 100;
    const newRoas = observedRoas * (1 + gain);
    const baseRevenue = monthlySpend * observedRoas;
    const newRevenue = monthlySpend * newRoas;
    const extraRevenue = newRevenue - baseRevenue;
    const extraContribution = marginNum ? (extraRevenue * marginNum) / 100 : null;
    const gapPctClosed =
      contributionAtGoal && extraContribution
        ? Math.min(100, (extraContribution / contributionAtGoal) * 100)
        : null;
    return { newRoas, extraRevenue, extraContribution, gapPctClosed, baseRevenue };
  })();

  // P6 — roadmap 30/60/90: agrupa actionPlan pelo campo eta
  type PlanItem = { step: number; action: string; impact: string; eta: string };
  const roadmap: { short: PlanItem[]; mid: PlanItem[]; long: PlanItem[] } = (() => {
    const buckets = { short: [] as PlanItem[], mid: [] as PlanItem[], long: [] as PlanItem[] };
    (analysis.actionPlan ?? []).forEach((item) => {
      const eta = (item.eta || "").toLowerCase();
      const m = eta.match(/(\d+)/);
      const n = m ? Number(m[1]) : 0;
      let days = 30;
      if (m) {
        if (/h(ora)?/.test(eta)) days = Math.ceil(n / 24);
        else if (/dia/.test(eta)) days = n;
        else if (/sem/.test(eta)) days = n * 7;
        else if (/m[eê]s/.test(eta)) days = n * 30;
        else if (/trim/.test(eta)) days = n * 90;
        else days = n;
      }
      if (days <= 14) buckets.short.push(item);
      else if (days <= 45) buckets.mid.push(item);
      else buckets.long.push(item);
    });
    return buckets;
  })();

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
    if (roasGap != null && roasGap < 0) {
      out.push({
        title: "Não escalar antes de fechar break-even",
        reason: `ROAS observado está ${Math.abs(roasGap).toFixed(2)}x abaixo do ponto de equilíbrio. Escalar amplia o prejuízo unitário.`,
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
  const execSummary = (() => {
    const lines: string[] = [];
    lines.push(`Diagnóstico Meta Ads — score ${score}/100 (${analysis.scoreLabel})`);
    lines.push("");
    if (topPriorities.length) {
      lines.push("Top 3 prioridades:");
      topPriorities.forEach((p, i) => lines.push(`${i + 1}. ${p.title}`));
      lines.push("");
    }
    if (roasGap != null) {
      lines.push(
        `ROAS observado vs equilíbrio: ${roasGap >= 0 ? "+" : ""}${roasGap.toFixed(2)}x`,
      );
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
      await navigator.clipboard.writeText(execSummary);
      setSummaryMsg("Resumo copiado!");
      trackEvent("summary_copy");
    } catch {
      setSummaryMsg("Não foi possível copiar.");
    }
    setTimeout(() => setSummaryMsg(null), 2500);
  }

  function shareSummaryWhatsApp() {
    trackEvent("summary_whatsapp");
    const url = `https://wa.me/?text=${encodeURIComponent(execSummary)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function shareSummaryEmail() {
    trackEvent("summary_email");
    const subject = encodeURIComponent(`Diagnóstico Meta Ads — score ${score}/100`);
    const body = encodeURIComponent(execSummary);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }


  return (
    <div className="diagnosis-funnel">
      <div className="container">
        <header className="card hero-card">
          <span className="eyebrow">Diagnóstico Meta Ads</span>
          <div
            className="score-big"
            style={{
              color:
                scoreTier === "low"
                  ? "#dc2626"
                  : scoreTier === "mid"
                    ? "#d97706"
                    : "#059669",
            }}
          >
            {score}
            <span style={{ fontSize: "1.5rem", color: "#94a3b8" }}>/100</span>
          </div>
          <div className={`score-bar score-${scoreTier}`}>
            <span style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
          </div>
          <h1 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.5rem" }}>
            {analysis.scoreLabel}
          </h1>
          <p className="hero-pain">{heroPain}</p>
          <p style={{ margin: 0, color: "#334155" }}>{analysis.summary}</p>
        </header>

        <div className="report-toolbar no-print" role="toolbar" aria-label="Ações do relatório">
          <button type="button" className="toolbar-btn" onClick={() => void copyReportLink()}>
            🔗 Copiar link
          </button>
          <button type="button" className="toolbar-btn" onClick={printReport}>
            🖨️ Imprimir / Salvar PDF
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => {
              setSummaryOpen((v) => !v);
              if (!summaryOpen) trackEvent("summary_open");
            }}
            aria-expanded={summaryOpen}
          >
            📤 Resumo executivo
          </button>
          <button type="button" className="toolbar-btn" onClick={downloadReminder}>
            ⏰ Lembrar em 30 dias
          </button>
          {shareMsg ? <span className="toolbar-msg" role="status">{shareMsg}</span> : null}
        </div>

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
            <pre className="summary-text">{execSummary}</pre>
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






        {tocItems.length > 1 ? (
          <nav className="report-toc" aria-label="Índice do relatório">
            {tocItems.map((it) => (
              <a key={it.id} href={`#${it.id}`} className="report-toc-link">
                {it.label}
              </a>
            ))}
          </nav>
        ) : null}

        {topPriorities.length ? (
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

        {analysis.metrics?.length ? (
          <section className="card" id="sec-metrics">
            <h2>Onde seu dinheiro está agora</h2>
            <p className="section-hint">
              Os números reais da sua conta, comparados com a referência
              que usamos como base.
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
                Informe seu nicho em <a href="#sec-business">Contexto de negócio</a>{" "}
                para ver faixas de referência específicas ao seu segmento.
              </p>
            )}
            <div className="pain-line">
              Cada métrica fora da referência = real saindo da conta sem
              voltar.
            </div>
          </section>
        ) : null}


        {analysis.campaignBreakdown?.length ? (
          <section className="card" id="sec-campaigns">
            <h2>Desempenho por campanha</h2>
            <p className="section-hint">
              Top campanhas por gasto nos últimos 30 dias — onde o orçamento
              está concentrado e o retorno real de cada uma.
            </p>
            <div className="campaign-table-wrap">
              <table className="campaign-table">
                <thead>
                  <tr>
                    <th>Campanha</th>
                    <th>Gasto</th>
                    <th>ROAS</th>
                    <th>CTR</th>
                    <th>CPM</th>
                    <th>Freq.</th>
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
                    return (
                      <tr key={c.name} className={cls}>
                        <td className="campaign-name" title={c.name}>{c.name}</td>
                        <td>{c.spend}</td>
                        <td>{c.roas}</td>
                        <td>{c.ctr}</td>
                        <td>{c.cpm}</td>
                        <td>{c.frequency}</td>
                        <td>
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
              Campanhas no vermelho concentram gasto e devolvem pouco — onde
              cortar primeiro.
            </div>
          </section>
        ) : null}

        {analysis.criticalIssues?.length ? (
          <section className="card" id="sec-issues">
            <h2>Os buracos no seu funil</h2>
            <p className="section-hint">
              Cada um desses pontos está ativo agora — enquanto você lê isso.
            </p>
            {analysis.criticalIssues.map((i) => (
              <div key={i.title} className="issue-card">
                <div className="issue-icon">⚠️</div>
                <div>
                  <h3>{i.title}</h3>
                  <p className="muted" style={{ margin: "0 0 0.5rem" }}>
                    {i.description}
                  </p>
                  <span className={`badge ${priorityBadge(i.priority)}`}>
                    {i.priority}
                  </span>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {analysis.budgetLeaks?.length ? (
          <section className="card" id="sec-leaks">
            <h2>Quanto você está queimando por mês</h2>
            <p className="section-hint">
              Estimativas baseadas no histórico recente da sua conta.
            </p>
            {analysis.budgetLeaks.map((b) => (
              <div key={b.title} className="leak-card">
                <div className="leak-icon">💸</div>
                <div>
                  <h3>{b.title}</h3>
                  <p style={{ margin: "0 0 0.35rem", fontWeight: 600, color: "#991b1b" }}>
                    {b.estimateNote}
                  </p>
                  <p className="muted" style={{ margin: 0 }}>{b.hint}</p>
                </div>
              </div>
            ))}
            <div className="pain-line">
              Some o que está aí em cima — é o custo mensal de não corrigir.
            </div>
          </section>
        ) : null}

        {antiPatterns.length ? (
          <section className="card anti-card" id="sec-anti">
            <h2>O que NÃO fazer agora</h2>
            <p className="section-hint">
              Armadilhas comuns que estragam o ganho das correções. Evite
              estes movimentos enquanto executa o plano.
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



        {analysis.opportunities?.length ? (
          <section className="card" id="sec-opps">
            <h2>O que você está deixando na mesa</h2>
            <p className="section-hint">
              Receita que existe na sua conta mas ainda não foi ativada.
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

        {analysis.creativesSummary ? (
          <section className="card" id="sec-creatives">
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
          <section className="card" id="sec-audiences">
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
          <section className="card" id="sec-structure">
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

        {analysis.actionPlan?.length ? (() => {
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

        {analysis.actionPlan?.length ? (
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




        <section className="card business-card" id="sec-business">
          <span className="business-tag">Interpretação contextual · informado por você</span>
          <h2>Contexto de negócio</h2>
          <p className="section-hint">
            Opcional. Use para gerar uma leitura econômica do que os dados da
            Meta significam para a sua operação. Não substitui métricas
            observadas — apenas as traduz para o seu cenário.
          </p>

          {savedContext && !ctxOpen ? (
            <div className="business-summary">
              <ul>
                {savedContext.niche ? <li><strong>Nicho:</strong> {savedContext.niche}</li> : null}
                {savedContext.avg_ticket_brl != null ? (
                  <li><strong>Ticket médio:</strong> {fmtBRL(Number(savedContext.avg_ticket_brl))}</li>
                ) : null}
                {savedContext.margin_pct != null ? (
                  <li><strong>Margem líquida:</strong> {savedContext.margin_pct}%</li>
                ) : null}
                {savedContext.monthly_goal_brl != null ? (
                  <li><strong>Meta mensal:</strong> {fmtBRL(Number(savedContext.monthly_goal_brl))}</li>
                ) : null}
                {savedContext.notes ? <li><strong>Notas:</strong> {savedContext.notes}</li> : null}
              </ul>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setCtxOpen(true)}
              >
                Editar contexto
              </button>
            </div>
          ) : (
            <div className="business-form">
              <div className="business-grid">
                <label>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>Nicho / segmento</span>
                  <input
                    className="field-input"
                    value={ctxNiche}
                    onChange={(e) => setCtxNiche(e.target.value)}
                    maxLength={120}
                    placeholder="Ex.: moda feminina, suplementos"
                  />
                </label>
                <label>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>Ticket médio (R$)</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={ctxTicket}
                    onChange={(e) => setCtxTicket(e.target.value)}
                    placeholder="Ex.: 180"
                  />
                </label>
                <label>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>Margem líquida (%)</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={ctxMargin}
                    onChange={(e) => setCtxMargin(e.target.value)}
                    placeholder="Ex.: 30"
                  />
                </label>
                <label>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>Meta de faturamento mensal (R$)</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={ctxGoal}
                    onChange={(e) => setCtxGoal(e.target.value)}
                    placeholder="Ex.: 100000"
                  />
                </label>
              </div>
              <label style={{ display: "grid", gap: "0.25rem", marginTop: "0.65rem" }}>
                <span className="muted" style={{ fontSize: "0.85rem" }}>Observações (opcional)</span>
                <textarea
                  className="field-input"
                  rows={2}
                  maxLength={600}
                  value={ctxNotes}
                  onChange={(e) => setCtxNotes(e.target.value)}
                  placeholder="Sazonalidade, lançamentos, contexto relevante"
                />
              </label>
              {ctxError ? (
                <p style={{ color: "#b91c1c", marginTop: "0.5rem" }}>{ctxError}</p>
              ) : null}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={ctxSaving}
                  onClick={() => void saveBusinessContext().then(() => setCtxOpen(false))}
                >
                  {ctxSaving ? "Salvando…" : savedContext ? "Atualizar contexto" : "Salvar contexto"}
                </button>
                {savedContext ? (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setCtxOpen(false)}
                    disabled={ctxSaving}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
              {ctxSavedAt && !ctxSaving ? (
                <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  Salvo em {new Date(ctxSavedAt).toLocaleString("pt-BR")}.
                </p>
              ) : null}
            </div>
          )}

          {hasInterpretation ? (
            <div className="business-interpretation">
              <div className="business-interpretation-header">
                <h3>Interpretação de negócio</h3>
                <span className="badge badge-medium">Inferência contextual</span>
              </div>
              <p className="muted" style={{ marginTop: 0 }}>
                Cálculos baseados no que você informou acima. Não são dados
                observados na Meta — são uma tradução econômica do cenário.
              </p>
              <div className="business-stats">
                {breakevenRoas ? (
                  <div className="business-stat">
                    <div className="business-stat-label">ROAS de equilíbrio</div>
                    <div className="business-stat-value">{breakevenRoas.toFixed(2)}x</div>
                    <div className="business-stat-hint">
                      Abaixo disso, mídia paga consome margem.
                    </div>
                  </div>
                ) : null}
                {roasGap != null ? (
                  <div className={`business-stat ${roasGap < 0 ? "is-bad" : "is-good"}`}>
                    <div className="business-stat-label">Gap vs. ROAS observado</div>
                    <div className="business-stat-value">
                      {roasGap >= 0 ? "+" : ""}{roasGap.toFixed(2)}x
                    </div>
                    <div className="business-stat-hint">
                      {roasGap >= 0
                        ? "Mídia está cobrindo a margem."
                        : "Mídia ainda não paga a operação."}
                    </div>
                  </div>
                ) : null}
                {salesNeeded ? (
                  <div className="business-stat">
                    <div className="business-stat-label">Vendas/mês p/ meta</div>
                    <div className="business-stat-value">{fmtInt(salesNeeded)}</div>
                    <div className="business-stat-hint">
                      No ticket médio informado.
                    </div>
                  </div>
                ) : null}
                {contributionAtGoal ? (
                  <div className="business-stat">
                    <div className="business-stat-label">Margem na meta</div>
                    <div className="business-stat-value">{fmtBRL(contributionAtGoal)}</div>
                    <div className="business-stat-hint">
                      Contribuição bruta projetada.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <section className="card simulator-card" id="sec-sim">
          <span className="business-tag">Simulador indicativo</span>
          <h2>Quanto a correção pode gerar</h2>
          <p className="section-hint">
            Ajuste os controles para estimar o impacto de implementar as
            recomendações. Valores indicativos — não são projeção garantida.
          </p>
          {!observedRoas ? (
            <p className="muted">
              Precisamos do ROAS observado para simular. Reabra o diagnóstico
              quando a Meta retornar dados completos.
            </p>
          ) : (
            <>
              {!observedMonthlySpend ? (
                <label className="sim-spend">
                  <span className="muted" style={{ fontSize: "0.85rem" }}>
                    Gasto mensal médio (R$) — informe para calcular
                  </span>
                  <input
                    className="field-input"
                    inputMode="numeric"
                    placeholder="Ex.: 8000"
                    value={simSpendInput}
                    onChange={(e) => setSimSpendInput(e.target.value)}
                  />
                </label>
              ) : null}

              <div className="sim-controls">
                <label className="sim-slider">
                  <span>
                    Redução de CPA: <strong>{simCpa}%</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={simCpa}
                    onChange={(e) => setSimCpa(Number(e.target.value))}
                  />
                </label>
                <label className="sim-slider">
                  <span>
                    Aumento de CTR: <strong>{simCtr}%</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    step={1}
                    value={simCtr}
                    onChange={(e) => setSimCtr(Number(e.target.value))}
                  />
                </label>
                <label className="sim-slider">
                  <span>
                    Recuperação de vazamento: <strong>{simLeak}%</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={simLeak}
                    onChange={(e) => setSimLeak(Number(e.target.value))}
                  />
                </label>
              </div>

              {simulation ? (
                <div className="sim-results">
                  <div className="sim-stat">
                    <span className="sim-stat-label">ROAS projetado</span>
                    <span className="sim-stat-value">
                      {simulation.newRoas.toFixed(2)}x
                    </span>
                    <span className="muted" style={{ fontSize: "0.75rem" }}>
                      hoje {observedRoas?.toFixed(2)}x
                    </span>
                  </div>
                  <div className="sim-stat">
                    <span className="sim-stat-label">Receita extra / mês</span>
                    <span className="sim-stat-value">
                      +{fmtBRL(Math.max(0, simulation.extraRevenue))}
                    </span>
                  </div>
                  {simulation.extraContribution != null ? (
                    <div className="sim-stat">
                      <span className="sim-stat-label">Margem extra / mês</span>
                      <span className="sim-stat-value">
                        +{fmtBRL(Math.max(0, simulation.extraContribution))}
                      </span>
                      <span className="muted" style={{ fontSize: "0.75rem" }}>
                        considerando margem informada
                      </span>
                    </div>
                  ) : null}
                  {simulation.gapPctClosed != null ? (
                    <div className="sim-stat">
                      <span className="sim-stat-label">Gap até a meta</span>
                      <span className="sim-stat-value">
                        {Math.round(simulation.gapPctClosed)}% fechado
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="muted">
                  Informe o gasto mensal acima para ver a estimativa.
                </p>
              )}
              <p className="muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
                Cálculo composto e indicativo: CPA tem peso direto, CTR peso
                médio e recuperação de vazamento peso alto sobre o ROAS atual.
              </p>
            </>
          )}
        </section>





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
                <h2>Você já sabe onde está o problema.</h2>
                <p style={{ marginTop: "0.5rem" }}>
                  Agora a decisão é simples.
                </p>
                <p>
                  Você pode continuar gerenciando essas correções
                  internamente. Ou pode ter uma equipe acompanhando sua
                  aquisição todos os dias para garantir que esses gargalos
                  não continuem consumindo resultado.
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
                    Condição especial para as próximas 2 operações
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
      </div>
    </div>
  );
}
