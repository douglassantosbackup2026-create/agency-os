import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { invokeDiagnosisFunction } from "@/lib/diagnosis-invoke";
import {
  buildGestaoIntroMessage,
  whatsappGestaoHref,
} from "@/lib/gestao-whatsapp";
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
  if (analysis.opportunities?.length) tocItems.push({ id: "sec-opps", label: "Oportunidades" });
  if (analysis.creativesSummary) tocItems.push({ id: "sec-creatives", label: "Criativos" });
  if (analysis.audiencesSummary) tocItems.push({ id: "sec-audiences", label: "Públicos" });
  if (analysis.structureNotes?.length) tocItems.push({ id: "sec-structure", label: "Fundação" });
  if (analysis.actionPlan?.length) tocItems.push({ id: "sec-plan", label: "Plano de ação" });
  if (analysis.improvementScenario?.note) tocItems.push({ id: "sec-scenario", label: "Cenário" });
  if (analysis.dataLimitations?.length) tocItems.push({ id: "sec-limits", label: "Limitações" });
  if (data.report?.management_cta_eligible) tocItems.push({ id: "sec-cta", label: "Próximo passo" });

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

        {analysis.actionPlan?.length ? (
          <section className="card" id="sec-plan">
            <h2>Plano de ação</h2>
            <p className="section-hint">
              A sequência sugerida pela análise — ordenada por impacto.
            </p>
            <ol className="action-plan">
              {[...analysis.actionPlan]
                .sort((a, b) => (a.step ?? 0) - (b.step ?? 0))
                .map((a) => (
                  <li key={`${a.step}-${a.action}`} className="action-step">
                    <div className="action-step-num">{a.step}</div>
                    <div className="action-step-body">
                      <div className="action-step-title">{a.action}</div>
                      <div className="action-step-meta">
                        <span><strong>Impacto:</strong> {a.impact}</span>
                        <span><strong>Prazo:</strong> {a.eta}</span>
                      </div>
                    </div>
                  </li>
                ))}
            </ol>
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
