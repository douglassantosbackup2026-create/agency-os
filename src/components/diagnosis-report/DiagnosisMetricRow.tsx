import { TrendingDown, TrendingUp } from "lucide-react";
import type { BenchmarkGap } from "./types";

type Props = {
  gap: BenchmarkGap;
};

export function DiagnosisMetricRow({ gap }: Props) {
  const bad = gap.isBad ?? gap.status === "below";
  const DeltaIcon = bad ? TrendingDown : TrendingUp;
  return (
    <div className={`metric-row ${bad ? "is-bad" : "is-good"}`}>
      <div className="metric-row-main">
        <span className="metric-row-name">{gap.metric}</span>
        <span className="metric-row-values">
          <strong>{gap.current}</strong>
          <span className="muted"> vs {gap.reference}</span>
        </span>
      </div>
      {gap.deltaLabel && gap.deltaLabel !== "—" ? (
        <span className={`metric-row-delta ${bad ? "is-bad" : ""}`}>
          <DeltaIcon className="metric-row-delta-icon" aria-hidden />
          {gap.deltaLabel}
        </span>
      ) : null}
    </div>
  );
}
