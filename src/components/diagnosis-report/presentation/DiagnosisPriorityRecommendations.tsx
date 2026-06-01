import type { MetaRecommendationRow } from "../types";

type Props = {
  items: MetaRecommendationRow[];
};

function priorityClass(p: string): string {
  if (p === "urgent") return "severity-critical";
  if (p === "high") return "severity-high";
  return "severity-medium";
}

export function DiagnosisPriorityRecommendations({ items }: Props) {
  if (!items.length) return null;

  return (
    <section className="card presentation-layout-section" id="sec-recos">
      <p className="presentation-section-eyebrow">04 · Recomendações</p>
      <h2 className="premium-section-title">Ações prioritárias de estrutura</h2>
      <p className="premium-section-hint muted">
        API Meta quando disponível; caso contrário, heurísticas do servidor (rotuladas).
      </p>
      <div className="meta-reco-list">
        {items.map((r) => (
          <article key={r.id} className="meta-reco-card">
            <div className="meta-reco-head">
              <span className={`severity-pill ${priorityClass(r.priority)}`}>
                {r.priority === "urgent"
                  ? "Urgente"
                  : r.priority === "high"
                    ? "Alta"
                    : "Média"}
              </span>
              <span className="muted" style={{ fontSize: "0.72rem" }}>
                Impacto {r.impactPoints}/10 ·{" "}
                {r.source === "api" ? "Meta API" : "Heurística"}
              </span>
            </div>
            <h3 style={{ fontSize: "0.95rem", margin: "0.5rem 0 0.25rem" }}>{r.title}</h3>
            <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
              {r.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
