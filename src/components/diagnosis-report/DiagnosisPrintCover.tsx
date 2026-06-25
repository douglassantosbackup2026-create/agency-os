type Props = {
  score: number;
  scoreLabel: string;
  accountLabel?: string;
  maturityLevel?: number;
  maturityLabel?: string;
  leakTotalFormatted?: string;
};

export function DiagnosisPrintCover({
  score,
  scoreLabel,
  accountLabel,
  maturityLevel,
  maturityLabel,
  leakTotalFormatted,
}: Props) {
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <div className="print-cover" aria-hidden>
      <div className="print-cover-inner">
        <p className="print-cover-brand">Agency Opus · Performance Marketing</p>
        <h1 className="print-cover-title">Diagnóstico Meta Ads</h1>
        <p className="print-cover-period">Período analisado: últimos 30 dias</p>
        {accountLabel ? (
          <p className="print-cover-account">{accountLabel}</p>
        ) : null}
        {maturityLevel != null ? (
          <p className="print-cover-maturity">
            Maturidade Meta: <strong>{maturityLevel}/5</strong>
            {maturityLabel ? ` · ${maturityLabel}` : ""}
          </p>
        ) : null}
        {leakTotalFormatted ? (
          <p className="print-cover-leak">
            Vazamento estimado por eixo: <strong>{leakTotalFormatted}/mês</strong>
          </p>
        ) : null}
        <div className="print-cover-score">
          <span className="print-cover-score-num">{score}</span>
          <span className="print-cover-score-denom">/100</span>
        </div>
        <p className="print-cover-score-label">{scoreLabel}</p>
        <p className="print-cover-date">{dateStr}</p>
        <p className="print-cover-disclaimer">
          Relatório indicativo com base nos dados disponíveis na Meta no momento
          da análise. Não constitui promessa de resultado financeiro.
        </p>
      </div>
    </div>
  );
}
