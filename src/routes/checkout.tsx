import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2, CreditCard, QrCode, Copy, Check, ArrowLeft } from "lucide-react";

import { invokeDiagnosisFunction } from "@/lib/diagnosis-invoke";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Diagnóstico Meta Ads" },
      {
        name: "description",
        content:
          "Pagamento seguro do diagnóstico Meta Ads via cartão ou PIX. Acesso em ~5 minutos.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

// ============================================================
// Validation
// ============================================================
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

// ============================================================
// Masks
// ============================================================
function maskCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function maskPhone(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d)/, "($1) $2-$3").trim();
  }
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

// ============================================================
// Mercado Pago SDK loader
// ============================================================
declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      opts?: { locale?: string },
    ) => MpInstance;
  }
}

interface MpInstance {
  createCardToken: (data: {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationType: string;
    identificationNumber: string;
  }) => Promise<{ id: string; first_six_digits?: string }>;
  getPaymentMethods: (opts: {
    bin: string;
  }) => Promise<{ results: Array<{ id: string; payment_type_id: string }> }>;
  getIssuers: (opts: {
    paymentMethodId: string;
    bin: string;
  }) => Promise<Array<{ id: string }>>;
}

function useMercadoPago(publicKey: string | null): MpInstance | null {
  const [mp, setMp] = useState<MpInstance | null>(null);
  useEffect(() => {
    if (!publicKey || typeof window === "undefined") return;
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-mp-sdk="v2"]',
    );
    const init = () => {
      if (window.MercadoPago) {
        setMp(new window.MercadoPago(publicKey, { locale: "pt-BR" }));
      }
    };
    if (existing) {
      if (window.MercadoPago) init();
      else existing.addEventListener("load", init, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.async = true;
    s.dataset.mpSdk = "v2";
    s.addEventListener("load", init, { once: true });
    document.head.appendChild(s);
  }, [publicKey]);
  return mp;
}

// ============================================================
// API helpers
// ============================================================
type StartResp = {
  diagnosis_id: string;
  secret_slug: string;
  amount_cents: number;
  mp_public_key: string;
};

