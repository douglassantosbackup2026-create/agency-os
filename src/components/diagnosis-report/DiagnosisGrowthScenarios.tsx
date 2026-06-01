import type { GrowthScenarios } from "./types";

type Props = {
  scenarios: GrowthScenarios;
};

export function DiagnosisGrowthScenarios({ scenarios }: Props) {
  return (
    <section className="card growth-scenarios" id="crescimento">
      <h2>Oportunidades de crescimento</h2>
      <p className="section-hint growth-disclaimer">{scenarios.basisNote}</p>
      <div className="growth-scenario-grid">
        <div className="growth-scenario-cell">
          <span className="growth-scenario-tag">Conservador</span>
          <span className="growth-scenario-pct">{scenarios.conservativeFormatted}</span>
        </div>
        <div className="growth-scenario-cell growth-scenario-probable">
          <span className="growth-scenario-tag">Provável</span>
          <span className="growth-scenario-pct">{scenarios.probableFormatted}</span>
        </div>
        <div className="growth-scenario-cell">
          <span className="growth-scenario-tag">Agressivo</span>
          <span className="growth-scenario-pct">{scenarios.aggressiveFormatted}</span>
        </div>
      </div>
      <p className="muted growth-confidence">
        Confiança do cenário:{" "}
        {scenarios.confidence === "medium" ? "média" : "baixa"} (indicativo, não garantia).
      </p>
    </section>
  );
}
