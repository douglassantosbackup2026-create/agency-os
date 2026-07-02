import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, MessageCircle } from "lucide-react";
import { whatsappGestaoHref } from "@/lib/gestao-whatsapp";
import {
  formatLeadManagementPrice,
  leadManagementPriceBrl,
  LEAD_MANAGEMENT_PRICE_CENTS,
} from "@/lib/lead-management-price";
import { fetchLeadPaymentStatus } from "@/lib/lead-payment-status";
import { GESTAO_PRODUCT, trackMetaPageView, trackMetaPurchase } from "@/lib/meta-pixel";

const CANONICAL_URL = "https://agencyopus.live/gestao-obrigado-lead";

export const Route = createFileRoute("/gestao-obrigado-lead")({
  validateSearch: (search: Record<string, unknown>) => ({
    lead: typeof search.lead === "string" ? search.lead : undefined,
    s: typeof search.s === "string" ? search.s : undefined,
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
  const { lead, s } = Route.useSearch();
  const [phase, setPhase] = useState<"loading" | "paid" | "pending" | "error">("loading");
  const [amountCents, setAmountCents] = useState(LEAD_MANAGEMENT_PRICE_CENTS);

  useEffect(() => {
    trackMetaPageView();
  }, []);

  useEffect(() => {
    if (!lead || !s) {
      setPhase("error");
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12;

    const poll = async () => {
      try {
        const data = await fetchLeadPaymentStatus(lead, s);
        if (cancelled) return;
        if (data.amount_cents) setAmountCents(data.amount_cents);

        if (data.status === "paid") {
          setPhase("paid");
          trackMetaPurchase(GESTAO_PRODUCT, lead, {
            value: leadManagementPriceBrl(data.amount_cents ?? LEAD_MANAGEMENT_PRICE_CENTS),
            currency: "BRL",
          });
          return;
        }
        if (data.status === "awaiting_payment" && attempts < maxAttempts - 1) {
          attempts += 1;
          setPhase("loading");
          window.setTimeout(poll, 2500);
          return;
        }
        if (data.status === "awaiting_payment") {
          setPhase("pending");
          return;
        }
        setPhase("pending");
      } catch {
        if (!cancelled) setPhase("error");
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [lead, s]);

  const whatsappHref = whatsappGestaoHref(
    "Olá! Acabei de pagar a gestão de tráfego e quero confirmar o início do onboarding.",
  );

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Confirmando pagamento…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <Check className="h-8 w-8 text-success" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
          {phase === "paid"
            ? "Pagamento recebido — vaga garantida"
            : phase === "pending"
              ? "Pagamento em processamento"
              : "Não foi possível confirmar o pagamento"}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          {phase === "paid" ? (
            <>
              Douglas vai chamar você no WhatsApp em até{" "}
              <strong className="text-foreground">24h úteis</strong> para iniciar o onboarding.
            </>
          ) : phase === "pending" ? (
            <>
              Se pagou com Pix, a confirmação pode levar alguns minutos. Você receberá contato assim que o Mercado Pago aprovar ({formatLeadManagementPrice(amountCents)}).
            </>
          ) : (
            <>Se o pagamento foi aprovado, aguarde alguns minutos ou fale no WhatsApp.</>
          )}
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
