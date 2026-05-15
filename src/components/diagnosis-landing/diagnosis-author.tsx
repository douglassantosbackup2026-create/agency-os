import { ANCHOR_AUTOR, authorSection } from "@/content/diagnosis-landing";
import {
  LANDING_SECTION_SCROLL,
  landingSurfaceCardClass,
} from "@/lib/landing-ui";

export function DiagnosisAuthor() {
  return (
    <section
      id={ANCHOR_AUTOR}
      className={`py-16 md:py-20 ${LANDING_SECTION_SCROLL}`}
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {authorSection.title}
        </h2>
        <div
          className={`mt-8 flex flex-col gap-6 p-6 sm:flex-row sm:items-start md:p-8 ${landingSurfaceCardClass}`}
        >
          <div className="mx-auto flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-primary/15 text-2xl font-bold text-primary sm:mx-0" aria-hidden>
            DS
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xl font-bold">{authorSection.name}</p>
            <p className="mt-1 text-sm font-medium text-primary">
              {authorSection.role}
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              {authorSection.credentials.map((c) => (
                <li key={c}>• {c}</li>
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
