import type { RoadmapBuckets } from "@/lib/diagnosis-roadmap";
import type { GrowthScenarios } from "../types";

type Props = {
  roadmap: RoadmapBuckets;
  growth?: GrowthScenarios | null;
};

const PHASES = [
  { key: "short" as const, title: "0–30 dias", subtitle: "Ajustes", className: "phase-short" },
  { key: "mid" as const, title: "31–60 dias", subtitle: "Otimização", className: "phase-mid" },
  { key: "long" as const, title: "61–90 dias", subtitle: "Escala", className: "phase-long" },
];

export function DiagnosisRoadmapTimeline({ roadmap, growth }: Props) {
  const hasAny =
    roadmap.short.length || roadmap.mid.length || roadmap.long.length;
  if (!hasAny) return null;

  const impactNote = growth?.probableFormatted
    ? `Impacto indicativo no cenário provável: ${growth.probableFormatted}`
    : null;

  return (
    <section className="card presentation-layout-section" id="sec-roadmap">
      <p className="presentation-section-eyebrow">05 · Plano 90 dias</p>
      <h2 className="premium-section-title">Plano de ação recomendado</h2>
      <p className="premium-section-hint muted">
        Roadmap 90 dias com base no plano priorizado.
      </p>
      <div className="premium-roadmap-grid">
        {PHASES.map((phase) => (
          <div
            key={phase.key}
            className={`premium-roadmap-col ${phase.className}`}
          >
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>{phase.title}</strong>
              <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>
                {phase.subtitle}
              </span>
            </div>
            <ul style={{ paddingLeft: "1.1rem", margin: 0, fontSize: "0.88rem" }}>
              {roadmap[phase.key].slice(0, 6).map((a) => (
                <li key={`${phase.key}-${a.step}`} style={{ marginBottom: "0.4rem" }}>
                  <strong>#{a.step}</strong> {a.action}
                  <span className="muted"> · {a.eta}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {impactNote ? (
        <p className="muted" style={{ fontSize: "0.85rem", marginTop: "1rem", marginBottom: 0 }}>
          {impactNote}
        </p>
      ) : null}
    </section>
  );
}
