import type { ExecutiveConclusion } from "../types";

type Props = {
  conclusion: ExecutiveConclusion;
};

function fmtBrl(n: number | null): string {
  if (n == null || n <= 0) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

const domainLabel: Record<ExecutiveConclusion["primaryProblemDomain"], string> = {
  meta: "Meta Ads (campanhas e entrega)",
  structure: "Site / checkout / estrutura fora do Meta",
  mixed: "Meta + estrutura (ação combinada)",
};

const scaleLabel: Record<ExecutiveConclusion["scaleNow"], string> = {
  yes: "Sim — condições favoráveis para escalar com controle",
  no: "Não — corrigir vazamentos antes de aumentar verba",
  conditional: "Condicional — escalar só após corrigir o principal gargalo",
};

export function DiagnosisExecutiveConclusion({ conclusion }: Props) {
  return (
    <section className="card presentation-exec-conclusion" id="sec-conclusao">
      <p className="presentation-section-eyebrow">10 · Conclusão</p>
      <h2 className="premium-section-title">Conclusão executiva</h2>
      <dl className="exec-conclusion-grid">
        <div>
          <dt>Conta saudável?</dt>
          <dd>{conclusion.isHealthy ? "Sim, com ressalvas pontuais" : "Não — há dinheiro na mesa"}</dd>
        </div>
        <div>
          <dt>Problema principal</dt>
          <dd>{domainLabel[conclusion.primaryProblemDomain]}</dd>
        </div>
        <div>
          <dt>Dinheiro perdido (indicativo/mês)</dt>
          <dd>{fmtBrl(conclusion.moneyLostMonthlyBrl)}</dd>
        </div>
        <div>
          <dt>Recuperável (indicativo/mês)</dt>
          <dd>{fmtBrl(conclusion.recoverableMonthlyBrl)}</dd>
        </div>
        <div>
          <dt>Potencial adicional (indicativo/mês)</dt>
          <dd>{fmtBrl(conclusion.generatableMonthlyBrl)}</dd>
        </div>
        <div>
          <dt>Vale escalar agora?</dt>
          <dd>{scaleLabel[conclusion.scaleNow]}</dd>
        </div>
      </dl>
      <blockquote className="exec-first-decision">
        <strong>Se eu assumisse esta conta amanhã:</strong>{" "}
        {conclusion.firstDecisionIfIHired}
      </blockquote>
    </section>
  );
}
