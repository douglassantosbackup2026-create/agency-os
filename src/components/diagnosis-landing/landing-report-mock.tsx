import { memo } from "react";
import { reportPreviewDemo } from "@/content/diagnosis-landing";
import "@/styles/landing-report-mock.css";

const demo = reportPreviewDemo;

function ScoreRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="lrm-score-ring" aria-hidden>
      <svg viewBox="0 0 88 88">
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          strokeWidth="5"
          className="lrm-score-ring-track"
        />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="lrm-score-ring-bar"
        />
      </svg>
      <div className="lrm-score-inner">
        <div className="lrm-score-value">{Math.round(pct)}</div>
        <div className="lrm-score-label">/100</div>
      </div>
    </div>
  );
}

function MockTopbar() {
  return (
    <div className="lrm-topbar">
      <div className="lrm-brand">
        <span className="lrm-brand-dot" />
        Agency Opus · Diagnóstico
      </div>
      <span className="lrm-badge-demo">Demo anonimizada</span>
    </div>
  );
}

function MockStats({ fourCol = false }: { fourCol?: boolean }) {
  const { invested, revenue, potential, gap } = demo.stats;
  const items = [invested, revenue, potential, gap];

  return (
    <div className={`lrm-stats ${fourCol ? "lrm-stats--4" : ""}`}>
      {items.map((s) => (
        <div key={s.label} className="lrm-stat">
          <div className="lrm-stat-label">{s.label}</div>
          <div
            className={[
              "lrm-stat-value",
              "positive" in s && s.positive ? "is-positive" : "",
              "accent" in s && s.accent ? "is-accent" : "",
              "negative" in s && s.negative ? "is-negative" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {s.value}
          </div>
          <p className="lrm-stat-hint">{s.hint}</p>
        </div>
      ))}
    </div>
  );
}

function MockInsightPair() {
  return (
    <div className="lrm-pair">
      <div className="lrm-insight is-pain">
        <div className="lrm-insight-label">Maior gargalo</div>
        <h4 className="lrm-insight-title">{demo.topLeak.title}</h4>
        <div className="lrm-insight-impact">{demo.topLeak.impact}</div>
        <p className="lrm-insight-body">{demo.topLeak.body}</p>
      </div>
      <div className="lrm-insight is-gain">
        <div className="lrm-insight-label">Maior oportunidade</div>
        <h4 className="lrm-insight-title">{demo.topOpp.title}</h4>
        <div className="lrm-insight-impact">{demo.topOpp.impact}</div>
        <p className="lrm-insight-body">{demo.topOpp.body}</p>
      </div>
    </div>
  );
}

function MockScorePillars() {
  return (
    <div className="lrm-score-row">
      <ScoreRing value={demo.score} />
      <div className="lrm-pillars">
        <p className="lrm-section-title" style={{ marginBottom: 4 }}>
          Onde sua operação está · {demo.scoreLabel}
        </p>
        {demo.pillars.map((p) => (
          <div key={p.label} className="lrm-pillar">
            <span className="lrm-pillar-label">{p.label}</span>
            <div className="lrm-pillar-bar">
              <div
                className="lrm-pillar-fill"
                style={{ width: `${p.score}%` }}
              />
            </div>
            <span className="lrm-pillar-score">{p.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockLeaks() {
  return (
    <div>
      <p className="lrm-section-title">Quanto dinheiro está ficando na mesa</p>
      <div className="lrm-leak-total">
        <span className="lrm-leak-total-label">Vazamento estimado / mês</span>
        <span className="lrm-leak-total-value">{demo.totalLeakFormatted}</span>
      </div>
      <ul className="lrm-leak-list">
        {demo.leaks.map((leak) => (
          <li key={leak.title} className="lrm-leak-item">
            <div>
              <p className="lrm-leak-item-title">{leak.title}</p>
              <div className="lrm-leak-item-meta">
                <span
                  className={`lrm-prio ${leak.priority === "Alta" ? "is-high" : "is-med"}`}
                >
                  {leak.priority}
                </span>
              </div>
            </div>
            <span className="lrm-leak-impact">{leak.impact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MockBenchmark() {
  return (
    <div>
      <p className="lrm-section-title">Benchmark do seu segmento</p>
      <p className="lrm-bench-niche">{demo.benchmarkNiche}</p>
      <div
        style={{
          borderRadius: 10,
          border: "1px solid var(--lrm-border)",
          overflow: "hidden",
        }}
      >
        <table className="lrm-bench-table">
          <thead>
            <tr>
              <th>Métrica</th>
              <th>Sua conta</th>
              <th>Mercado</th>
              <th>Top 10%</th>
              <th>Gap</th>
            </tr>
          </thead>
          <tbody>
            {demo.benchmarks.map((row) => (
              <tr key={row.metric}>
                <td className="lrm-bench-metric">{row.metric}</td>
                <td>{row.yours}</td>
                <td>{row.market}</td>
                <td>{row.top10}</td>
                <td
                  className={`lrm-bench-delta ${row.bad ? "is-bad" : "is-good"}`}
                >
                  {row.delta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MockProjection() {
  return (
    <div>
      <p className="lrm-section-title">O que muda quando o plano roda</p>
      <div className="lrm-projection">
        <div className="lrm-projection-col">
          <div className="lrm-projection-col-label">Hoje</div>
          {demo.projection.before.map((m) => (
            <div key={m.label} className="lrm-projection-metric">
              <span>{m.label}</span>
              <span>{m.value}</span>
            </div>
          ))}
        </div>
        <div className="lrm-projection-arrow" aria-hidden>
          →
        </div>
        <div className="lrm-projection-col is-after">
          <div className="lrm-projection-col-label">Com o plano (30–45 dias)</div>
          {demo.projection.after.map((m) => (
            <div key={m.label} className="lrm-projection-metric">
              <span>{m.label}</span>
              <span>{m.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Recorte compacto para o hero da landing. */
function LandingReportHeroMockInner() {
  return (
    <div className="lrm-root lrm-compact shadow-2xl ring-1 ring-primary/20">
      <MockTopbar />
      <div className="lrm-body lrm-fade-bottom">
        <div className="lrm-tag">
          <span>●</span> Análise concluída · {demo.score}/100
        </div>
        <h3 className="lrm-headline">
          Identificamos{" "}
          <span className="accent">{demo.heroOpportunityRange}</span>
          /mês em oportunidade não capturada.
        </h3>
        <p className="lrm-sub">{demo.mockHeroSub}</p>
        <MockStats />
        <MockInsightPair />
      </div>
    </div>
  );
}

/** Blocos completos para a seção preview-relatório. */
function LandingReportPreviewMockInner() {
  return (
    <div className="lrm-root shadow-xl ring-1 ring-primary/15">
      <MockTopbar />
      <div className="lrm-body space-y-5">
        <div>
          <div className="lrm-tag">
            <span>●</span> Análise concluída · {demo.score}/100
          </div>
          <h3 className="lrm-headline">
            Identificamos{" "}
            <span className="accent">{demo.heroOpportunityRange}</span>
            /mês em oportunidade não capturada.
          </h3>
          <MockStats fourCol />
          <MockInsightPair />
        </div>

        <MockScorePillars />
        <MockLeaks />
        <MockBenchmark />

        <div className="relative overflow-hidden rounded-xl">
          <div className="pointer-events-none select-none blur-[3px] opacity-80">
            <MockProjection />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--lrm-bg)] via-[var(--lrm-bg)]/80 to-transparent" />
        </div>
      </div>
    </div>
  );
}

/** Roadmap em 3 fases (como funciona). */
function LandingReportRoadmapMockInner() {
  return (
    <div className="lrm-root">
      <div className="lrm-body">
        <div className="lrm-roadmap">
          {demo.roadmapPhases.map((phase) => (
            <div key={phase.phase} className="lrm-roadmap-phase">
              <div className="lrm-roadmap-phase-num">{phase.phase}</div>
              <h4 className="lrm-roadmap-phase-title">{phase.title}</h4>
              <p className="lrm-roadmap-phase-eta">{phase.eta}</p>
              <ul className="lrm-roadmap-list">
                {phase.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const LandingReportHeroMock = memo(LandingReportHeroMockInner);
export const LandingReportPreviewMock = memo(LandingReportPreviewMockInner);
export const LandingReportRoadmapMock = memo(LandingReportRoadmapMockInner);
