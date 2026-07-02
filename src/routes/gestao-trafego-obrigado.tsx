import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, CreditCard, Flame, Loader2, MessageCircle, TrendingUp } from "lucide-react";
import { whatsappGestaoHref } from "@/lib/gestao-whatsapp";
import { callDiagnosisApi } from "@/lib/diagnosis-api";
import { GESTAO_PRODUCT, trackMetaAddPaymentInfo, trackMetaCompleteRegistration, trackMetaPageView } from "@/lib/meta-pixel";

const CANONICAL_URL = "https://agencyopus.live/gestao-trafego-obrigado";

export const Route = createFileRoute("/gestao-trafego-obrigado")({
  validateSearch: (search: Record<string, unknown>) => ({
    lead: typeof search.lead === "string" ? search.lead : undefined,
    checkout: typeof search.checkout === "string" ? search.checkout : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Proposta recebida — garanta sua vaga (só 3 este mês)" },
      { name: "description", content: "Só 3 vagas por mês. R$ 4.997/mês, sem fidelidade. Pague no cartão ou Pix e garanta a sua agora." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: CANONICAL_URL }],
  }),
  component: GestaoTrafegoObrigadoPage,
});

function GestaoTrafegoObrigadoPage() {
  const { lead, checkout } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    checkout === "falha"
      ? "Pagamento não foi concluído. Tente novamente ou fale no WhatsApp."
      : checkout === "pending"
      ? "Pagamento pendente de confirmação. Assim que o Mercado Pago confirmar, sua vaga entra na fila."
      : null,
  );

  useEffect(() => {
    trackMetaPageView();
    trackMetaCompleteRegistration("Gestão E-commerce Lead", { lead_id: lead ?? "" }, lead ?? undefined);
  }, [lead]);

  const whatsappHref = whatsappGestaoHref(
    "Olá! Acabei de enviar a proposta no site e quero garantir uma das 3 vagas deste mês para a gestão de tráfego (R$ 4.997/mês). Podemos começar?",
  );

  const handleCheckout = async () => {
    if (!lead) {
      setError("Referência do lead ausente. Envie o formulário novamente.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await callDiagnosisApi<{ init_point?: string }>("create-lead-checkout", {
        method: "POST",
        body: JSON.stringify({ lead_id: lead }),
      });
      if (!res.init_point) {
        throw new Error("Não foi possível abrir o checkout. Tente novamente.");
      }
      trackMetaAddPaymentInfo(GESTAO_PRODUCT, { order_id: lead });
      window.location.href = res.init_point;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir o checkout.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <Check className="h-8 w-8 text-success" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
          Proposta recebida — falta só garantir sua vaga
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Douglas abre <strong className="text-foreground">apenas 3 vagas por mês</strong> para operações de e-commerce que querem escalar. Quem paga primeiro, entra.
        </p>

        <div className="mt-8 rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 text-left">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-destructive">
              <Flame className="h-3.5 w-3.5" />
              Apenas 3 vagas este mês
            </span>
          </div>
          <div className="mt-4 text-center">
            <div className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              R$ 4.997<span className="text-lg font-semibold text-muted-foreground">/mês</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">sem fidelidade · onboarding em até 24h úteis</p>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading || !lead}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Abrindo checkout…
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Pagar agora e garantir vaga
              </>
            )}
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Cartão de crédito, Pix ou boleto · pagamento seguro Mercado Pago
          </p>

          {error ? (
            <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-transparent px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-primary/10"
          >
            <MessageCircle className="h-4 w-4" />
            Prefere falar antes? Chamar no WhatsApp
          </a>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Vagas confirmadas por ordem de pagamento. Sem resposta em 24h = vaga liberada para o próximo.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          <span>ROAS médio 15,59× · +R$ 30M gerenciados em escala</span>
        </div>

        <div className="mt-8">
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
