import type { BenchmarkGap } from "./types";
import { DiagnosisMetricRow } from "./DiagnosisMetricRow";

type Props = {
  nicheLabel: string;
  gaps: BenchmarkGap[];
};

export function DiagnosisBenchmarkMetrics({ nicheLabel, gaps }: Props) {
  if (!gaps.length) return null;
  return (
    <section className="card benchmark-v10" id="benchmark">
      <h2>Como você está vs. o mercado</h2>
      <p className="section-hint">
        Referência indicativa: <strong>{nicheLabel}</strong>. Não é garantia de
        resultado — serve para contextualizar urgência.
      </p>
      <div className="metric-rows">
        {gaps.map((g) => (
          <DiagnosisMetricRow key={g.metric} gap={g} />
        ))}
      </div>
    </section>
  );
}
