import { memo } from "react";
import { BarChart2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  ANCHOR_COMO,
  ANCHOR_FAQ,
  ANCHOR_O_QUE_E,
  ANCHOR_O_QUE_FAZ,
  ANCHOR_PARA_QUEM,
  ANCHOR_PREVIEW,
  ANCHOR_RESULTADOS,
} from "@/content/diagnosis-landing";
import {
  landingNavAnchorClass,
  landingPrimaryCtaClass,
} from "@/lib/landing-ui";
import { cn } from "@/lib/utils";

type Props = {
  onCtaClick: () => void;
};

function DiagnosisLandingHeaderInner({ onCtaClick }: Props) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5">
        <a
          href="#top"
          className="flex min-w-0 items-center gap-2.5 rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm">
            <BarChart2 className="h-4 w-4" aria-hidden />
          </div>
          <span className="truncate text-sm font-bold tracking-tight sm:text-base">
            Diagnóstico Meta Ads
          </span>
        </a>
        <nav className="flex items-center gap-1 sm:gap-2">
          <div className="mr-1 hidden items-center xl:flex">
            <a href={`#${ANCHOR_O_QUE_E}`} className={landingNavAnchorClass}>
              O que é
            </a>
            <a href={`#${ANCHOR_PARA_QUEM}`} className={landingNavAnchorClass}>
              Para quem
            </a>
            <a href={`#${ANCHOR_O_QUE_FAZ}`} className={landingNavAnchorClass}>
              O que faz
            </a>
            <a href={`#${ANCHOR_COMO}`} className={landingNavAnchorClass}>
              Como funciona
            </a>
            <a href={`#${ANCHOR_PREVIEW}`} className={landingNavAnchorClass}>
              Relatório
            </a>
            <a href={`#${ANCHOR_RESULTADOS}`} className={landingNavAnchorClass}>
              Resultados
            </a>
            <a href={`#${ANCHOR_FAQ}`} className={landingNavAnchorClass}>
              FAQ
            </a>
          </div>
          <Link
            to="/retentio"
            className={cn(landingNavAnchorClass, "hidden sm:inline-flex")}
          >
            Retentio
          </Link>
          <button
            type="button"
            onClick={onCtaClick}
            className={cn(landingPrimaryCtaClass, "px-3 sm:px-3.5")}
          >
            R$ 37
          </button>
        </nav>
      </div>
    </header>
  );
}

export const DiagnosisLandingHeader = memo(DiagnosisLandingHeaderInner);
