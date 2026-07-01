import { memo, useState } from "react";
import { BarChart2, Moon, Sun, Menu, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  landingNavAnchorClass,
  landingPrimaryCtaClass,
  landingOutlineCtaClass,
} from "@/lib/landing-ui";
import { anchors, hero } from "@/content/gestao-trafego";
import { getSnapshotTheme, subscribeTheme, toggleTheme } from "@/lib/theme";
import { useSyncExternalStore } from "react";

type Props = {
  onCtaClick?: () => void;
};

function GestaoTrafegoHeaderInner({ onCtaClick }: Props) {
  const theme = useSyncExternalStore(subscribeTheme, getSnapshotTheme, () => "light" as const);
  const isDark = theme === "dark";
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: `#${anchors.comoFunciona}`, label: "Como funciona" },
    { href: `#${anchors.prova}`, label: "Resultados" },
    { href: `#${anchors.faq}`, label: "FAQ" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 text-foreground backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5">
        <a
          href="#top"
          className="flex min-w-0 items-center gap-2.5 rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm">
            <BarChart2 className="h-4 w-4" aria-hidden />
          </div>
          <span className="truncate text-sm font-bold tracking-tight sm:text-base">Agency Opus</span>
        </a>

        <nav className="flex items-center gap-1 sm:gap-2">
          <div className="mr-1 hidden items-center md:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className={landingNavAnchorClass}>
                {link.label}
              </a>
            ))}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-background/70 text-muted-foreground outline-none ring-offset-background transition hover:bg-muted/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-background/70 text-muted-foreground md:hidden"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
          </button>

          <button
            type="button"
            onClick={onCtaClick}
            className={cn(landingPrimaryCtaClass, "px-3 sm:px-3.5")}
          >
            {hero.cta}
          </button>
        </nav>
      </div>

      {mobileOpen ? (
        <div className="border-t border-border/70 bg-background/95 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(landingNavAnchorClass, "justify-start")}
              >
                {link.label}
              </a>
            ))}
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className={cn(landingNavAnchorClass, "justify-start")}
            >
              Diagnóstico R$37
            </Link>
            <Link
              to="/gestao-checkout"
              onClick={() => setMobileOpen(false)}
              className={cn(landingOutlineCtaClass, "mt-2 justify-start")}
            >
              Quero pagar direto
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export const GestaoTrafegoHeader = memo(GestaoTrafegoHeaderInner);
