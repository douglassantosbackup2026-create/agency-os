import { memo } from "react";
import { Eye } from "lucide-react";
import {
  ANCHOR_PREVIEW,
  reportPreviewSection,
} from "@/content/diagnosis-landing";
import {
  LANDING_SECTION_SCROLL,
  landingEyebrowClass,
} from "@/lib/landing-ui";
import { DiagnosisCta } from "./diagnosis-cta";
import { LandingReportPreviewMock } from "./landing-report-mock";
import { PriceDisplay } from "./price-display";

type Props = {
  onCheckout: () => void;
  loading: boolean;
};

function DiagnosisReportPreviewInner({ onCheckout, loading }: Props) {
  return (
    <section
      id={ANCHOR_PREVIEW}
      className={`py-16 md:py-24 ${LANDING_SECTION_SCROLL}`}
    >
      <div className="mx-auto max-w-4xl">
        <span className={landingEyebrowClass}>
          <Eye className="h-3.5 w-3.5" aria-hidden />
          {reportPreviewSection.eyebrow}
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          {reportPreviewSection.title}
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {reportPreviewSection.intro}
        </p>

        <div className="mt-8">
          <LandingReportPreviewMock />
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="max-w-lg text-sm text-muted-foreground">
            {reportPreviewSection.footerNote}
          </p>
          <DiagnosisCta
            size="large"
            label={`ANALISAR MINHA CONTA — ${PRICE_DISPLAY_TEXT.toUpperCase()}`}
            sublabel={reportPreviewSection.ctaSublabel}
            loading={loading}
            onClick={onCheckout}
          />
        </div>
      </div>
    </section>
  );
}

export const DiagnosisReportPreview = memo(DiagnosisReportPreviewInner);
