import { useMemo, useState } from "react";
import { DiagnosisIssueCard } from "../DiagnosisIssueCard";
import type { DiagnosisAnalysis, SeniorDerived } from "../types";

type Props = {
  issues: NonNullable<DiagnosisAnalysis["criticalIssues"]>;
  senior: SeniorDerived | null;
  priorityBadge: (priority: string) => string;
  axisLabelPt: (axis: string) => string;
};

type ProblemRow = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  issueIndex?: number;
};

function priorityToSeverity(priority: string): ProblemRow["severity"] {
  const p = (priority ?? "").toLowerCase();
  if (/(alta|high|crítica|critica|urgente)/.test(p)) return "critical";
  if (/(média|media|medium)/.test(p)) return "medium";
  return "low";
}

function chapterSeverity(status: string): ProblemRow["severity"] {
  if (status === "critical") return "critical";
  if (status === "warning") return "high";
  if (status === "good") return "low";
  return "medium";
}

export function DiagnosisProblemsMasterDetail({
  issues,
  senior,
  priorityBadge,
  axisLabelPt,
}: Props) {
  const rows = useMemo(() => {
    const list: ProblemRow[] = issues.map((issue, i) => ({
      id: `issue-${i}`,
      title: issue.title,
      severity: priorityToSeverity(issue.priority),
      issueIndex: i,
    }));
    if (senior?.diagnostics) {
      const chapters = [
        { key: "structure", label: "Estrutura" },
        { key: "audience", label: "Públicos" },
        { key: "creative", label: "Criativos" },
        { key: "scale", label: "Escala" },
        { key: "financial", label: "Financeiro" },
      ] as const;
      for (const ch of chapters) {
        const d = senior.diagnostics[ch.key];
        if (d && d.status !== "good" && d.status !== "na") {
          if (!list.some((r) => r.title === d.title)) {
            list.push({
              id: `chapter-${ch.key}`,
              title: `${ch.label}: ${d.headline.slice(0, 60)}`,
              severity: chapterSeverity(d.status),
            });
          }
        }
      }
    }
    return list;
  }, [issues, senior]);

  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");

  const selectedIssue =
    rows.find((r) => r.id === selectedId && r.issueIndex != null)?.issueIndex != null
      ? issues[rows.find((r) => r.id === selectedId)!.issueIndex!]
      : issues[0];

  const selectedChapter =
    senior && selectedId.startsWith("chapter-")
      ? senior.diagnostics[selectedId.replace("chapter-", "") as keyof SeniorDerived["diagnostics"]]
      : null;

  if (!rows.length && !issues.length) return null;

  return (
    <section className="card presentation-layout-section" id="sec-issues">
      <p className="presentation-section-eyebrow">02 · Diagnóstico</p>
      <h2 className="premium-section-title">Principais problemas encontrados</h2>
      <p className="premium-section-hint">
        Selecione um item para ver detalhes, hipótese e evidências (v13).
      </p>
      <div className="premium-problems-layout">
        <ul className="premium-problem-list" role="tablist">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                role="tab"
                aria-selected={selectedId === row.id}
                onClick={() => setSelectedId(row.id)}
              >
                <span className={`severity-pill severity-${row.severity === "critical" ? "critical" : row.severity === "high" ? "high" : row.severity === "medium" ? "medium" : "low"}`}>
                  {row.severity === "critical"
                    ? "CRÍTICO"
                    : row.severity === "high"
                      ? "ALTO"
                      : row.severity === "medium"
                        ? "MÉDIO"
                        : "BAIXO"}
                </span>
                <span style={{ display: "block", marginTop: "0.35rem", fontSize: "0.88rem" }}>
                  {row.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="premium-problem-detail" role="tabpanel">
          {selectedIssue && rows.find((r) => r.id === selectedId)?.issueIndex != null ? (
            <DiagnosisIssueCard
              issue={selectedIssue}
              priorityBadge={priorityBadge}
              axisLabelPt={axisLabelPt}
            />
          ) : selectedChapter ? (
            <>
              <h3 style={{ marginTop: 0 }}>{selectedChapter.title}</h3>
              <p>{selectedChapter.headline}</p>
              <p className="muted">{selectedChapter.evidence}</p>
              {selectedChapter.impactNote ? (
                <p className="muted">{selectedChapter.impactNote}</p>
              ) : null}
            </>
          ) : selectedIssue ? (
            <DiagnosisIssueCard
              issue={selectedIssue}
              priorityBadge={priorityBadge}
              axisLabelPt={axisLabelPt}
            />
          ) : (
            <p className="muted">Selecione um problema na lista.</p>
          )}
        </div>
      </div>
    </section>
  );
}
