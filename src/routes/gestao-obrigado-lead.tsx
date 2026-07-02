import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Check, MessageCircle } from "lucide-react";
import { whatsappGestaoHref } from "@/lib/gestao-whatsapp";
import { GESTAO_PRODUCT, trackMetaPageView, trackMetaPurchase } from "@/lib/meta-pixel";

const CANONICAL_URL = "https://agencyopus.live/gestao-obrigado-lead";

export const Route = createFileRoute("/gestao-obrigado-lead")({
  validateSearch: (search: Record<string, unknown>) => ({
    lead: typeof search.lead === "string" ? search.lead : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pagamento recebido — vaga garantida" },
      {
        name: "description",
        content:
          "Sua vaga está garantida. Douglas entrará em contato pelo WhatsApp em até 24h úteis.",
      },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: CANONICAL_URL }],
  }),
  component: GestaoObrigadoLeadPage,
});

function GestaoObrigadoLeadPage() {
  const { lead } = Route.useSearch();

  useEffect(() => {
    trackMetaPageView();
    if (lead) {
      trackMetaPurchase(GESTAO_PRODUCT, lead, { value: 4997, currency: "BRL" });
    }
  }, [lead]);

  const whatsappHref = whatsappGestaoHref(
    "Olá! Acabei de pagar a gestão de tráfego e quero confirmar o início do onboarding.",
  );

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <Check className="h-8 w-8 text-success" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
          Pagamento recebido — vaga garantida
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Douglas vai chamar você no WhatsApp em até <strong className="text-foreground">24h úteis</strong> para iniciar o onboarding.
        </p>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
        >
          <MessageCircle className="h-5 w-5" />
          Falar com Douglas agora
        </a>

        <div className="mt-8">
          <Link
            to="/gestao-trafego"
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Voltar para a página de gestão
          </Link>
        </div>

        {lead ? (
          <p className="mt-8 text-xs text-muted-foreground">
            Referência: {lead.slice(0, 8)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
