import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-bold">
            R
          </div>
          <span className="font-semibold tracking-tight">Retentio</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            to="/login"
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            Entrar
          </Link>
          <Link
            to="/signup"
            className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
          >
            Criar conta
          </Link>
        </nav>
      </header>

      <main className="relative">
        <div className="grid-bg absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />

        <section className="mx-auto max-w-3xl px-6 pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Beta fechado · agências de performance
          </span>
          <h1 className="mt-6 text-balance text-5xl font-semibold tracking-tight md:text-6xl">
            O sistema operacional de{" "}
            <span className="text-primary">retenção</span> para agências de
            tráfego.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Health score por cliente, alertas inteligentes, relatórios em
            linguagem humana e portal white-label. Tudo em um só lugar — leve,
            rápido e operacional.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              to="/signup"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 glow-primary transition"
            >
              Criar minha agência
            </Link>
            <Link
              to="/login"
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-surface transition"
            >
              Já tenho conta
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-3 px-6 pb-24 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="surface-card rounded-xl border border-border p-5"
            >
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

const features = [
  {
    icon: ShieldCheck,
    title: "Health score automático",
    body: "Risco de churn calculado em tempo real a partir de performance, comunicação e estabilidade.",
  },
  {
    icon: Bell,
    title: "Alertas inteligentes",
    body: "ROAS caindo, CPA subindo, criativo fadigado, pacing fora — chega antes do cliente perceber.",
  },
  {
    icon: Activity,
    title: "Feed operacional",
    body: "Tudo que importa do dia a dia em uma linha do tempo única, em tempo real.",
  },
  {
    icon: BarChart3,
    title: "Relatórios IA",
    body: "Resumo executivo, problemas, oportunidades e próximos passos em linguagem humana.",
  },
  {
    icon: Zap,
    title: "Ações rápidas",
    body: "Command palette, busca global e atalhos para agir em segundos.",
  },
  {
    icon: Sparkles,
    title: "Portal do cliente",
    body: "Experiência white-label simples e bonita para aumentar percepção de valor.",
  },
];
