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
  Clock,
  TrendingUp,
} from "lucide-react";

import { callDiagnosisApi } from "@/lib/diagnosis-api";
import { useDiagnosisPoll } from "@/hooks/use-diagnosis-poll";
import { useMercadoPago, type MpInstance } from "@/hooks/use-mercadopago-sdk";
import { InlineErrorBanner } from "@/components/diagnosis-funnel/InlineErrorBanner";
import { reportFunnelError } from "@/lib/report-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  GESTAO_AVAILABLE_SLOTS,
  GESTAO_CARD_CONSENT,
  GESTAO_DELIVERABLES,
  GESTAO_PAYMENT_METHOD_HINTS,
  GESTAO_PRODUCT_NAME,
  GESTAO_PRODUCT_TAGLINE,
  GESTAO_RECURRENCE_NOTE_CARD,
  GESTAO_RECURRENCE_NOTE_PIX,
  DEFAULT_MANAGEMENT_PRICE_CENTS,
  formatManagementPrice,
  gestaoUrgencyText,
} from "@/content/gestao-checkout";
import {
  GESTAO_PRODUCT,
  trackMetaAddPaymentInfo,
  trackMetaPurchase,
} from "@/lib/meta-pixel";
import { whatsappGestaoHref } from "@/lib/gestao-whatsapp";
import {
  GestaoGuaranteeBlock,
  GestaoNextSteps,
  GestaoOperatorCard,
  GestaoSocialProof,
} from "@/components/gestao/GestaoCheckoutBlocks";

type GestaoSearch = { d?: string; s?: string; gap?: string };

