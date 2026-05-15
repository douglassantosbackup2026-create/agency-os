import {
  diagnosisContactEmail,
  diagnosisWhatsAppUrl,
  footerSection,
} from "@/content/diagnosis-landing";

export function DiagnosisFooter() {
  const email = diagnosisContactEmail();
  const whatsapp = diagnosisWhatsAppUrl();

  return (
    <footer className="border-t border-border/60 py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
        <div className="mb-8 h-px w-full bg-gradient-to-r from-transparent via-border/80 to-transparent" />
        <p className="font-bold">{footerSection.signature}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {footerSection.tagline}
        </p>
        <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
          {email ? (
            <a
              href={`mailto:${email}`}
              className="transition-colors hover:text-foreground hover:underline"
            >
              {email}
            </a>
          ) : null}
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground hover:underline"
            >
              WhatsApp
            </a>
          ) : null}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          {footerSection.copyright}
        </p>
      </div>
    </footer>
  );
}
