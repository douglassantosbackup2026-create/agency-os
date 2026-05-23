import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  CheckCircle2,
  Heart,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Sparkles,
  Sunrise,
  TrendingDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ANCHOR_BRIEFING,
  ANCHOR_DEMO,
  authoritySection,
  beforeAfterSection,
  briefingMechanism,
  coldAudience,
  costOfInefficiency,
  demoSection,
  faqConversion,
  featureCards,
  finalCta,
  hero,
  landingFaqJsonLd,
  landingHeroScreenshot,
  miniComparison,
  objectionsSection,
  painSection,
  pivotSection,
  pricingSection,
  solutionSection,
  testimonialPlaceholder,
  type FeatureCardSlug,
} from "@/content/retentio-landing";
import {
  LANDING_SECTION_SCROLL as SECTION_SCROLL,
  landingNavAnchorClass as navAnchorClass,
  landingPrimaryCtaClass,
} from "@/lib/landing-ui";

const FEATURE_ICONS: Record<FeatureCardSlug, LucideIcon> = {
  "morning-briefing": Sunrise,
  "health-score": Heart,
  alertas: Bell,
  "ga4-midia": BarChart3,
  "auditor-ia": Sparkles,
  "central-acoes": ListTodo,
  "mensagens-cliente": MessageSquare,
};

/** Três pilares — copy curta derivada do hero / posicionamento. */
const HERO_VALUE_PILLARS: Array<{
  icon: LucideIcon;
  title: string;
  subtitle: string;
}> = [
  {
    icon: LayoutDashboard,
    title: "Carteira em uma tela",
    subtitle: "Todos os clientes numa visão só.",
  },
  {
    icon: Bell,
    title: "Alertas no ritmo certo",
    subtitle: "Performance, verba e conversão fora do padrão.",
  },
  {
    icon: Sparkles,
    title: "IA como copiloto",
    subtitle: "Análises e mensagens — você decide.",
  },
];

export const Route = createFileRoute("/retentio")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    links: [
      {
        rel: "preload",
        as: "image",
        href: "/landing/hero-cockpit-clientes-1024.avif",
        type: "image/avif",
        fetchpriority: "high",
      },
    ],
  }),
  component: Landing,
});

function Multiline({ text }: { text: string }) {
  const blocks = text.split("\n\n").filter(Boolean);
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <p key={i} className="whitespace-pre-line text-muted-foreground">
          {block}
        </p>
      ))}
    </div>
  );
}

function HeroHeadline() {
  const full = hero.headline;
  const accent = hero.headlineHighlight;
  if (!accent || !full.includes(accent)) {
    return <>{full}</>;
  }
  const i = full.indexOf(accent);
  return (
    <>
      {full.slice(0, i)}
      <span className="text-primary">{accent}</span>
      {full.slice(i + accent.length)}
    </>
  );
}

function LandingRasterPicture({
  webp,
  png,
  alt,
  width,
  height,
  className,
  priority,
  loading,
}: {
  webp: string;
  png: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
}) {
  // Deriva paths AVIF e responsivos a partir do base name de /landing/*
  // Variants geradas em scripts/gen-img-variants.mjs: <base>.avif, <base>-{640,1024}.{avif,webp}
  const base = webp.replace(/\.webp$/, "");
  const avif = `${base}.avif`;
  const avifSrcSet = `${base}-640.avif 640w, ${base}-1024.avif 1024w, ${avif} ${width}w`;
  const webpSrcSet = `${base}-640.webp 640w, ${base}-1024.webp 1024w, ${webp} ${width}w`;
  const sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1024px";
  return (
    <picture>
      <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />
      <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />
      <img
        src={png}
        alt={alt}
        width={width}
        height={height}
        className={className}
        decoding="async"
        loading={loading ?? (priority ? "eager" : "lazy")}
        fetchPriority={priority ? "high" : undefined}
      />
    </picture>
  );
}

