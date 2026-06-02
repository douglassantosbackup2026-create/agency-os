import { useMemo, useState, type ReactNode } from "react";
import type { DiagnosisAnalysis } from "@/components/diagnosis-report/types";
import { buildRoadmapFromActionPlan } from "@/lib/diagnosis-roadmap";

type Props = {
  analysis: DiagnosisAnalysis;
  onPrimaryCta?: () => void;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  showCtaButton?: boolean;
};

const fmtBRL = (n: number, max = 0) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: max,
  });

const statusToClass = (status?: string): "is-good" | "is-mid" | "is-bad" => {
  const s = (status ?? "").toLowerCase();
  if (/(bom|good|ok|verde|green|saudável|saudavel|high|acima)/.test(s)) return "is-good";
  if (/(médio|medio|mid|atenção|atencao|warning|warn|amber|amarelo|na média|na media)/.test(s))
    return "is-mid";
  if (/(mau|bad|baixo|crítico|critico|red|vermelho|low|alerta|abaixo)/.test(s)) return "is-bad";
  return "is-mid";
};

const priorityClass = (p?: string | number): "is-high" | "is-mid" | "is-low" => {
  if (typeof p === "number") return p >= 70 ? "is-high" : p >= 40 ? "is-mid" : "is-low";
  const s = (p ?? "").toString().toLowerCase();
  if (/(alta|high|crítica|critica|urgente)/.test(s)) return "is-high";
  if (/(média|media|medium|moderada)/.test(s)) return "is-mid";
  return "is-low";
};

const statusLabel = (status?: string) => {
  const c = statusToClass(status);
  if (c === "is-good") return "Acima da média";
  if (c === "is-mid") return "Na média";
  return "Abaixo da média";
};

function Section({
  num,
  eyebrow,
  title,
  subtitle,
  children,
  id,
}: {
  num: string;
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="exec-section" id={id}>
      <div className="exec-eyebrow">
        <span className="exec-eyebrow-num">{num}</span>
        <span className="exec-eyebrow-rule" />
        <span>{eyebrow}</span>
      </div>
      <h2 className="exec-headline">{title}</h2>
      {subtitle ? <p className="exec-subhead">{subtitle}</p> : null}
      {children}
    </section>
  );
}

function ScoreRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 90;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="exec-score-ring">
      <svg viewBox="0 0 200 200" aria-hidden>
        <circle cx="100" cy="100" r={r} fill="none" strokeWidth="6" className="exec-score-ring-track" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="exec-score-ring-bar"
        />
      </svg>
      <div className="exec-score-ring-inner">
        <div className="exec-score-value">{Math.round(pct)}</div>
        <div className="exec-score-total">de 100 pontos</div>
      </div>
    </div>
  );
}

