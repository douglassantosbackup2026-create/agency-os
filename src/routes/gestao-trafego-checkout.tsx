import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  Loader2,
  CreditCard,
  QrCode,
  Copy,
  Check,
  CircleCheck,
  TrendingUp,
} from "lucide-react";

import { callDiagnosisApi } from "@/lib/diagnosis-api";
import { useDiagnosisPoll } from "@/hooks/use-diagnosis-poll";
import { useMercadoPago, type MpInstance } from "@/hooks/use-mercadopago-sdk";
import { InlineErrorBanner } from "@/components/diagnosis-funnel/InlineErrorBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  GESTAO_DELIVERABLES,
  GESTAO_PAYMENT_METHOD_HINTS,
  GESTAO_PRODUCT_NAME,
  GESTAO_PRODUCT_TAGLINE,
  GESTAO_RECURRENCE_NOTE_PIX,
  gestaoUrgencyText,
} from "@/content/gestao-checkout";
import { LEAD_FUNNEL_MONTHLY_CAP } from "@/content/gestao-lead-slots";
import { LeadFunnelSlotsBadge } from "@/components/gestao-trafego/LeadFunnelSlotsBadge";
import {
  applyLeadSlotsFromStatus,
  useLeadAvailableSlots,
} from "@/hooks/use-lead-available-slots";
import {
  formatLeadManagementPrice,
  leadCardConsentLabel,
  leadRecurrenceNoteCard,
  LEAD_MANAGEMENT_PRICE_CENTS,
} from "@/lib/lead-management-price";
import { GESTAO_PRODUCT, trackMetaAddPaymentInfo, trackMetaLead } from "@/lib/meta-pixel";
import { whatsappGestaoHref } from "@/lib/gestao-whatsapp";
import {
  GestaoGuaranteeBlock,
  GestaoNextSteps,
  GestaoOperatorCard,
  GestaoResultsGallery,
  GestaoSocialProof,
} from "@/components/gestao/GestaoCheckoutBlocks";

type LeadSearch = { lead?: string; s?: string };

