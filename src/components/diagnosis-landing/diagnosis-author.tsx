import { Award, CheckCircle2 } from "lucide-react";
import { ANCHOR_AUTOR, authorSection } from "@/content/diagnosis-landing";
import {
  LANDING_SECTION_SCROLL,
  landingEyebrowClass,
  landingSurfaceCardClass,
} from "@/lib/landing-ui";

const authorStats = [
  { value: "R$30M+", label: "Gerenciados" },
  { value: "5 anos", label: "Experiência" },
  { value: "Ex-Ogilvy", label: "Background" },
];

export function DiagnosisAuthor() {
  return (
    <section
      id={ANCHOR_AUTOR}
      className={`py-16 md:py-20 ${LANDING_SECTION_SCROLL}`}
    >
      <div className="mx-auto max-w-3xl">
        <span className={landingEyebrowClass}>
          <Award className="h-3.5 w-3.5" aria-hidden />
          Quem faz
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          {authorSection.title}
        </h2>
        <div
          className={`mt-8 flex flex-col gap-6 p-6 sm:flex-row sm:items-start md:p-8 ${landingSurfaceCardClass}`}
        >
          <div
            className="mx-auto flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-2xl font-bold text-primary-foreground ring-4 ring-primary/15 ring-offset-2 sm:mx-0"
            aria-hidden
          >
            DS
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xl font-bold">{authorSection.name}</p>
            <p className="mt-1 text-sm font-medium text-primary">
              {authorSection.role}
            </p>
            <div className="mt-4 flex justify-center gap-6 sm:justify-start">
              {authorStats.map((stat) => (
                <div key={stat.label} className="text-center sm:text-left">
                  <p className="text-lg font-bold text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
            <ul className="mt-5 space-y-1.5 text-sm text-muted-foreground">
              {authorSection.credentials.map((c) => (
                <li key={c} className="flex items-start gap-2 text-left">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                    aria-hidden
                  />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-8 space-y-4 leading-relaxed text-muted-foreground">
          {authorSection.paragraphs.map((p) => (
            <p key={p.slice(0, 36)}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