export function DiagnosisExecutiveReport({
  analysis,
  onPrimaryCta,
  primaryCtaLabel = "Agendar Reunião Estratégica",
  primaryCtaHref,
  showCtaButton = true,
}: Props) {
  // ============ HERO data ============
  const fi = analysis.financialImpact;
  const fb = analysis.financialBalance;
  const story = analysis.storyExecutive;
  const gi = analysis.growthIntelligenceDerived;

  const investedFormatted =
    gi?.executiveImpact.investedFormatted ?? fb?.investedFormatted ?? fi?.spendFormatted ?? "—";
  const revenueFormatted =
    gi?.executiveImpact.revenueActualFormatted ?? fb?.revenueFormatted ?? fi?.revenueFormatted ?? "—";
  const lossMonthly = fi?.lossMonthlyBrl ?? 0;
  const lossFormatted =
    fi?.lossMonthlyFormatted ?? story?.lossMonthlyFormatted ?? gi?.executiveImpact.gapMonthlyFormatted ?? "—";
  const recoveryRange =
    story?.recoveryRangeFormatted ??
    (fi?.recoveryConservativeFormatted && fi?.recoveryOptimisticFormatted
      ? `${fi.recoveryConservativeFormatted} a ${fi.recoveryOptimisticFormatted}`
      : (fi?.recoveryConservativeFormatted ?? fi?.recoveryOptimisticFormatted ?? "—"));

  const heroValue = lossMonthly > 0 ? lossFormatted : recoveryRange;
  const heroHasOpportunity = lossMonthly > 0 || (fi?.recoveryConservativeBrl ?? 0) > 0;

  // Largest leak (bottleneck) & largest opportunity
  const allLeaks = useMemo(() => {
    const fromBudget = (analysis.budgetLeaks ?? []).map((b, i) => ({
      title: b.title,
      monthlyBrl: b.monthlyBrl ?? 0,
      description: b.estimateNote || b.hint,
      hint: b.hint,
      priority: i === 0 ? "Alta" : i === 1 ? "Média" : "Baixa",
      category: "Vazamento",
    }));
    const fromGi = (gi?.moneyLeaks ?? []).map((m) => ({
      title: m.title,
      monthlyBrl: m.monthlyImpactBrl,
      description: m.rootCause,
      hint: m.action,
      priority: m.priority >= 70 ? "Alta" : m.priority >= 40 ? "Média" : "Baixa",
      category: m.category || "Vazamento",
    }));
    const merged = fromGi.length ? fromGi : fromBudget;
    return merged.sort((a, b) => (b.monthlyBrl ?? 0) - (a.monthlyBrl ?? 0));
  }, [analysis.budgetLeaks, gi?.moneyLeaks]);

  const totalLeaks = allLeaks.reduce((s, l) => s + (l.monthlyBrl ?? 0), 0);
  const topLeak = allLeaks[0];

  const opportunities = useMemo(() => {
    if (gi?.growthOpportunities?.length) {
      return gi.growthOpportunities.map((o) => ({
        title: o.title,
        potential: o.potentialFormatted,
        why: o.whyExists,
        how: o.howToCapture,
        eta: o.estimatedEta,
        difficulty: "Média",
      }));
    }
    return (analysis.opportunities ?? []).map((o) => ({
      title: o.title,
      potential: o.potentialNote,
      why: "",
      how: "",
      eta: "—",
      difficulty: o.complexity || "Média",
    }));
  }, [analysis.opportunities, gi?.growthOpportunities]);

  const topOpp = opportunities[0];

  // Benchmark
  const benchmarks = analysis.benchmarkComparison?.gaps ?? [];

  // Maturity
  const maturity = analysis.maturity;
  const pillars = maturity?.pillars ?? analysis.scoreExplanation?.pillars?.map((p) => ({
    id: p.id,
    label: p.label,
    score: Number(p.value.replace(/[^\d.]/g, "")) || 0,
    detail: p.detail,
  })) ?? [];
  const scoreVal = analysis.score ?? 0;

  // Action plan
  const roadmap = useMemo(
    () => buildRoadmapFromActionPlan(analysis.actionPlan ?? analysis.prioritizedActions ?? []),
    [analysis.actionPlan, analysis.prioritizedActions],
  );

  // Projections
  const scenarios = analysis.growthScenarios;
  const giScenarios = gi?.projections?.scenarios ?? [];

  // Annual opportunity for final CTA
  const annualOpp = (fi?.recoveryOptimisticBrl ?? fi?.lossMonthlyBrl ?? 0) * 12;

  return (
    <div className="exec-root">
      {/* Top bar */}
      <header className="exec-topbar exec-container">
        <div className="exec-brand">
          <span className="exec-brand-dot" />
          Retentio · Diagnóstico Executivo
        </div>
        <div className="exec-meta">Meta Ads · {new Date().toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</div>
      </header>

      <main className="exec-container">
        {/* ============ SECTION 1 — HERO ============ */}
        <section className="exec-section exec-hero" id="hero">
          <div className="exec-hero-tag">
            <span>●</span> Análise concluída · {Math.round(scoreVal)}/100
          </div>
          <h1 className="exec-hero-headline">
            Identificamos <span className="accent">{heroValue}</span>{lossMonthly > 0 ? "/mês" : ""}
            <br />
            {heroHasOpportunity ? "em oportunidade não capturada." : "para destravar agora."}
          </h1>
          <p className="exec-hero-sub">
            Análise baseada nos dados reais da sua conta Meta Ads — campanhas, criativos, públicos e estrutura financeira dos últimos 30 dias.
          </p>

          <div className="exec-stats">
            <div className="exec-stat">
              <div className="exec-stat-label">Investimento analisado</div>
              <div className="exec-stat-value">{investedFormatted}</div>
              <p className="exec-stat-hint">Últimos 30 dias</p>
            </div>
            <div className="exec-stat">
              <div className="exec-stat-label">Receita gerada</div>
              <div className="exec-stat-value is-positive">{revenueFormatted}</div>
              <p className="exec-stat-hint">ROAS {fi?.roasFormatted ?? gi?.executiveImpact.roasActualFormatted ?? "—"}</p>
            </div>
            <div className="exec-stat">
              <div className="exec-stat-label">Potencial identificado</div>
              <div className="exec-stat-value is-accent">
                {fi?.recoveryOptimisticFormatted ?? recoveryRange}
              </div>
              <p className="exec-stat-hint">Recuperável em 60–90 dias</p>
            </div>
            <div className="exec-stat">
              <div className="exec-stat-label">Gap de crescimento</div>
              <div className="exec-stat-value is-negative">{lossFormatted}</div>
              <p className="exec-stat-hint">Por mês — se nada mudar</p>
            </div>
          </div>

          <div className="exec-pair">
            {topLeak ? (
              <div className="exec-insight is-pain">
                <div className="exec-insight-label"><span className="dot" /> Maior gargalo identificado</div>
                <h3 className="exec-insight-title">{topLeak.title}</h3>
                {topLeak.monthlyBrl > 0 ? (
                  <div className="exec-insight-impact">−{fmtBRL(topLeak.monthlyBrl)}/mês</div>
                ) : null}
                <p className="exec-insight-body">{topLeak.description}</p>
              </div>
            ) : null}
            {topOpp ? (
              <div className="exec-insight is-gain">
                <div className="exec-insight-label"><span className="dot" /> Maior oportunidade identificada</div>
                <h3 className="exec-insight-title">{topOpp.title}</h3>
                <div className="exec-insight-impact">{topOpp.potential}</div>
                <p className="exec-insight-body">{topOpp.why || topOpp.how || "Oportunidade observada nos dados da conta."}</p>
              </div>
            ) : null}
          </div>

          {showCtaButton ? (
            <div className="exec-cta-row">
              {primaryCtaHref ? (
                <a
                  className="exec-btn exec-btn-primary"
                  href={primaryCtaHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onPrimaryCta}
                >
                  {primaryCtaLabel}
                  <span className="exec-btn-arrow">→</span>
                </a>
              ) : (
                <button type="button" className="exec-btn exec-btn-primary" onClick={onPrimaryCta}>
                  {primaryCtaLabel}
                  <span className="exec-btn-arrow">→</span>
                </button>
              )}
              <p className="exec-cta-note">15 min · sem custo · sem compromisso</p>
            </div>
          ) : null}
        </section>

        {/* ============ SECTION 2 — MATURITY ============ */}
        {pillars.length || maturity ? (
          <Section
            num="02"
            eyebrow="Maturidade da Operação"
            title={<>Onde sua operação <span className="accent">está hoje</span></>}
            subtitle="Avaliação por pilar — estrutura, públicos, criativos, escala e eficiência. Operações líderes do segmento normalmente operam acima de 85 pontos."
            id="maturidade"
          >
            <div className="exec-maturity-grid">
              <div>
                <ScoreRing value={scoreVal} />
                {maturity?.label ? <div className="exec-score-level">{maturity.label}</div> : null}
              </div>
              <div className="exec-pillars">
                {pillars.map((p) => {
                  const v = typeof p.score === "number" ? p.score : 0;
                  return (
                    <div key={p.id} className="exec-pillar">
                      <div className="exec-pillar-label">{p.label}</div>
                      <div className="exec-pillar-bar">
                        <div className="exec-pillar-fill" style={{ width: `${Math.max(4, Math.min(100, v))}%` }} />
                      </div>
                      <div className="exec-pillar-val">{Math.round(v)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {maturity?.summary ? <p className="exec-maturity-note">{maturity.summary}</p> : null}
          </Section>
        ) : null}

        {/* ============ SECTION 3 — LEAKS ============ */}
        {allLeaks.length ? (
          <Section
            num="03"
            eyebrow="Onde o Dinheiro Está Vazando"
            title={<>Quanto dinheiro está <span className="accent">ficando na mesa</span></>}
            subtitle="Cada item abaixo representa receita não capturada ou investimento desperdiçado, identificado nos dados da sua conta."
            id="vazamentos"
          >
            {totalLeaks > 0 ? (
              <div className="exec-leak-total">
                <div>
                  <div className="exec-leak-total-label">Total estimado em vazamentos</div>
                  <div className="exec-leak-total-value">{fmtBRL(totalLeaks)}</div>
                </div>
                <div className="exec-leak-total-period">por mês · {fmtBRL(totalLeaks * 12)} ao ano</div>
              </div>
            ) : null}

            <ul className="exec-leak-list">
              {allLeaks.map((leak, idx) => (
                <details key={`${leak.title}-${idx}`} className="exec-leak-item" {...(idx === 0 ? { open: true } : {})}>
                  <summary className="exec-leak-row">
                    <div className="exec-leak-rank">{String(idx + 1).padStart(2, "0")}</div>
                    <div>
                      <h3 className="exec-leak-title">{leak.title}</h3>
                      <div className="exec-leak-meta">
                        <span className={`exec-prio-badge ${priorityClass(leak.priority)}`}>{leak.priority}</span>
                        <span>{leak.category}</span>
                      </div>
                    </div>
                    <div className="exec-leak-impact">
                      {leak.monthlyBrl > 0 ? `−${fmtBRL(leak.monthlyBrl)}/mês` : "Impacto qualitativo"}
                    </div>
                    <div className="exec-leak-toggle" aria-hidden>+</div>
                  </summary>
                  <div className="exec-leak-body">
                    {leak.description ? <p><strong>Diagnóstico:</strong> {leak.description}</p> : null}
                    {leak.hint && leak.hint !== leak.description ? (
                      <p><strong>Como corrigir:</strong> {leak.hint}</p>
                    ) : null}
                  </div>
                </details>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* ============ SECTION 4 — OPPORTUNITIES ============ */}
        {opportunities.length ? (
          <Section
            num="04"
            eyebrow="Oportunidades de Crescimento"
            title={<>Dinheiro que <span className="accent">já existe</span> dentro da sua conta</>}
            subtitle="Movimentos de baixo risco identificados na operação atual — não dependem de aumento de verba."
            id="oportunidades"
          >
            <div className="exec-opps">
              {opportunities.map((o, idx) => (
                <div key={`${o.title}-${idx}`} className="exec-opp-card">
                  <h3 className="exec-opp-title">{o.title}</h3>
                  <p className="exec-opp-potential">+{o.potential.replace(/^\+/, "")}</p>
                  {o.why ? <p className="exec-opp-body">{o.why}</p> : null}
                  <div className="exec-opp-tags">
                    <span className="exec-opp-tag">Dificuldade · {o.difficulty}</span>
                    {o.eta && o.eta !== "—" ? <span className="exec-opp-tag">Prazo · {o.eta}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {/* ============ SECTION 5 — BENCHMARK ============ */}
        {benchmarks.length ? (
          <Section
            num="05"
            eyebrow="Comparação com o Mercado"
            title={<>Como você se compara <span className="accent">ao seu segmento</span></>}
            subtitle={
              analysis.benchmarkComparison?.nicheLabel
                ? `Referências do segmento ${analysis.benchmarkComparison.nicheLabel}.`
                : "Referências do seu segmento de e-commerce."
            }
            id="benchmark"
          >
            <div className="exec-table-wrap">
              <table className="exec-table">
                <thead>
                  <tr>
                    <th>Métrica</th>
                    <th>Sua conta</th>
                    <th>Mercado</th>
                    <th>Diferença</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.map((b) => {
                    const cls = b.isBad ? "is-bad" : statusToClass(b.status);
                    return (
                      <tr key={b.metric}>
                        <td className="metric-name">{b.metric}</td>
                        <td>{b.current}</td>
                        <td>{b.reference}</td>
                        <td>{b.deltaLabel ?? b.gapNote ?? "—"}</td>
                        <td>
                          <span className={`exec-status-pill ${cls}`}>
                            <span className="pill-dot" />
                            {statusLabel(b.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null}

        {/* ============ SECTION 6 — BOTTLENECK ============ */}
        {topLeak ? (
          <Section
            num="06"
            eyebrow="Principal Gargalo"
            title={<>O que está <span className="accent">travando</span> seu crescimento agora</>}
            subtitle="Análise detalhada do gargalo de maior impacto financeiro."
            id="gargalo"
          >
            <div className="exec-bottleneck">
              <div className="exec-bottleneck-head">
                <div className="exec-bottleneck-tag">Prioridade máxima</div>
                <h3 className="exec-bottleneck-title">{topLeak.title}</h3>
                {topLeak.monthlyBrl > 0 ? (
                  <p className="exec-bottleneck-impact">Impacto: −{fmtBRL(topLeak.monthlyBrl)}/mês</p>
                ) : null}
              </div>
              <div className="exec-bottleneck-grid">
                <div className="exec-bottleneck-cell">
                  <h4>Diagnóstico</h4>
                  <p>{topLeak.description || "Padrão observado nas campanhas de maior volume."}</p>
                </div>
                <div className="exec-bottleneck-cell">
                  <h4>Consequência se ignorar</h4>
                  <p>
                    O leilão da Meta continua escalando esse padrão. Em 90 dias, o custo acumulado é{" "}
                    <strong>{topLeak.monthlyBrl > 0 ? fmtBRL(topLeak.monthlyBrl * 3) : "relevante"}</strong> —
                    e o aprendizado fica preso no histórico das campanhas.
                  </p>
                </div>
                <div className="exec-bottleneck-cell">
                  <h4>Como resolver</h4>
                  <p>{topLeak.hint || "Reestruturar a campanha afetada, validar tracking e isolar o teste antes de escalar verba."}</p>
                </div>
              </div>
            </div>
          </Section>
        ) : null}

        {/* ============ SECTION 7 — BEST OPPORTUNITY ============ */}
        {topOpp ? (
          <Section
            num="07"
            eyebrow="Melhor Oportunidade"
            title={<>O movimento de <span className="accent">maior retorno</span> identificado</>}
            subtitle="Estudo de caso do criativo, campanha ou ajuste estrutural com melhor relação esforço × resultado."
            id="oportunidade"
          >
            <div className="exec-case">
              <div className="exec-case-head">
                <div className="exec-case-tag">Maior retorno esperado</div>
                <h3 className="exec-case-title">{topOpp.title}</h3>
              </div>
              <div className="exec-case-grid">
                <div className="exec-case-cell">
                  <div className="exec-case-label">Situação atual</div>
                  <div className="exec-case-value is-now">{revenueFormatted}</div>
                  <p>Receita mensal observada na conta hoje.</p>
                </div>
                <div className="exec-case-cell">
                  <div className="exec-case-label">Potencial de crescimento</div>
                  <div className="exec-case-value is-target">+{topOpp.potential.replace(/^\+/, "")}</div>
                  <p>{topOpp.why || "Capacidade identificada na operação atual."}</p>
                </div>
                <div className="exec-case-cell">
                  <div className="exec-case-label">Ação recomendada</div>
                  <div className="exec-case-value is-action">{topOpp.how || "Reestruturar alocação e escalar criativo vencedor."}</div>
                  {topOpp.eta && topOpp.eta !== "—" ? <p>Prazo estimado: {topOpp.eta}</p> : null}
                </div>
              </div>
            </div>
          </Section>
        ) : null}

        {/* ============ SECTION 8 — ACTION PLAN ============ */}
        {(roadmap.short.length || roadmap.mid.length || roadmap.long.length) ? (
          <Section
            num="08"
            eyebrow="Plano de Ação"
            title={<>Sequência de execução <span className="accent">recomendada</span></>}
            subtitle="Roadmap em 3 horizontes — quick wins, ajustes estruturais e ganhos de escala."
            id="plano"
          >
            <div className="exec-timeline">
              {[
                { period: "0–7 dias", title: "Quick wins", items: roadmap.short },
                { period: "8–30 dias", title: "Ajustes estruturais", items: roadmap.mid },
                { period: "31–90 dias", title: "Escala e validação", items: roadmap.long },
              ].map((col) => (
                <div key={col.period} className="exec-timeline-col">
                  <div className="exec-timeline-head">
                    <p className="exec-timeline-period">{col.period}</p>
                    <h3 className="exec-timeline-title">{col.title}</h3>
                  </div>
                  {col.items.length ? (
                    <ul className="exec-timeline-actions">
                      {col.items.map((a) => (
                        <li key={`${a.step}-${a.action}`} className="exec-timeline-action">
                          <div className="exec-timeline-action-title">{a.action}</div>
                          <div className="exec-timeline-action-meta">
                            <span className="impact">{a.impact}</span>
                            <span>· {a.eta}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="exec-timeline-empty">Sem ações neste horizonte</div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {/* ============ SECTION 9 — PROJECTION ============ */}
        {(scenarios || giScenarios.length) ? (
          <Section
            num="09"
            eyebrow="Projeção de Crescimento"
            title={<>O que muda <span className="accent">quando o plano roda</span></>}
            subtitle="Cenários projetados com base na recuperação de gargalos e captura das oportunidades identificadas."
            id="projecao"
          >
            <div className="exec-projection">
              <div className="exec-projection-col">
                <div className="exec-projection-label">Hoje</div>
                <div className="exec-projection-value">{revenueFormatted}</div>
                <div className="exec-projection-delta">Receita atual</div>
                <p className="exec-projection-hint">Baseline observado</p>
              </div>
              {scenarios ? (
                <>
                  <div className="exec-projection-col">
                    <div className="exec-projection-label">Conservador</div>
                    <div className="exec-projection-value">{scenarios.conservativeFormatted}</div>
                    <div className="exec-projection-delta">+{scenarios.conservativePct}%</div>
                    <p className="exec-projection-hint">Apenas fechar vazamentos críticos</p>
                  </div>
                  <div className="exec-projection-col is-featured">
                    <div className="exec-projection-label">Provável</div>
                    <div className="exec-projection-value">{scenarios.probableFormatted}</div>
                    <div className="exec-projection-delta">+{scenarios.probablePct}%</div>
                    <p className="exec-projection-hint">Plano completo executado</p>
                  </div>
                  <div className="exec-projection-col">
                    <div className="exec-projection-label">Agressivo</div>
                    <div className="exec-projection-value">{scenarios.aggressiveFormatted}</div>
                    <div className="exec-projection-delta">+{scenarios.aggressivePct}%</div>
                    <p className="exec-projection-hint">Plano + escala validada</p>
                  </div>
                </>
              ) : (
                giScenarios.slice(0, 3).map((s, i) => (
                  <div key={s.key} className={`exec-projection-col ${i === 1 ? "is-featured" : ""}`}>
                    <div className="exec-projection-label">{s.label}</div>
                    <div className="exec-projection-value">{s.revenueUpliftFormatted}</div>
                    <div className="exec-projection-delta">+{s.additionalRevenueFormatted}</div>
                    <p className="exec-projection-hint">{s.estimatedEta}</p>
                  </div>
                ))
              )}
            </div>
            {scenarios?.basisNote || gi?.projections?.disclaimer ? (
              <p className="exec-projection-disclaimer">{scenarios?.basisNote ?? gi?.projections?.disclaimer}</p>
            ) : null}
          </Section>
        ) : null}
      </main>

      {/* CTA Final marker — actual form lives in the route */}
      <div id="exec-cta-anchor" />

      {/* Annual opportunity hint surfaces back into final CTA */}
      {annualOpp > 0 ? <ExecAnnualHint value={annualOpp} /> : null}

      <footer className="exec-footer exec-container">
        {analysis.disclaimer ?? "Análise indicativa baseada nos dados disponíveis na conta. Não representa garantia de resultado."}
      </footer>
    </div>
  );
}

// Tiny invisible component to expose annual estimate via DOM if needed elsewhere.
function ExecAnnualHint({ value }: { value: number }) {
  // Stored as data attribute so the parent form/CTA can read if desired.
  const [v] = useState(value);
  return <span data-exec-annual={v} style={{ display: "none" }} aria-hidden />;
}
