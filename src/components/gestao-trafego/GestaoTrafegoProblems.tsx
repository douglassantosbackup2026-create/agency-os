import { LANDING_SECTION_SCROLL } from "@/lib/landing-ui";
import { problemsSection } from "@/content/gestao-trafego";

export function GestaoTrafegoProblems() {
  return (
    <section
      className={`${LANDING_SECTION_SCROLL} border-t border-border/60 bg-foreground py-16 text-background sm:py-20`}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full border border-background/20 bg-background/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-background/70">
            {problemsSection.eyebrow}
          </span>
          <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {problemsSection.title}
          </h2>
          <p className="mt-3 text-base text-background/70">
            {problemsSection.subtitle}
          </p>
        </div>

        <ol className="mt-12 divide-y divide-background/10 border-y border-background/10">
          {problemsSection.items.map((item, i) => (
            <li
              key={item}
              className="flex items-start gap-6 py-6 sm:items-center sm:py-7"
            >
              <span className="font-mono text-2xl font-bold tabular-nums text-success sm:text-3xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-base leading-snug sm:text-lg">{item}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
