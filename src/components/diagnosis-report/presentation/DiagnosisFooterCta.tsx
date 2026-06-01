import { DiagnosisAuthoritySection } from "../DiagnosisAuthoritySection";

type Props = {
  onPrimaryCta?: () => void;
  primaryLabel?: string;
  whatsappHref?: string;
};

export function DiagnosisFooterCta({
  onPrimaryCta,
  primaryLabel = "Ver próximo passo",
  whatsappHref,
}: Props) {
  return (
    <div className="premium-footer-cta presentation-layout-section no-print" id="sec-footer-cta">
      <DiagnosisAuthoritySection />
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          justifyContent: "center",
          flexWrap: "wrap",
          marginTop: "1rem",
        }}
      >
        {onPrimaryCta ? (
          <button type="button" className="btn btn-primary" onClick={onPrimaryCta}>
            {primaryLabel}
          </button>
        ) : (
          <a className="btn btn-primary" href="#sec-cta">
            {primaryLabel}
          </a>
        )}
        {whatsappHref ? (
          <a
            className="btn btn-outline"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}
