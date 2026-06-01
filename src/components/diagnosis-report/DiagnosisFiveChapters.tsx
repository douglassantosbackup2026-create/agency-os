import { DiagnosisChapterCard } from "./DiagnosisChapterCard";
import { DiagnosisFinancialBalance } from "./DiagnosisFinancialBalance";
import type {
  ChapterNarratives,
  DiagnosticChapter,
  FinancialBalance,
  SeniorDerived,
} from "./types";

type Props = {
  senior: SeniorDerived;
  narratives?: ChapterNarratives;
  financialBalance?: FinancialBalance | null;
};

const ORDER: (keyof SeniorDerived["diagnostics"])[] = [
  "structure",
  "audience",
  "creative",
  "scale",
  "financial",
];

export function DiagnosisFiveChapters({
  senior,
  narratives,
  financialBalance,
}: Props) {
  return (
    <section className="card five-chapters" id="capitulos">
      <h2>Os 5 diagnósticos</h2>
      <p className="section-hint">
        Estrutura, públicos, criativo, escala e financeiro — status e evidência definidos no servidor.
      </p>
      <div className="chapters-stack">
        {ORDER.map((key) => {
          const chapter = senior.diagnostics[key] as DiagnosticChapter;
          const narrative = narratives?.[key];
          const extra =
            key === "financial" && financialBalance ? (
              <div className="chapter-financial-extra">
                <DiagnosisFinancialBalance balance={financialBalance} embedded />
              </div>
            ) : null;
          return (
            <DiagnosisChapterCard
              key={key}
              chapter={chapter}
              narrative={narrative}
            >
              {extra}
            </DiagnosisChapterCard>
          );
        })}
      </div>
    </section>
  );
}