export const Route = createFileRoute("/gestao-trafego-checkout")({
  validateSearch: (search: Record<string, unknown>): LeadSearch => ({
    lead: typeof search.lead === "string" ? search.lead : undefined,
    s: typeof search.s === "string" ? search.s : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Checkout — Gestão de Tráfego (${LEAD_FUNNEL_MONTHLY_CAP} vagas/mês)` },
      {
        name: "description",
        content: "Garanta sua vaga com pagamento seguro via cartão ou PIX.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GestaoTrafegoCheckoutPage,
});

const onlyDigits = (s: string) => s.replace(/\D+/g, "");

function isValidCpf(cpf: string): boolean {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(d[i]) * (slice + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
}

const payerSchema = z.object({
  name: z.string().trim().min(2, "Nome curto").max(100, "Nome longo"),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  cpf: z.string().refine(isValidCpf, "CPF inválido"),
  phone: z
    .string()
    .refine((v) => onlyDigits(v).length >= 10 && onlyDigits(v).length <= 13, "Telefone inválido"),
});

type PayerForm = z.infer<typeof payerSchema>;

function maskCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function maskPhone(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d)/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d)/, "($1) $2-$3").trim();
}

function maskCardNumber(v: string): string {
  return onlyDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}

function maskExpiry(v: string): string {
  const d = onlyDigits(v).slice(0, 4);
  if (d.length < 3) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

type StartResp = {
  lead_id: string;
  access_slug: string;
  amount_cents: number;
  mp_public_key: string;
};

type ProcessResp = {
  status?: string;
  status_detail?: string | null;
  redirect?: string | null;
  pix?: {
    qr_code?: string | null;
    qr_code_base64?: string | null;
  };
  error?: string;
};

type LeadStatusResp = {
  status: string;
  amount_cents: number | null;
  slots?: {
    cap: number;
    used: number;
    available: number;
  };
  lead?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    payer_cpf?: string | null;
    store_name?: string | null;
    website?: string | null;
  };
  pix?: {
    qr_code: string;
    qr_code_base64: string;
  } | null;
};

const STATUS_DETAIL_MSG: Record<string, string> = {
  cc_rejected_insufficient_amount: "Saldo insuficiente.",
  cc_rejected_bad_filled_card_number: "Número do cartão inválido.",
  cc_rejected_other_reason: "Pagamento recusado pelo banco emissor.",
};

function GestaoTrafegoCheckoutPage() {
  const navigate = useNavigate();
  const { lead, s } = Route.useSearch();
  const { slots, loading: slotsLoading, refetch: refetchSlots } = useLeadAvailableSlots();
  const [loadingGate, setLoadingGate] = useState(true);
  const [gateError, setGateError] = useState<string | null>(null);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [website, setWebsite] = useState("");

  const [payer, setPayer] = useState<PayerForm>({
    name: "",
    email: "",
    cpf: "",
    phone: "",
  });
  const [payerErrors, setPayerErrors] = useState<Partial<Record<keyof PayerForm, string>>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [started, setStarted] = useState<StartResp | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [localSlots, setLocalSlots] = useState(slots);

  useEffect(() => {
    setLocalSlots(slots);
  }, [slots]);

  const onSlotsFromStatus = useCallback(
    (statusSlots?: LeadStatusResp["slots"]) => {
      if (!statusSlots) return;
      setLocalSlots((current) => applyLeadSlotsFromStatus(current, statusSlots));
    },
    [],
  );

  const { mp, sdkError } = useMercadoPago(
    started?.mp_public_key ?? null,
    "gestao_checkout.mp_sdk_failed",
  );
  const amount = started?.amount_cents ?? LEAD_MANAGEMENT_PRICE_CENTS;
  const priceLabel = formatLeadManagementPrice(amount);

  useEffect(() => {
    if (!lead || !s) {
      setGateError("Link incompleto. Envie o formulário novamente na página de gestão.");
      setLoadingGate(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const j = await callDiagnosisApi<LeadStatusResp>("lead-payment-status", {
          query: { lead, s },
        });
        if (!alive) return;
        const paid = j.status === "paid";
        setAlreadyPaid(paid);
        onSlotsFromStatus(j.slots);
        if (paid) return;
        if (j.lead) {
          setStoreName(j.lead.store_name ?? "");
          setWebsite(j.lead.website ?? "");
          setPayer({
            name: j.lead.name ?? "",
            email: j.lead.email ?? "",
            cpf: j.lead.payer_cpf ?? "",
            phone: j.lead.phone ?? "",
          });
        }
      } catch (e) {
        if (alive) {
          setGateError(e instanceof Error ? e.message : "Erro ao carregar");
        }
      } finally {
        if (alive) setLoadingGate(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [lead, s, onSlotsFromStatus]);

  const onApproved = useCallback(() => {
    if (!lead || !s) return;
    void refetchSlots();
    navigate({ to: "/gestao-obrigado-lead", search: { lead, s } });
  }, [lead, s, navigate, refetchSlots]);

  const ensureStarted = useCallback(async (): Promise<StartResp | null> => {
    if (started) return started;
    if (!lead || !s) return null;

    const payerParsed = payerSchema.safeParse(payer);
    const pe: Partial<Record<keyof PayerForm, string>> = {};
    if (!payerParsed.success) {
      payerParsed.error.issues.forEach((iss) => {
        const k = iss.path[0] as keyof PayerForm;
        if (!pe[k]) pe[k] = iss.message;
      });
    }
    setPayerErrors(pe);
    if (!payerParsed.success) return null;

    setSubmitting(true);
    setGlobalError(null);
    try {
      const r = await callDiagnosisApi<StartResp>("start-lead-payment", {
        method: "POST",
        body: JSON.stringify({
          lead_id: lead,
          access_slug: s,
          payer: {
            ...payerParsed.data,
            cpf: onlyDigits(payerParsed.data.cpf),
            phone: onlyDigits(payerParsed.data.phone),
          },
        }),
      });
      setStarted(r);
      trackMetaLead(GESTAO_PRODUCT, lead, { order_id: lead });
      trackMetaAddPaymentInfo(GESTAO_PRODUCT, { order_id: lead });
      return r;
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Erro ao iniciar pagamento");
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [lead, s, payer, started]);

  if (loadingGate || slotsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lead || !s || gateError || alreadyPaid || localSlots.available <= 0) {
    const slotsFull = !alreadyPaid && localSlots.available <= 0;
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-md rounded-xl border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">
            {alreadyPaid
              ? "Vaga já garantida"
              : slotsFull
                ? "Vagas esgotadas este mês"
                : "Checkout indisponível"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {alreadyPaid
              ? "O pagamento desta vaga já foi confirmado."
              : slotsFull
                ? "As vagas de gestão deste mês já foram preenchidas. Fale no WhatsApp para lista de espera."
                : gateError ?? "Não foi possível abrir o checkout."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {alreadyPaid && lead && s ? (
              <Link
                to="/gestao-obrigado-lead"
                search={{ lead, s }}
                className="text-sm font-medium text-primary underline"
              >
                Ver confirmação
              </Link>
            ) : null}
            <Link
              to="/gestao-trafego"
              search={{}}
              className="text-sm text-muted-foreground underline"
            >
              Voltar para a página de gestão
            </Link>
            <a
              href={whatsappGestaoHref("Olá! Preciso de ajuda com o checkout de gestão de tráfego.")}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground underline"
            >
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-3">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight">{GESTAO_PRODUCT_NAME}</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-12 pt-6">
        <LeadFunnelSlotsBadge
          available={localSlots.available}
          loading={slotsLoading}
          variant="banner"
        />

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground">Resumo do pedido</h2>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{GESTAO_PRODUCT_NAME}</p>
              <p className="text-xs text-muted-foreground">1ª mensalidade · cobrança mensal</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary tabular-nums leading-none">
                {priceLabel}
              </div>
              <div className="text-xs font-semibold text-primary/80">/mês</div>
            </div>
          </div>
          <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs leading-snug text-muted-foreground">
            {method === "card" ? leadRecurrenceNoteCard(priceLabel) : GESTAO_RECURRENCE_NOTE_PIX}
          </p>
        </section>

        <section className="mt-4 rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 text-center">
          <h3 className="text-lg font-semibold">{GESTAO_PRODUCT_NAME}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{GESTAO_PRODUCT_TAGLINE}</p>
        </section>

        <section className="mt-6">
          <h3 className="text-base font-semibold">O que está incluído</h3>
          <ul className="mt-3 space-y-2.5">
            {GESTAO_DELIVERABLES.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 space-y-3">
          <GestaoSocialProof />
          <GestaoOperatorCard />
        </section>

        <section className="mt-6">
          <GestaoNextSteps />
        </section>

        {globalError ? (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {globalError}
          </div>
        ) : null}

        {(storeName || website) ? (
          <section className="mt-8 rounded-lg border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Sua loja</h3>
            {storeName ? <p className="mt-2 text-sm font-medium">{storeName}</p> : null}
            {website ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">{website}</p>
            ) : null}
          </section>
        ) : null}

        <section className="mt-8">
          <h3 className="text-lg font-semibold">Seus dados</h3>
          <div className="mt-4 space-y-4">
            <Field label="Nome completo" id="name" value={payer.name}
              onChange={(v) => setPayer((p) => ({ ...p, name: v }))}
              error={payerErrors.name} disabled={!!started} />
            <Field label="E-mail" id="email" value={payer.email}
              onChange={(v) => setPayer((p) => ({ ...p, email: v }))}
              error={payerErrors.email} disabled={!!started} type="email" />
            <Field label="WhatsApp" id="phone" value={maskPhone(payer.phone)}
              onChange={(v) => setPayer((p) => ({ ...p, phone: v }))}
              error={payerErrors.phone} disabled={!!started} />
            <Field label="CPF" id="cpf" value={maskCpf(payer.cpf)}
              onChange={(v) => setPayer((p) => ({ ...p, cpf: v }))}
              error={payerErrors.cpf} disabled={!!started} />
          </div>
        </section>

        <section className="mt-8 space-y-4">
          <GestaoGuaranteeBlock />
          <h3 className="text-lg font-semibold">Pagamento</h3>
          <div className="grid grid-cols-2 gap-2">
            <MethodButton active={method === "pix"} onClick={() => setMethod("pix")} icon={QrCode} label="Pix" hint={GESTAO_PAYMENT_METHOD_HINTS.pix} />
            <MethodButton active={method === "card"} onClick={() => setMethod("card")} icon={CreditCard} label="Cartão" hint={GESTAO_PAYMENT_METHOD_HINTS.card} />
          </div>
          <div>
            {method === "pix" ? (
              <LeadPixSection lead={lead} s={s} started={started} ensureStarted={ensureStarted}
                starting={submitting} onApproved={onApproved} onSlotsFromStatus={onSlotsFromStatus}
                priceLabel={priceLabel} />
            ) : (
              <LeadCardSection started={started} ensureStarted={ensureStarted} starting={submitting}
                mp={mp} sdkError={sdkError} amount={amount} lead={lead} s={s} payerCpf={payer.cpf}
                onApproved={onApproved} priceLabel={priceLabel}
                cardConsentLabel={leadCardConsentLabel(priceLabel)} />
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Sem fidelidade · Cancele a qualquer momento · Pagamento seguro Mercado Pago
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {gestaoUrgencyText()}
        </p>

        <div className="mt-8">
          <GestaoResultsGallery />
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/gestao-trafego-obrigado"
            search={{ lead, s }}
            className="text-sm text-muted-foreground underline"
          >
            Voltar à proposta
          </Link>
        </div>
      </main>
    </div>
  );
}

function Field({
  label, id, value, onChange, error, disabled, placeholder, type = "text",
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  error?: string; disabled?: boolean; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
        disabled={disabled} placeholder={placeholder} className="h-11" />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function MethodButton({ active, onClick, icon: Icon, label, hint }: {
  active: boolean; onClick: () => void;
  icon: React.ComponentType<{ className?: string }>; label: string; hint?: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-4 py-3 text-sm font-semibold",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
      <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span>
      {hint ? <span className="text-[10px] font-medium opacity-80">{hint}</span> : null}
    </button>
  );
}

function LeadPixSection({ lead, s, started, ensureStarted, starting, onApproved, onSlotsFromStatus, priceLabel }: {
  lead: string; s: string; started: StartResp | null;
  ensureStarted: () => Promise<StartResp | null>; starting: boolean;
  onApproved: () => void;
  onSlotsFromStatus: (slots?: LeadStatusResp["slots"]) => void;
  priceLabel: string;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pix, setPix] = useState<{ qr_code: string; qr_code_base64: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const onPoll = useCallback(async () => {
    const j = await callDiagnosisApi<LeadStatusResp>("lead-payment-status", {
      query: { lead, s },
    });
    onSlotsFromStatus(j.slots);
    if (j.status === "paid") {
      onApproved();
      return "stop" as const;
    }
    return "continue" as const;
  }, [lead, s, onApproved, onSlotsFromStatus]);

  const { pollError, retryNow } = useDiagnosisPoll({
    enabled: Boolean(pix),
    intervalMs: 3000,
    onTick: onPoll,
  });

  const generate = useCallback(async () => {
    setErr(null);
    const st = await ensureStarted();
    if (!st) return;
    setLoading(true);
    try {
      const resp = await callDiagnosisApi<ProcessResp>("process-lead-payment", {
        method: "POST",
        body: JSON.stringify({ lead_id: lead, access_slug: s, method: "pix" }),
      });
      if (resp.pix?.qr_code && resp.pix?.qr_code_base64) {
        setPix({ qr_code: resp.pix.qr_code, qr_code_base64: resp.pix.qr_code_base64 });
      } else {
        setErr("Não foi possível gerar o PIX.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [lead, s, ensureStarted]);

  if (!pix) {
    return (
      <div className="space-y-3">
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        <Button onClick={generate} disabled={loading || starting} className="h-12 w-full">
          {loading || starting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando Pix…</> : `Pagar 1ª mensalidade com Pix — ${priceLabel}/mês`}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <img alt="QR PIX" src={`data:image/png;base64,${pix.qr_code_base64}`} className="mx-auto h-56 w-56" />
      <div className="flex gap-2">
        <Input value={pix.qr_code} readOnly className="font-mono text-xs" />
        <Button type="button" variant="outline" onClick={async () => {
          await navigator.clipboard.writeText(pix.qr_code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Aguardando confirmação…
      </div>
      {pollError ? <InlineErrorBanner message={pollError} onRetry={retryNow} /> : null}
    </div>
  );
}

function LeadCardSection({ started, ensureStarted, starting, mp, sdkError, amount, lead, s, payerCpf, onApproved, priceLabel, cardConsentLabel }: {
  started: StartResp | null; ensureStarted: () => Promise<StartResp | null>; starting: boolean;
  mp: MpInstance | null; sdkError: string | null; amount: number;
  lead: string; s: string; payerCpf: string; onApproved: () => void; priceLabel: string;
  cardConsentLabel: string;
}) {
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!consent) {
      setErr("Confirme a autorização da cobrança mensal para continuar.");
      return;
    }
    const st = await ensureStarted();
    if (!st || !mp) return;
    setLoading(true);
    try {
      const num = onlyDigits(number);
      const pm = await mp.getPaymentMethods({ bin: num.slice(0, 8) });
      const card = pm.results.find((r) => r.payment_type_id === "credit_card");
      if (!card) { setErr("Cartão não suportado."); return; }
      const token = await mp.createCardToken({
        cardNumber: num,
        cardholderName: holder.trim(),
        cardExpirationMonth: onlyDigits(expiry).slice(0, 2),
        cardExpirationYear: "20" + onlyDigits(expiry).slice(2, 4),
        securityCode: cvv,
        identificationType: "CPF",
        identificationNumber: onlyDigits(payerCpf) || "00000000000",
      });
      const resp = await callDiagnosisApi<ProcessResp>("process-lead-payment", {
        method: "POST",
        body: JSON.stringify({
          lead_id: lead,
          access_slug: s,
          method: "card",
          card: { token: token.id, payment_method_id: card.id, installments: 1 },
        }),
      });
      if (resp.status === "approved") onApproved();
      else setErr(STATUS_DETAIL_MSG[resp.status_detail ?? ""] ?? "Pagamento recusado");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {sdkError ? <InlineErrorBanner message={sdkError} onRetry={() => window.location.reload()} /> : null}
      <Input placeholder="Número do cartão" value={maskCardNumber(number)} onChange={(e) => setNumber(e.target.value)} className="h-11" />
      <Input placeholder="Nome no cartão" value={holder} onChange={(e) => setHolder(e.target.value.toUpperCase())} className="h-11" />
      <div className="grid grid-cols-2 gap-4">
        <Input placeholder="MM/AA" value={maskExpiry(expiry)} onChange={(e) => setExpiry(e.target.value)} className="h-11" />
        <Input placeholder="CVV" value={onlyDigits(cvv).slice(0, 4)} onChange={(e) => setCvv(e.target.value)} className="h-11" />
      </div>
      <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer"
        />
        <span className="leading-snug text-muted-foreground">{cardConsentLabel}</span>
      </label>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <Button type="submit" disabled={loading || starting || !consent} className="h-12 w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Ativar assinatura — {priceLabel}/mês
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        Cobrança automática mensal pelo Mercado Pago · Cancele quando quiser
      </p>
    </form>
  );
}