export const Route = createFileRoute("/gestao-checkout")({
  validateSearch: (search: Record<string, unknown>): GestaoSearch => ({
    d: typeof search.d === "string" ? search.d : undefined,
    s: typeof search.s === "string" ? search.s : undefined,
    gap: typeof search.gap === "string" ? search.gap : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Checkout — Gestão de Tráfego Meta Ads" },
      {
        name: "description",
        content: "Contrate gestão de tráfego com pagamento seguro via cartão ou PIX.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GestaoCheckoutPage,
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

const storeSchema = z.object({
  business_name: z.string().trim().min(2, "Nome da loja obrigatório").max(240),
  website: z.string().trim().min(4, "Site obrigatório").max(500),
  instagram: z.string().trim().min(2, "Instagram obrigatório").max(240),
});

type PayerForm = z.infer<typeof payerSchema>;
type StoreForm = z.infer<typeof storeSchema>;

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
  diagnosis_id: string;
  secret_slug: string;
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

const STATUS_DETAIL_MSG: Record<string, string> = {
  cc_rejected_insufficient_amount: "Saldo insuficiente.",
  cc_rejected_bad_filled_card_number: "Número do cartão inválido.",
  cc_rejected_other_reason: "Pagamento recusado pelo banco emissor.",
};

function GestaoCheckoutPage() {
  const navigate = useNavigate();
  const { d, s, gap } = Route.useSearch();
  const [loadingGate, setLoadingGate] = useState(true);
  const [gateError, setGateError] = useState<string | null>(null);
  const [eligible, setEligible] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  const [store, setStore] = useState<StoreForm>({
    business_name: "",
    website: "",
    instagram: "",
  });
  const [payer, setPayer] = useState<PayerForm>({
    name: "",
    email: "",
    cpf: "",
    phone: "",
  });
  const [storeErrors, setStoreErrors] = useState<Partial<Record<keyof StoreForm, string>>>({});
  const [payerErrors, setPayerErrors] = useState<Partial<Record<keyof PayerForm, string>>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [started, setStarted] = useState<StartResp | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<"pix" | "card">("pix");

  const { mp, sdkError } = useMercadoPago(
    started?.mp_public_key ?? null,
    "gestao_checkout.mp_sdk_failed",
  );
  const amount = started?.amount_cents ?? DEFAULT_MANAGEMENT_PRICE_CENTS;

  useEffect(() => {
    if (!d || !s) {
      setGateError("Link incompleto. Abra pelo botão do seu relatório de diagnóstico.");
      setLoadingGate(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const j = await callDiagnosisApi<{
          diagnosis?: {
            management_status?: string | null;
            management_business_name?: string | null;
            management_website?: string | null;
            management_instagram?: string | null;
            payer_name?: string | null;
            payer_email?: string | null;
            payer_cpf?: string | null;
            payer_phone?: string | null;
          };
          report?: { management_cta_eligible?: boolean } | null;
        }>("diagnosis-report", { query: { d, s } });
        if (!alive) return;
        const paid = j.diagnosis?.management_status === "paid";
        const ok = Boolean(j.report?.management_cta_eligible) && !paid;
        setEligible(ok);
        setAlreadyPaid(paid);
        if (!ok && !paid) {
          setGateError("Esta conta não está elegível para contratar gestão neste momento.");
        }
        setStore({
          business_name: j.diagnosis?.management_business_name ?? "",
          website: j.diagnosis?.management_website ?? "",
          instagram: j.diagnosis?.management_instagram ?? "",
        });
        setPayer({
          name: j.diagnosis?.payer_name ?? "",
          email: j.diagnosis?.payer_email ?? "",
          cpf: j.diagnosis?.payer_cpf ?? "",
          phone: j.diagnosis?.payer_phone ?? "",
        });
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
  }, [d, s]);

  const onApproved = useCallback(() => {
    if (!d || !s) return;
    trackMetaPurchase(GESTAO_PRODUCT, d);
    navigate({ to: "/gestao-obrigado", search: { d, s } });
  }, [d, s, navigate]);

  const ensureStarted = useCallback(async (): Promise<StartResp | null> => {
    if (started) return started;
    if (!d || !s) return null;

    const storeParsed = storeSchema.safeParse(store);
    const payerParsed = payerSchema.safeParse(payer);
    const se: Partial<Record<keyof StoreForm, string>> = {};
    const pe: Partial<Record<keyof PayerForm, string>> = {};
    if (!storeParsed.success) {
      storeParsed.error.issues.forEach((iss) => {
        const k = iss.path[0] as keyof StoreForm;
        if (!se[k]) se[k] = iss.message;
      });
    }
    if (!payerParsed.success) {
      payerParsed.error.issues.forEach((iss) => {
        const k = iss.path[0] as keyof PayerForm;
        if (!pe[k]) pe[k] = iss.message;
      });
    }
    setStoreErrors(se);
    setPayerErrors(pe);
    if (!storeParsed.success || !payerParsed.success) return null;

    setSubmitting(true);
    setGlobalError(null);
    try {
      const r = await callDiagnosisApi<StartResp>("start-management-payment", {
        method: "POST",
        body: JSON.stringify({
          diagnosis_id: d,
          secret_slug: s,
          business_name: storeParsed.data.business_name,
          website: storeParsed.data.website,
          instagram: storeParsed.data.instagram,
          payer: {
            ...payerParsed.data,
            cpf: onlyDigits(payerParsed.data.cpf),
            phone: onlyDigits(payerParsed.data.phone),
          },
        }),
      });
      setStarted(r);
      trackMetaAddPaymentInfo(GESTAO_PRODUCT, { order_id: d });
      return r;
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Erro ao iniciar pagamento");
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [d, s, store, payer, started]);

  if (loadingGate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!d || !s || gateError || alreadyPaid || !eligible) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-md rounded-xl border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">
            {alreadyPaid ? "Gestão já contratada" : "Checkout indisponível"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {alreadyPaid
              ? "O pagamento desta gestão já foi confirmado."
              : gateError ?? "Não foi possível abrir o checkout."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {d && s ? (
              <Link
                to="/diagnostico/$diagnosisId"
                params={{ diagnosisId: d }}
                search={{ s }}
                className="text-sm font-medium text-primary underline"
              >
                Voltar ao relatório
              </Link>
            ) : null}
            <a
              href={whatsappGestaoHref("Olá! Preciso de ajuda com o checkout de gestão.")}
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
        {GESTAO_AVAILABLE_SLOTS > 0 ? (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Apenas {GESTAO_AVAILABLE_SLOTS}{" "}
              {GESTAO_AVAILABLE_SLOTS === 1 ? "vaga disponível" : "vagas disponíveis"} neste mês
            </span>
          </div>
        ) : null}

        {gap ? (
          <p className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            Oportunidade identificada no diagnóstico:{" "}
            <strong className="text-primary">{gap}</strong>/mês
          </p>
        ) : null}

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground">Resumo do pedido</h2>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{GESTAO_PRODUCT_NAME}</p>
              <p className="text-xs text-muted-foreground">1ª mensalidade · cobrança mensal</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary tabular-nums leading-none">
                {formatManagementPrice(amount)}
              </div>
              <div className="text-xs font-semibold text-primary/80">/mês</div>
            </div>
          </div>
          <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs leading-snug text-muted-foreground">
            {GESTAO_RECURRENCE_NOTE}
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

        <section className="mt-8">
          <h3 className="text-lg font-semibold">Dados da loja</h3>
          <p className="text-xs text-muted-foreground">
            Confirme os dados detectados do seu diagnóstico ou edite se algo estiver desatualizado.
          </p>
          <div className="mt-4 space-y-4">
            <Field label="Nome da loja" id="business_name" value={store.business_name}
              onChange={(v) => setStore((p) => ({ ...p, business_name: v }))}
              error={storeErrors.business_name} disabled={!!started} />
            <Field label="Site principal" id="website" value={store.website}
              onChange={(v) => setStore((p) => ({ ...p, website: v }))}
              error={storeErrors.website} disabled={!!started} placeholder="https://..." />
            <Field label="Instagram" id="instagram" value={store.instagram}
              onChange={(v) => setStore((p) => ({ ...p, instagram: v }))}
              error={storeErrors.instagram} disabled={!!started} placeholder="@loja" />
          </div>
        </section>

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
            <MethodButton active={method === "pix"} onClick={() => setMethod("pix")} icon={QrCode} label="Pix" />
            <MethodButton active={method === "card"} onClick={() => setMethod("card")} icon={CreditCard} label="Cartão" />
          </div>
          <div>
            {method === "pix" ? (
              <GestaoPixSection d={d} s={s} started={started} ensureStarted={ensureStarted}
                starting={submitting} onApproved={onApproved} />
            ) : (
              <GestaoCardSection started={started} ensureStarted={ensureStarted} starting={submitting}
                mp={mp} sdkError={sdkError} amount={amount} d={d} s={s} payerCpf={payer.cpf}
                onApproved={onApproved} />
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Sem fidelidade · Cancele a qualquer momento · Pagamento seguro Mercado Pago
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {gestaoUrgencyText()}
        </p>

        <div className="mt-6 text-center">
          <Link
            to="/diagnostico/$diagnosisId"
            params={{ diagnosisId: d }}
            search={{ s }}
            className="text-sm text-muted-foreground underline"
          >
            Voltar ao relatório
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

function MethodButton({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void;
  icon: React.ComponentType<{ className?: string }>; label: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
      <Icon className="h-4 w-4" />{label}
    </button>
  );
}

function GestaoPixSection({ d, s, started, ensureStarted, starting, onApproved }: {
  d: string; s: string; started: StartResp | null;
  ensureStarted: () => Promise<StartResp | null>; starting: boolean;
  onApproved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pix, setPix] = useState<{ qr_code: string; qr_code_base64: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const onPoll = useCallback(async () => {
    const j = await callDiagnosisApi<{ management_status?: string }>("management-payment-status", {
      query: { d, s },
    });
    if (j.management_status === "paid") {
      onApproved();
      return "stop" as const;
    }
    return "continue" as const;
  }, [d, s, onApproved]);

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
      const resp = await callDiagnosisApi<ProcessResp>("process-management-payment", {
        method: "POST",
        body: JSON.stringify({ diagnosis_id: d, secret_slug: s, method: "pix" }),
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
  }, [d, s, ensureStarted]);

  if (!pix) {
    return (
      <div className="space-y-3">
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        <Button onClick={generate} disabled={loading || starting} className="h-12 w-full">
          {loading || starting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando Pix…</> : "Pagar 1ª mensalidade com Pix — R$ 1.997/mês"}
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

function GestaoCardSection({ started, ensureStarted, starting, mp, sdkError, amount, d, s, payerCpf, onApproved }: {
  started: StartResp | null; ensureStarted: () => Promise<StartResp | null>; starting: boolean;
  mp: MpInstance | null; sdkError: string | null; amount: number;
  d: string; s: string; payerCpf: string; onApproved: () => void;
}) {
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
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
      const resp = await callDiagnosisApi<ProcessResp>("process-management-payment", {
        method: "POST",
        body: JSON.stringify({
          diagnosis_id: d,
          secret_slug: s,
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
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <Button type="submit" disabled={loading || starting} className="h-12 w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Pagar 1ª mensalidade — {formatManagementPrice(amount)}/mês
      </Button>
    </form>
  );
}
