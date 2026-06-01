type Props = {
  onCtaClick?: () => void;
  ctaLabel?: string;
  eligible?: boolean;
};

export function DiagnosisInlineCtaBanner({
  onCtaClick,
  ctaLabel = "Agendar reunião gratuita",
  eligible = true,
}: Props) {
  if (!eligible) return null;
  return (
    <div className="premium-cta-banner no-print">
      <div>
        <strong style={{ display: "block", marginBottom: "0.2rem" }}>
          Quer ajuda para implementar?
        </strong>
        <span className="muted" style={{ fontSize: "0.88rem" }}>
          Converse com a equipe sobre os próximos passos do plano.
        </span>
      </div>
      {onCtaClick ? (
        <button type="button" className="btn btn-primary" onClick={onCtaClick}>
          {ctaLabel}
        </button>
      ) : (
        <a className="btn btn-primary" href="#sec-cta">
          {ctaLabel}
        </a>
      )}
    </div>
  );
}
