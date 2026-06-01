import type { ReactNode } from "react";
import type { DiagnosticChapter } from "./types";

const STATUS_LABEL: Record<DiagnosticChapter["status"], string> = {
  good: "Saudável",
  warning: "Atenção",
  critical: "Crítico",
  info: "Informativo",
  na: "Sem dados",
};

type Props = {
  chapter: DiagnosticChapter;
  narrative?: string | null;
  children?: ReactNode;
};

export function DiagnosisChapterCard({ chapter, narrative, children }: Props) {
  return (
    <details className={`chapter-card chapter-collapsible status-${chapter.status}`} open>
      <summary className="chapter-card-head">
        <h3>{chapter.title}</h3>
        <span className={`chapter-status-badge status-${chapter.status}`}>
          {STATUS_LABEL[chapter.status]}
        </span>
      </summary>
      <div className="chapter-card-body">
        <p className="chapter-headline">{chapter.headline}</p>
        {narrative ? <p className="chapter-narrative">{narrative}</p> : null}
        <p className="muted chapter-evidence">{chapter.evidence}</p>
        {chapter.impactNote ? (
          <p className="chapter-impact">{chapter.impactNote}</p>
        ) : null}
        {children}
      </div>
    </details>
  );
}