async function apiStart(payer: PayerForm): Promise<StartResp> {
  const res = await invokeDiagnosisFunction("start-diagnosis-payment", {
    method: "POST",
    body: JSON.stringify({
      payer: { ...payer, cpf: onlyDigits(payer.cpf), phone: onlyDigits(payer.phone) },
    }),
  });
  const j = (await res.json()) as StartResp & { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Falha ao iniciar pagamento");
  return j;
}

type ProcessResp = {
  status?: string;
  status_detail?: string | null;
  redirect?: string | null;
  pix?: {
    qr_code?: string | null;
    qr_code_base64?: string | null;
    ticket_url?: string | null;
    expires_at?: string | null;
  };
  error?: string;
};

async function apiProcess(payload: Record<string, unknown>): Promise<ProcessResp> {
  const res = await invokeDiagnosisFunction("process-diagnosis-payment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const j = (await res.json()) as ProcessResp;
  if (!res.ok) throw new Error(j.error ?? "Pagamento recusado");
  return j;
}

async function apiStatus(d: string, s: string): Promise<string> {
  const res = await invokeDiagnosisFunction("diagnosis-payment-status", {
    method: "GET",
    query: { d, s },
  });
  const j = (await res.json()) as { status?: string };
  return j.status ?? "unknown";
}

// ============================================================
// Status detail translations
// ============================================================
const STATUS_DETAIL_MSG: Record<string, string> = {
  cc_rejected_insufficient_amount: "Saldo insuficiente.",
  cc_rejected_bad_filled_card_number: "Número do cartão inválido.",
  cc_rejected_bad_filled_date: "Data de validade inválida.",
  cc_rejected_bad_filled_security_code: "Código de segurança inválido.",
  cc_rejected_bad_filled_other: "Confira os dados do cartão.",
  cc_rejected_call_for_authorize: "Autorize a compra com o seu banco e tente novamente.",
  cc_rejected_high_risk: "Pagamento recusado por análise de risco.",
  cc_rejected_other_reason: "Pagamento recusado pelo banco emissor.",
};

// ============================================================
// Component
// ============================================================
function CheckoutPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"payer" | "pay">("payer");
  const [payer, setPayer] = useState<PayerForm>({
    name: "",
    email: "",
    cpf: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof PayerForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [started, setStarted] = useState<StartResp | null>(null);

  const mp = useMercadoPago(started?.mp_public_key ?? null);

  const handlePayerSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setGlobalError(null);
      const parsed = payerSchema.safeParse(payer);
      if (!parsed.success) {
        const fe: Partial<Record<keyof PayerForm, string>> = {};
        parsed.error.issues.forEach((iss) => {
          const k = iss.path[0] as keyof PayerForm;
          if (!fe[k]) fe[k] = iss.message;
        });
        setErrors(fe);
        return;
      }
      setErrors({});
      setSubmitting(true);
      try {
        const r = await apiStart(parsed.data);
        setStarted(r);
        setStep("pay");
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : "Erro");
      } finally {
        setSubmitting(false);
      }
    },
    [payer],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <div className="text-sm font-medium">Diagnóstico Meta Ads</div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Pagamento</h1>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total
            </div>
            <div className="text-2xl font-bold">
              R$ {((started?.amount_cents ?? 3700) / 100).toFixed(2).replace(".", ",")}
            </div>
          </div>
        </div>

        {globalError ? (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {globalError}
          </div>
        ) : null}

        {step === "payer" ? (
          <form
            onSubmit={handlePayerSubmit}
            className="space-y-4 rounded-lg border bg-card p-6"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={payer.name}
                onChange={(e) => setPayer((p) => ({ ...p, name: e.target.value }))}
                autoComplete="name"
                maxLength={100}
              />
              {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={payer.email}
                onChange={(e) => setPayer((p) => ({ ...p, email: e.target.value }))}
                autoComplete="email"
                maxLength={160}
              />
              {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  value={maskCpf(payer.cpf)}
                  onChange={(e) => setPayer((p) => ({ ...p, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                />
                {errors.cpf ? <p className="text-xs text-destructive">{errors.cpf}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  value={maskPhone(payer.phone)}
                  onChange={(e) => setPayer((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                />
                {errors.phone ? (
                  <p className="text-xs text-destructive">{errors.phone}</p>
                ) : null}
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full h-11">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Continuando…
                </>
              ) : (
                "Continuar para pagamento"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Pagamento seguro processado pelo Mercado Pago.
            </p>
          </form>
        ) : null}

        {step === "pay" && started ? (
          <PaymentStep
            started={started}
            mp={mp}
            onApproved={(d, s) => navigate({ to: "/obrigado", search: { d, s } as never })}
          />
        ) : null}
      </main>
    </div>
  );
}

// ============================================================
// Payment step (card + pix)
// ============================================================
function PaymentStep({
  started,
  mp,
  onApproved,
}: {
  started: StartResp;
  mp: MpInstance | null;
  onApproved: (d: string, s: string) => void;
}) {
  const [tab, setTab] = useState<"card" | "pix">("card");
  return (
    <div className="rounded-lg border bg-card p-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "card" | "pix")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="card" className="gap-2">
            <CreditCard className="h-4 w-4" /> Cartão de crédito
          </TabsTrigger>
          <TabsTrigger value="pix" className="gap-2">
            <QrCode className="h-4 w-4" /> PIX
          </TabsTrigger>
        </TabsList>
        <TabsContent value="card" className="mt-6">
          <CardForm started={started} mp={mp} onApproved={onApproved} />
        </TabsContent>
        <TabsContent value="pix" className="mt-6">
          <PixForm started={started} onApproved={onApproved} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Card form
// ============================================================
function CardForm({
  started,
  mp,
  onApproved,
}: {
  started: StartResp;
  mp: MpInstance | null;
  onApproved: (d: string, s: string) => void;
}) {
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErr(null);
      if (!mp) {
        setErr("Aguardando carregamento do Mercado Pago…");
        return;
      }
      const num = onlyDigits(number);
      const exp = onlyDigits(expiry);
      if (num.length < 13) return setErr("Número do cartão inválido");
      if (!holder.trim()) return setErr("Informe o nome impresso no cartão");
      if (exp.length !== 4) return setErr("Validade inválida (MM/AA)");
      if (cvv.length < 3) return setErr("CVV inválido");

      setLoading(true);
      try {
        const bin = num.slice(0, 8);
        const pm = await mp.getPaymentMethods({ bin });
        const card = pm.results.find((r) => r.payment_type_id === "credit_card");
        if (!card) {
          setErr("Cartão não suportado. Tente outro.");
          return;
        }
        let issuerId: string | undefined;
        try {
          const issuers = await mp.getIssuers({ paymentMethodId: card.id, bin });
          issuerId = issuers[0]?.id;
        } catch {
          issuerId = undefined;
        }
        const token = await mp.createCardToken({
          cardNumber: num,
          cardholderName: holder.trim(),
          cardExpirationMonth: exp.slice(0, 2),
          cardExpirationYear: "20" + exp.slice(2, 4),
          securityCode: cvv,
          identificationType: "CPF",
          identificationNumber: "00000000000",
        });
        const resp = await apiProcess({
          diagnosis_id: started.diagnosis_id,
          secret_slug: started.secret_slug,
          method: "card",
          card: {
            token: token.id,
            payment_method_id: card.id,
            issuer_id: issuerId,
            installments: 1,
          },
        });
        if (resp.status === "approved" && resp.redirect) {
          onApproved(started.diagnosis_id, started.secret_slug);
        } else if (resp.status === "in_process" || resp.status === "pending") {
          setErr(
            "Pagamento em análise. Você receberá um e-mail assim que for aprovado.",
          );
        } else {
          const detail = resp.status_detail
            ? STATUS_DETAIL_MSG[resp.status_detail] ?? resp.status_detail
            : "Pagamento recusado";
          setErr(detail);
        }
      } catch (e2) {
        setErr(e2 instanceof Error ? e2.message : "Erro inesperado");
      } finally {
        setLoading(false);
      }
    },
    [mp, number, holder, expiry, cvv, started, onApproved],
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cardNumber">Número do cartão</Label>
        <Input
          id="cardNumber"
          inputMode="numeric"
          autoComplete="cc-number"
          value={maskCardNumber(number)}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="0000 0000 0000 0000"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="holder">Nome impresso no cartão</Label>
        <Input
          id="holder"
          autoComplete="cc-name"
          value={holder}
          onChange={(e) => setHolder(e.target.value.toUpperCase())}
          placeholder="NOME COMO IMPRESSO"
          maxLength={50}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="expiry">Validade</Label>
          <Input
            id="expiry"
            inputMode="numeric"
            autoComplete="cc-exp"
            value={maskExpiry(expiry)}
            onChange={(e) => setExpiry(e.target.value)}
            placeholder="MM/AA"
            maxLength={5}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cvv">CVV</Label>
          <Input
            id="cvv"
            inputMode="numeric"
            autoComplete="cc-csc"
            value={onlyDigits(cvv).slice(0, 4)}
            onChange={(e) => setCvv(e.target.value)}
            placeholder="000"
            maxLength={4}
          />
        </div>
      </div>

      {err ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      ) : null}

      <Button type="submit" disabled={loading || !mp} className="w-full h-11">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando pagamento…
          </>
        ) : (
          `Pagar R$ ${(started.amount_cents / 100).toFixed(2).replace(".", ",")}`
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Seus dados são criptografados e enviados diretamente ao Mercado Pago.
      </p>
    </form>
  );
}

// ============================================================
// PIX form
// ============================================================
function PixForm({
  started,
  onApproved,
}: {
  started: StartResp;
  onApproved: (d: string, s: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pix, setPix] = useState<{
    qr_code: string;
    qr_code_base64: string;
    expires_at: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generate = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const resp = await apiProcess({
        diagnosis_id: started.diagnosis_id,
        secret_slug: started.secret_slug,
        method: "pix",
      });
      if (resp.pix?.qr_code && resp.pix?.qr_code_base64) {
        setPix({
          qr_code: resp.pix.qr_code,
          qr_code_base64: resp.pix.qr_code_base64,
          expires_at: resp.pix.expires_at ?? null,
        });
      } else {
        setErr("Não foi possível gerar o PIX. Tente novamente.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [started]);

  // Polling status
  useEffect(() => {
    if (!pix) return;
    pollRef.current = setInterval(async () => {
      try {
        const status = await apiStatus(started.diagnosis_id, started.secret_slug);
        if (status !== "awaiting_payment") {
          if (pollRef.current) clearInterval(pollRef.current);
          onApproved(started.diagnosis_id, started.secret_slug);
        }
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pix, started, onApproved]);

  const copy = useCallback(async () => {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [pix]);

  if (!pix) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Clique no botão abaixo para gerar o QR Code do PIX. O código vale por 30 minutos.
        </p>
        {err ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {err}
          </div>
        ) : null}
        <Button onClick={generate} disabled={loading} className="w-full h-11">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando PIX…
            </>
          ) : (
            "Gerar PIX"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 rounded-md border bg-background p-6">
        <img
          alt="QR Code PIX"
          src={`data:image/png;base64,${pix.qr_code_base64}`}
          className="h-56 w-56"
        />
        <p className="text-center text-sm text-muted-foreground">
          Abra o app do seu banco, escolha pagar com PIX e escaneie o QR Code.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Ou copie o código PIX</Label>
        <div className="flex gap-2">
          <Input value={pix.qr_code} readOnly className="font-mono text-xs" />
          <Button type="button" variant="outline" onClick={copy} className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm",
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Aguardando confirmação do pagamento…
      </div>
    </div>
  );
}
