import { createFileRoute } from "@tanstack/react-router";
import {
  DiagnosisAuthor,
  DiagnosisFaq,
  DiagnosisFinalCta,
  DiagnosisFooter,
  DiagnosisGuarantee,
  DiagnosisHero,
  DiagnosisHowItWorks,
  DiagnosisLandingHeader,
  DiagnosisQualification,
  DiagnosisReportPreview,
  DiagnosisSocialProof,
  DiagnosisStickyCta,
  DiagnosisWhatIs,
  DiagnosisWhatItDoes,
} from "@/components/diagnosis-landing";
import { diagnosisFaqJsonLd, seoDefaults } from "@/content/diagnosis-landing";
import { useDiagnosisCheckout } from "@/hooks/use-diagnosis-checkout";

export const Route = createFileRoute("/")({
  component: DiagnosisHomePage,
  head: () => ({
    meta: [
      { title: seoDefaults.title },
      { name: "description", content: seoDefaults.description },
      { property: "og:title", content: seoDefaults.title },
      { property: "og:description", content: seoDefaults.description },
      { property: "og:type", content: "website" },
    ],
  }),
});

function DiagnosisHomePage() {
  const { checkout, loading, error } = useDiagnosisCheckout();

  const onCheckout = () => {
    void checkout();
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(diagnosisFaqJsonLd()),
        }}
      />
      <div className="min-h-screen bg-background text-foreground">
        <DiagnosisLandingHeader onCtaClick={onCheckout} />
        <main className="relative pb-28 sm:pb-0">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="grid-bg absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black_38%,transparent_75%)] dark:opacity-35" />
            <div className="absolute -top-40 left-1/2 h-[22rem] w-[min(100%,48rem)] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl dark:bg-primary/[0.12]" />
            <div className="absolute left-[10%] top-[40%] h-[20rem] w-[32rem] rounded-full bg-primary/[0.04] blur-3xl dark:bg-primary/[0.06]" />
          </div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <DiagnosisHero
              onCheckout={onCheckout}
              loading={loading}
              error={error}
            />
            <DiagnosisWhatIs />
            <DiagnosisQualification />
            <DiagnosisWhatItDoes />
            <DiagnosisHowItWorks />
            <DiagnosisReportPreview onCheckout={onCheckout} loading={loading} />
            <DiagnosisAuthor />
            <DiagnosisSocialProof />
            <DiagnosisGuarantee />
            <DiagnosisFaq />
            <DiagnosisFinalCta
              onCheckout={onCheckout}
              loading={loading}
              error={error}
            />
          </div>
        </main>
        <DiagnosisFooter />
        <DiagnosisStickyCta onCheckout={onCheckout} loading={loading} />
      </div>
    </>
  );
}
