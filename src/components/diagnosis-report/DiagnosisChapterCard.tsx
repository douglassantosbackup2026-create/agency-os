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
    <article className={`chapter-card status-${chapter.status}`}>
      <header className="chapter-card-head">
        <h3>{chapter.title}</h3>
        <span className={`chapter-status-badge status-${chapter.status}`}>
          {STATUS_LABEL[chapter.status]}
        </span>
      </header>
      <p className="chapter-headline">{chapter.headline}</p>
      {narrative ? <p className="chapter-narrative">{narrative}</p> : null}
      <p className="muted chapter-evidence">{chapter.evidence}</p>
      {chapter.impactNote ? (
        <p className="chapter-impact">{chapter.impactNote}</p>
      ) : null}
      {children}
    </article>
  );
}
