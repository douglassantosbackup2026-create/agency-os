import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Check, MessageCircle, ArrowLeft } from "lucide-react";
import { form } from "@/content/gestao-trafego";
import { whatsappGestaoHref } from "@/lib/gestao-whatsapp";
import { trackMetaCompleteRegistration, trackMetaPageView } from "@/lib/meta-pixel";

const CANONICAL_URL = "https://agencyopus.live/gestao-trafego-obrigado";

export const Route = createFileRoute("/gestao-trafego-obrigado")({
  validateSearch: (search: Record<string, unknown>) => ({
    lead: typeof search.lead === "string" ? search.lead : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Proposta solicitada — Gestão de Tráfego Meta Ads" },
      { name: "description", content: "Recebemos sua proposta. Douglas responderá em até 24h úteis." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: CANONICAL_URL }],
  }),
  component: GestaoTrafegoObrigadoPage,
});

function GestaoTrafegoObrigadoPage() {
  const { lead } = Route.useSearch();

  useEffect(() => {
    trackMetaPageView();
    trackMetaCompleteRegistration("Gestão E-commerce Lead", { lead_id: lead ?? "" }, lead ?? undefined);
  }, [lead]);

  const whatsappHref = whatsappGestaoHref(
    "Olá! Preenchi a proposta de gestão de tráfego no site e quero conversar sobre a minha operação.",
  );

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <Check className="h-8 w-8 text-success" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
          {form.success.title}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">{form.success.body}</p>

        <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <p className="text-sm text-muted-foreground">{form.success.ctaHint}</p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" />
            {form.success.cta}
          </a>
        </div>

        <div className="mt-6">
          <Link
            to="/gestao-trafego"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground underline hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para a página de gestão
          </Link>
        </div>

        {lead ? (
          <p className="mt-8 text-xs text-muted-foreground">Referência do envio: {lead.slice(0, 8)}</p>
        ) : null}
      </div>
    </div>
  );
}