function Landing() {
  const briefingHref = `#${ANCHOR_BRIEFING}`;
  const demoHref = `#${ANCHOR_DEMO}`;
  const demoVideoUrl =
    typeof import.meta.env.VITE_LANDING_DEMO_URL === "string"
      ? import.meta.env.VITE_LANDING_DEMO_URL.trim() || undefined
      : undefined;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(landingFaqJsonLd()).replace(/</g, "\\u003c"),
        }}
      />
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5">
            <Link
              to="/retentio"
              className="flex min-w-0 items-center gap-2 rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary font-bold text-primary-foreground">
                R
              </div>
              <span className="font-semibold tracking-tight">Retentio</span>
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2">
              <div className="mr-1 hidden items-center lg:flex">
                <a href="#problema" className={navAnchorClass}>
                  Problema
                </a>
                <Link to="/demo" className={navAnchorClass}>
                  Demo
                </Link>
                <a href={briefingHref} className={navAnchorClass}>
                  Briefing
                </a>
                <a href="#funcionalidades" className={navAnchorClass}>
                  Produto
                </a>
                <a href="#planos" className={navAnchorClass}>
                  Planos
                </a>
              </div>
              <Link
                to="/login"
                className="rounded-md px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-muted/80 hover:text-foreground sm:px-3"
              >
                Entrar
              </Link>
              <Link
                to="/signup"
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 sm:px-3.5"
              >
                Criar conta
              </Link>
            </nav>
          </div>
        </header>

        <main className="relative pb-28 sm:pb-0">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="grid-bg absolute inset-0 opacity-45 [mask-image:radial-gradient(ellipse_at_top,black_38%,transparent_75%)] dark:opacity-35" />
            <div className="absolute -top-40 left-1/2 h-[22rem] w-[min(100%,48rem)] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl dark:bg-primary/[0.1]" />
          </div>

          {/* Hero + faixa de valor */}
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <section className="pb-10 pt-10 md:pb-14 md:pt-14 lg:pt-16">
              <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-16">
                <div className="text-center lg:text-left">
                  <span className="inline-flex max-w-xl items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs leading-snug text-muted-foreground shadow-sm backdrop-blur-sm lg:mx-0">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                    {hero.eyebrow}
                  </span>
                  <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight md:text-5xl lg:text-[3.15rem] lg:leading-[1.12]">
                    <HeroHeadline />
                  </h1>
                  <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg lg:mx-0 lg:max-w-lg">
                    {hero.subheadline}
                  </p>
                  <ul className="mx-auto mt-8 max-w-xl space-y-3 text-left text-sm leading-snug text-muted-foreground md:text-[15px] lg:mx-0">
                    {hero.bullets.map((line) => (
                      <li key={line} className="flex gap-3">
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                          aria-hidden
                        />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-9 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap lg:mx-0">
                    <Link
                      to="/demo"
                      className={`${landingPrimaryCtaClass} flex-1 sm:flex-none sm:px-5`}
                    >
                      {hero.ctaPrimary}
                    </Link>
                    <a
                      href={briefingHref}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border bg-background/70 px-6 py-2.5 text-center text-sm font-medium backdrop-blur-sm transition hover:border-primary/35 hover:bg-muted/60 sm:flex-none sm:px-5"
                    >
                      {hero.ctaSecondary}
                    </a>
                  </div>
                  <p className="mx-auto mt-8 max-w-xl border-t border-border/70 pt-8 text-xs leading-relaxed text-muted-foreground md:text-sm lg:mx-0">
                    {hero.microcopy}
                  </p>
                </div>
                <div className="group relative mx-auto w-full max-w-lg lg:mx-0 lg:max-w-none">
                  <div
                    className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/[0.14] via-primary/[0.04] to-transparent opacity-90 blur-2xl transition-opacity duration-500 group-hover:opacity-100 dark:from-primary/[0.2]"
                    aria-hidden
                  />
                  <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-black/5 ring-1 ring-border/80 transition-transform duration-300 ease-out will-change-transform group-hover:scale-[1.015] motion-reduce:transform-none dark:shadow-black/20">
                    <LandingRasterPicture
                      webp={landingHeroScreenshot.webp}
                      png={landingHeroScreenshot.png}
                      alt={landingHeroScreenshot.alt}
                      width={landingHeroScreenshot.width}
                      height={landingHeroScreenshot.height}
                      priority
                      className="h-auto w-full object-cover object-top"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Faixa 3 pilares */}
            <section
              className="pb-16 md:pb-20"
              aria-label="Principais benefícios"
            >
              <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/90 p-4 shadow-sm ring-1 ring-border/60 backdrop-blur-sm sm:flex-row sm:items-stretch sm:gap-0 sm:divide-x sm:divide-border/80 md:p-5 dark:bg-surface/50">
                {HERO_VALUE_PILLARS.map(({ icon: Icon, title, subtitle }) => (
                  <div
                    key={title}
                    className="flex flex-1 gap-3 rounded-xl px-2 py-2 sm:flex-col sm:px-4 sm:py-1 md:flex-row md:items-start"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-semibold text-foreground">
                        {title}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground md:text-[13px]">
                        {subtitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Confiança + depoimento + público-alvo */}
            <section className="pb-12 md:pb-14" aria-label="Confiança">
              <p className="text-center text-xs leading-relaxed text-muted-foreground md:text-sm">
                {coldAudience.trustStripTitle}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:gap-5">
                {coldAudience.trustLogos.map((logo) => (
                  <div
                    key={logo.name}
                    className="flex h-11 min-w-[4.5rem] items-center justify-center rounded-lg border border-border bg-muted/35 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground dark:bg-muted/20"
                    title={logo.name}
                  >
                    {logo.initial}
                  </div>
                ))}
              </div>
              <blockquote className="surface-card mx-auto mt-10 max-w-2xl rounded-2xl border border-border p-6 text-left shadow-sm ring-1 ring-border/60 md:p-8">
                <p className="text-sm leading-relaxed text-foreground md:text-base">
                  “{testimonialPlaceholder.quote}”
                </p>
                <footer className="mt-4 text-xs text-muted-foreground md:text-sm">
                  — {testimonialPlaceholder.author},{" "}
                  <cite className="not-italic">
                    {testimonialPlaceholder.role}
                  </cite>
                </footer>
              </blockquote>
              <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-border bg-muted/25 p-5 md:p-6 dark:bg-muted/15">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Não é:</span>{" "}
                  {coldAudience.notFor}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">É:</span>{" "}
                  {coldAudience.forWho}
                </p>
                <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                  {coldAudience.trialOrDemoLine}
                </p>
              </div>
            </section>

            {/* Demo */}
            <section
              id={ANCHOR_DEMO}
              className={`pb-16 md:pb-20 ${SECTION_SCROLL}`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                Demonstração
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                {demoSection.title}
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
                {demoSection.subtitle}
              </p>
              {demoVideoUrl ? (
                <div className="mt-8 overflow-hidden rounded-2xl border border-border shadow-md">
                  <div className="aspect-video w-full">
                    <iframe
                      className="h-full w-full"
                      src={demoVideoUrl}
                      title="Demonstração Retentio"
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pt-1 sm:gap-5 md:grid md:snap-none md:grid-cols-2 md:overflow-visible md:pb-0 lg:grid-cols-3">
                  {demoSection.panels.map((panel) => (
                    <figure
                      key={`${panel.webp}-${panel.title}`}
                      className="surface-card w-[min(100%,22rem)] shrink-0 snap-center overflow-hidden rounded-xl border border-border bg-card shadow-sm md:w-auto"
                    >
                      <div className="border-b border-border bg-muted/25 dark:bg-muted/15">
                        <LandingRasterPicture
                          webp={panel.webp}
                          png={panel.png}
                          alt={panel.alt}
                          width={panel.width}
                          height={panel.height}
                          className="max-h-[260px] h-auto w-full object-cover object-top md:max-h-[min(52vh,380px)] lg:max-h-[420px]"
                        />
                      </div>
                      <figcaption className="space-y-1 p-4 md:p-5">
                        <p className="font-semibold text-foreground">
                          {panel.title}
                        </p>
                        <p className="text-xs leading-snug text-muted-foreground md:text-[13px]">
                          {panel.caption}
                        </p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <a
                  href={briefingHref}
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {demoSection.briefingLinkLabel}
                </a>
                <Link
                  to="/signup"
                  className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                  Criar conta e explorar o demo
                </Link>
              </div>
            </section>
          </div>

          {/* Dor */}
          <section
            id="problema"
            className={`border-t border-border/60 bg-muted/[0.35] py-16 dark:bg-muted/10 md:py-20 ${SECTION_SCROLL}`}
          >
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                01 · Problema
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                {painSection.title}
              </h2>
              <p className="mt-4 text-muted-foreground">{painSection.intro}</p>
              <ul className="mt-4 space-y-1.5 rounded-xl border border-dashed border-border bg-background/60 px-4 py-4 text-sm text-muted-foreground md:text-base dark:bg-background/40">
                {painSection.routineLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="mt-6 space-y-3">
                <Multiline text={painSection.bodyAfterRoutine} />
                <p className="font-medium text-foreground">
                  {painSection.punchline1}
                </p>
                <p className="font-medium text-foreground">
                  {painSection.punchline2}
                </p>
              </div>
              <p className="mt-8 font-medium text-foreground">
                {painSection.symptomIntro}
              </p>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-muted-foreground md:text-[15px]">
                {painSection.symptoms.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <aside className="surface-card mt-10 rounded-2xl border border-primary/20 bg-primary/[0.06] p-5 shadow-sm ring-1 ring-primary/10 md:p-6 dark:bg-primary/[0.08]">
                <p className="text-sm font-medium leading-snug text-foreground md:text-[15px]">
                  {painSection.insightCallout}
                </p>
              </aside>
            </div>
          </section>

          {/* Virada */}
          <section
            id="prioridade"
            className={`py-16 md:py-20 ${SECTION_SCROLL}`}
          >
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                02 · Prioridade
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                {pivotSection.title}
              </h2>
              <div className="mt-6">
                <Multiline text={pivotSection.intro} />
              </div>
              <p className="mt-6 font-medium">{pivotSection.contrastIntro}</p>
              <div className="surface-card mt-4 space-y-4 rounded-2xl border border-border p-6 shadow-sm ring-1 ring-border/70 md:p-8">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Uma dashboard responde
                  </p>
                  <p className="mt-2 text-lg text-foreground">
                    {pivotSection.dashboardQuestion}
                  </p>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">
                    O Retentio responde
                  </p>
                  <p className="mt-2 text-lg text-foreground">
                    {pivotSection.retentioQuestion}
                  </p>
                </div>
              </div>
              <div className="mt-8">
                <Multiline text={pivotSection.closing} />
              </div>
            </div>
          </section>

          {/* Solução */}
          <section className="border-t border-border/60 bg-muted/[0.35] py-16 dark:bg-muted/10 md:py-20">
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                03 · Solução
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                {solutionSection.title}
              </h2>
              <p className="mt-2 text-lg text-muted-foreground md:text-xl">
                {solutionSection.subtitle}
              </p>
              <div className="mt-6">
                <Multiline text={solutionSection.body} />
              </div>
              <p className="mt-8 font-medium text-foreground">
                {solutionSection.checklistIntro}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground md:text-[15px]">
                {solutionSection.checklist.map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Mecanismo Daily Performance Briefing */}
          <section
            id={ANCHOR_BRIEFING}
            className={`py-16 md:py-24 ${SECTION_SCROLL}`}
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="surface-card rounded-2xl border border-border p-6 shadow-sm ring-1 ring-border/70 md:p-10">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                  Mecanismo único
                </p>
                <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                  {briefingMechanism.name}
                </h2>
                <div className="mt-6 max-w-3xl">
                  <Multiline text={briefingMechanism.explanation} />
                </div>
                <h3 className="mt-10 text-lg font-semibold">
                  {briefingMechanism.stepsTitle}
                </h3>
                <ol className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {briefingMechanism.steps.map((step, idx) => (
                    <li
                      key={step.title}
                      className="rounded-xl border border-border bg-background/60 p-4 dark:bg-background/40"
                    >
                      <span className="inline-flex rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {idx + 1}. {step.title}
                      </span>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {step.body}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          {/* Antes / Depois */}
          <section
            id="antes-depois"
            className={`border-t border-border/60 bg-muted/[0.35] py-16 dark:bg-muted/10 md:py-24 ${SECTION_SCROLL}`}
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                04 · Antes e depois
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                {beforeAfterSection.title}
              </h2>
              <div className="mt-8 hidden overflow-x-auto rounded-xl border border-border shadow-sm md:block">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-border bg-surface/80">
                    <tr>
                      <th className="px-4 py-3 font-semibold">
                        Antes do Retentio
                      </th>
                      <th className="px-4 py-3 font-semibold">Com Retentio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {beforeAfterSection.rows.map((row, rowIdx) => (
                      <tr
                        key={row.before}
                        className={`border-b border-border last:border-0 ${rowIdx % 2 === 1 ? "bg-muted/[0.35] dark:bg-muted/15" : ""}`}
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.before}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-start gap-2 text-foreground">
                            <CheckCircle2
                              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                              aria-hidden
                            />
                            <span>{row.after}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-8 space-y-3 md:hidden">
                {beforeAfterSection.rows.map((row) => (
                  <div
                    key={row.before}
                    className="surface-card rounded-xl border border-border p-4 text-sm shadow-sm"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Antes
                    </p>
                    <p className="mt-1 text-muted-foreground">{row.before}</p>
                    <p className="mt-4 text-xs font-medium uppercase tracking-wide text-primary">
                      Depois
                    </p>
                    <p className="mt-1 flex items-start gap-2">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span>{row.after}</span>
                    </p>
                  </div>
                ))}
              </div>
              <div className="surface-card mt-10 max-w-3xl rounded-2xl border border-primary/25 bg-primary/5 p-6 shadow-sm md:p-8">
                <Multiline text={beforeAfterSection.closing} />
              </div>
            </div>
          </section>

          {/* Funcionalidades — bento */}
          <section
            id="funcionalidades"
            className={`py-16 md:py-24 ${SECTION_SCROLL}`}
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                05 · Produto
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                Funcionalidades que respondem à sua rotina
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featureCards.map((f) => {
                  const Icon = FEATURE_ICONS[f.slug];
                  const wide = f.slug === "morning-briefing";
                  return (
                    <div
                      key={f.slug}
                      className={`surface-card rounded-xl border border-border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md motion-reduce:hover:translate-y-0 sm:p-6 ${wide ? "lg:col-span-2" : ""}`}
                    >
                      <Icon className="h-5 w-5 text-primary" />
                      <h3 className="mt-3 font-medium">{f.title}</h3>
                      <div className="mt-2 space-y-3 text-sm text-muted-foreground">
                        {f.body.split("\n\n").map((para, i) => (
                          <p key={i} className="whitespace-pre-line">
                            {para}
                          </p>
                        ))}
                      </div>
                      {f.bullets && f.bullets.length > 0 && (
                        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                          {f.bullets.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Autoridade */}
          <section
            id="autoridade"
            className={`border-t border-border/60 bg-muted/[0.35] py-16 dark:bg-muted/10 md:py-20 ${SECTION_SCROLL}`}
          >
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                06 · Por trás do produto
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                {authoritySection.title}
              </h2>
              <div className="mt-6">
                <Multiline text={authoritySection.body} />
              </div>
              <p className="mt-8 font-medium">
                {authoritySection.bulletsIntro}
              </p>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-muted-foreground md:text-[15px]">
                {authoritySection.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <blockquote className="surface-card mt-10 rounded-2xl border border-border p-6 text-base font-medium leading-relaxed shadow-sm ring-1 ring-border/70 md:p-8">
                <Multiline text={authoritySection.quote} />
              </blockquote>
            </div>
          </section>

          {/* Comparativo rápido (público frio) */}
          <section
            id="comparativo"
            className={`border-t border-border/60 py-16 md:py-24 ${SECTION_SCROLL}`}
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                Comparativo
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                {miniComparison.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                {miniComparison.subtitle}
              </p>
              <div className="mt-8 overflow-x-auto rounded-xl border border-border shadow-sm">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-border bg-surface/80">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Ferramenta</th>
                      <th className="px-4 py-3 font-semibold">
                        O foco costuma ser
                      </th>
                      <th className="px-4 py-3 font-semibold">No Retentio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {miniComparison.rows.map((row, idx) => (
                      <tr
                        key={row.label}
                        className={`border-b border-border last:border-0 ${idx % 2 === 1 ? "bg-muted/[0.35] dark:bg-muted/15" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium">{row.label}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.them}
                        </td>
                        <td className="px-4 py-3 text-foreground">{row.us}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <a
                href="#objecoes"
                className="mt-6 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                {miniComparison.linkLabel}
              </a>
            </div>
          </section>

          {/* Objeções */}
          <section id="objecoes" className={`py-16 md:py-24 ${SECTION_SCROLL}`}>
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                07 · Dúvidas
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                {objectionsSection.title}
              </h2>
              <div className="mt-8 space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {objectionsSection.items.slice(0, 2).map((item) => (
                    <div
                      key={item.q}
                      className="surface-card rounded-xl border border-border p-6 text-left shadow-sm transition-colors hover:border-primary/25"
                    >
                      <p className="font-semibold text-foreground">{item.q}</p>
                      <div className="mt-4 text-sm text-muted-foreground">
                        <Multiline text={item.a} />
                      </div>
                    </div>
                  ))}
                </div>
                <aside className="rounded-2xl border border-border bg-muted/40 px-5 py-4 text-center text-sm font-medium leading-snug text-foreground shadow-sm dark:bg-muted/25 md:px-8 md:py-5 md:text-[15px]">
                  {objectionsSection.betweenCallout}
                </aside>
                <div className="grid gap-4 md:grid-cols-2">
                  {objectionsSection.items.slice(2).map((item) => (
                    <div
                      key={item.q}
                      className="surface-card rounded-xl border border-border p-6 text-left shadow-sm transition-colors hover:border-primary/25"
                    >
                      <p className="font-semibold text-foreground">{item.q}</p>
                      <div className="mt-4 text-sm text-muted-foreground">
                        <Multiline text={item.a} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Passos após cadastro */}
          <section
            id="apos-cadastro"
            className={`border-t border-border/60 bg-muted/[0.35] py-16 dark:bg-muted/10 md:py-20 ${SECTION_SCROLL}`}
          >
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                Depois do cadastro
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                O que acontece em seguida
              </h2>
              <ol className="mt-8 space-y-5">
                {coldAudience.afterSignupSteps.map((step, idx) => (
                  <li key={step} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      {idx + 1}
                    </span>
                    <span className="pt-1 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Custo da ineficiência */}
          <section
            id="custo-ineficiencia"
            className={`py-16 md:py-24 ${SECTION_SCROLL}`}
          >
            <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
              <TrendingDown
                className="mx-auto h-8 w-8 text-rose-500"
                aria-hidden
              />
              <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                {costOfInefficiency.title}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
                {costOfInefficiency.promptQuestion}
              </p>
              <div className="mx-auto mt-8 max-w-sm overflow-hidden rounded-2xl border border-border shadow-sm">
                {costOfInefficiency.calculation.map((row, idx) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between px-5 py-3 text-sm ${
                      idx < costOfInefficiency.calculation.length - 1
                        ? "border-b border-border"
                        : "bg-rose-500/10 font-semibold text-rose-700 dark:text-rose-400"
                    }`}
                  >
                    <span className="text-left text-muted-foreground">
                      {row.label}
                    </span>
                    <span className="font-medium text-foreground">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mx-auto mt-6 max-w-xl text-sm text-muted-foreground md:text-[15px]">
                {costOfInefficiency.conclusion}
              </p>
              <p className="mt-4 text-base font-semibold text-foreground">
                {costOfInefficiency.punchline}
              </p>
              <Link
                to="/signup"
                className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
              >
                Criar conta gratuita
              </Link>
            </div>
          </section>

          {/* Planos */}
          <section
            id="planos"
            className={`border-t border-border/60 bg-muted/[0.35] py-16 dark:bg-muted/10 md:py-24 ${SECTION_SCROLL}`}
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                08 · Planos
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                {pricingSection.title}
              </h2>
              <div className="mt-4 max-w-3xl space-y-2 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
                <p>{coldAudience.pricingIntro}</p>
                <p>{coldAudience.pricingHintIndividual}</p>
                <p>{coldAudience.pricingHintPro}</p>
              </div>
              <div className="mt-10 grid gap-6 lg:grid-cols-3">
                {pricingSection.plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={
                      plan.highlighted
                        ? "surface-card relative flex flex-col rounded-2xl border-2 border-primary p-6 shadow-md ring-2 ring-primary/15 md:p-8"
                        : "surface-card flex flex-col rounded-2xl border border-border p-6 shadow-sm md:p-8"
                    }
                  >
                    {plan.highlighted && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
                        Recomendado
                      </span>
                    )}
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plan.audience}
                    </p>
                    <p className="font-mono mt-4 text-2xl font-semibold tabular-nums tracking-tight">
                      {plan.price}
                    </p>
                    {plan.badge && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {plan.badge}
                      </p>
                    )}
                    {"highlightNote" in plan && plan.highlightNote ? (
                      <p className="mt-2 text-xs font-medium text-primary">
                        {plan.highlightNote}
                      </p>
                    ) : null}
                    <p className="mt-6 text-sm font-medium text-foreground">
                      {plan.includesLead}
                    </p>
                    <ul className="mt-3 flex-1 space-y-2 text-sm text-muted-foreground">
                      {plan.includes.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span className="text-primary">✓</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/signup"
                      className={
                        plan.highlighted
                          ? "mt-8 inline-flex h-11 items-center justify-center rounded-lg bg-primary text-center text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
                          : "mt-8 inline-flex h-11 items-center justify-center rounded-lg border border-border text-center text-sm font-semibold transition hover:bg-muted/70"
                      }
                    >
                      {plan.cta}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ conversão */}
          <section
            id="faq"
            className={`border-t border-border/60 py-16 md:py-24 ${SECTION_SCROLL}`}
          >
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                FAQ
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                Perguntas frequentes
              </h2>
              <div className="mt-8 space-y-3">
                {faqConversion.map((item) => (
                  <details
                    key={item.question}
                    className="group surface-card rounded-xl border border-border px-4 py-3 shadow-sm open:border-primary/25 open:shadow-md"
                  >
                    <summary className="cursor-pointer list-none font-medium text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                      <span className="flex items-start justify-between gap-2">
                        {item.question}
                        <span className="shrink-0 text-muted-foreground transition group-open:rotate-180">
                          ▾
                        </span>
                      </span>
                    </summary>
                    <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* CTA final — glow só no primário do hero; aqui sem glow */}
          <section
            id="cta-final"
            className={`mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 md:py-28 ${SECTION_SCROLL}`}
          >
            <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
              {finalCta.title}
            </h2>
            <div className="mx-auto mt-6 max-w-2xl text-left md:text-center">
              <Multiline text={finalCta.body} />
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
              >
                {finalCta.ctaPrimary}
              </Link>
              <Link
                to="/demo"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-6 py-2.5 text-sm font-semibold transition hover:bg-muted/70"
              >
                {finalCta.ctaSecondary}
              </Link>
            </div>
            <p className="mx-auto mt-6 max-w-lg text-xs text-muted-foreground md:text-sm">
              {finalCta.microcopy}
            </p>
          </section>

          <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4">
              <p>© {new Date().getFullYear()} Retentio</p>
              <span className="hidden text-border sm:inline">·</span>
              <Link
                to="/login"
                className="rounded-md outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Entrar
              </Link>
              <Link
                to="/signup"
                className="rounded-md outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Criar conta
              </Link>
              <a
                href={demoHref}
                className="rounded-md outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Demo
              </a>
              <a
                href={briefingHref}
                className="rounded-md outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Briefing
              </a>
              <a
                href="#faq"
                className="rounded-md outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                FAQ
              </a>
            </div>
          </footer>

          <div className="fixed bottom-0 left-0 right-0 z-40 flex gap-2 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 dark:shadow-[0_-8px_30px_rgba(0,0,0,0.35)] sm:hidden">
            <Link
              to="/signup"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              Criar conta
            </Link>
            <Link
              to="/demo"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition hover:bg-muted/70"
            >
              Ver demo
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
