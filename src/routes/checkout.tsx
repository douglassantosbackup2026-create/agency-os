import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  Loader2,
  CreditCard,
  QrCode,
  Copy,
  Check,
  CircleCheck,
  ShieldCheck,
  Lock,
  Zap,
  Sparkles,
  Clock,
  Mail,
} from "lucide-react";

import { invokeDiagnosisFunction } from "@/lib/diagnosis-invoke";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
// Product copy
// ============================================================
const PRODUCT_NAME = "Diagnóstico Meta Ads";
const PRODUCT_TAGLINE = "Auditoria completa + plano de ação priorizado";
const DELIVERABLES = [
  "Auditoria completa da sua conta de anúncios",
  "Análise de campanhas, criativos e públicos",
  "Plano de ação priorizado por impacto",
  "Identificação de desperdício de verba",
  "Recomendações de estrutura e segmentação",
  "Relatório em PDF pronto para apresentar",
  "Acesso imediato após a confirmação do pagamento",
];

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

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
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
  auto_login_token?: string | null;
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

async function apiStatus(
  d: string,
  s: string,
): Promise<{ status: string; auto_login_token: string | null }> {
  const res = await invokeDiagnosisFunction("diagnosis-payment-status", {
    method: "GET",
    query: { d, s },
  });
  const j = (await res.json()) as {
    status?: string;
    auto_login_token?: string | null;
  };
  return {
    status: j.status ?? "unknown",
    auto_login_token: j.auto_login_token ?? null,
  };
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

const DEFAULT_AMOUNT_CENTS = 3700;

// ============================================================
// Urgency bar (countdown 30min, persistent in sessionStorage)
// ============================================================
const URGENCY_MS = 30 * 60 * 1000;
const URGENCY_KEY = "checkout_deadline";

function UrgencyBar() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = Number(sessionStorage.getItem(URGENCY_KEY));
    const deadline =
      stored && stored > Date.now() ? stored : Date.now() + URGENCY_MS;
    if (!stored || stored <= Date.now()) {
      sessionStorage.setItem(URGENCY_KEY, String(deadline));
    }
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (remaining === null || remaining === 0) return null;

  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const fmt = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return (
    <div
      className="bg-gradient-to-r from-destructive to-primary text-primary-foreground"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-xl items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium sm:text-sm">
        <Clock className="h-4 w-4 shrink-0" />
        <span className="uppercase tracking-wide">Oferta expira em</span>
        <span className="font-mono text-base font-bold tabular-nums">{fmt}</span>
      </div>
    </div>
  );
}

// ============================================================
// Component
// ============================================================
function CheckoutPage() {
  const navigate = useNavigate();
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
  const [method, setMethod] = useState<"pix" | "card">("pix");

  const mp = useMercadoPago(started?.mp_public_key ?? null);
  const amount = started?.amount_cents ?? DEFAULT_AMOUNT_CENTS;

  const ensureStarted = useCallback(async (): Promise<StartResp | null> => {
    if (started) return started;
    const parsed = payerSchema.safeParse(payer);
    if (!parsed.success) {
      const fe: Partial<Record<keyof PayerForm, string>> = {};
      parsed.error.issues.forEach((iss) => {
        const k = iss.path[0] as keyof PayerForm;
        if (!fe[k]) fe[k] = iss.message;
      });
      setErrors(fe);
      // scroll to first error
      if (typeof window !== "undefined") {
        const first = Object.keys(fe)[0];
        if (first) {
          document.getElementById(first)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
      return null;
    }
    setErrors({});
    setSubmitting(true);
    setGlobalError(null);
    try {
      const r = await apiStart(parsed.data);
      setStarted(r);
      return r;
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Erro ao iniciar pagamento");
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [payer, started]);

  const onApproved = useCallback(
    (d: string, s: string, t?: string | null) =>
      navigate({
        to: "/obrigado",
        search: { d, s, ...(t ? { t } : {}) } as never,
      }),
    [navigate],
  );

  return (
    <div className="min-h-screen bg-background">
      <UrgencyBar />

      {/* Brand bar */}
      <header className="border-b">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight">{PRODUCT_NAME}</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-12 pt-6">
        {/* Order summary */}
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Resumo do pedido
          </h2>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-sm text-foreground">{PRODUCT_NAME}</span>
            <span className="text-sm tabular-nums text-foreground">
              {formatBRL(amount)}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t pt-3">
            <span className="text-base font-semibold">Total</span>
            <span className="text-2xl font-bold tabular-nums text-primary">
              {formatBRL(amount)}
            </span>
          </div>
        </section>

        {/* Product hero card */}
        <section className="mt-4 rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="mt-3 text-lg font-semibold">{PRODUCT_NAME}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{PRODUCT_TAGLINE}</p>
        </section>

        {/* Deliverables */}
        <section className="mt-6">
          <h3 className="text-base font-semibold">Você vai receber:</h3>
          <ul className="mt-3 space-y-2.5">
            {DELIVERABLES.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span className="text-foreground/90">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Guarantee */}
        <section className="mt-6 space-y-2.5 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-2.5 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              <span className="font-semibold">Garantia de 7 dias:</span> se o diagnóstico
              não te ajudar a identificar oportunidades reais, você pode solicitar
              reembolso integral dentro do prazo.
            </p>
          </div>
          <div className="flex items-start gap-2.5 text-sm">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              <span className="font-semibold">Compra segura.</span> Seus dados são
              processados pelo Mercado Pago e usados apenas para liberar seu acesso.
            </p>
          </div>
        </section>

        {/* Trust chips */}
        <section className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <TrustChip icon={Zap} label="Acesso imediato" />
          <TrustChip icon={Lock} label="Compra segura" />
          <TrustChip icon={ShieldCheck} label="Garantia 7 dias" />
        </section>

        {globalError ? (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {globalError}
          </div>
        ) : null}

        {/* Payer form */}
        <section className="mt-8">
          <h3 className="text-lg font-semibold">Seus dados</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Use o mesmo e-mail em que você quer receber o diagnóstico.
          </p>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={payer.name}
                onChange={(e) => setPayer((p) => ({ ...p, name: e.target.value }))}
                autoComplete="name"
                maxLength={100}
                disabled={!!started}
                className="h-11"
              />
              {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={payer.email}
                onChange={(e) => setPayer((p) => ({ ...p, email: e.target.value }))}
                autoComplete="email"
                maxLength={160}
                disabled={!!started}
                className="h-11"
              />
              {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input
                id="phone"
                inputMode="tel"
                value={maskPhone(payer.phone)}
                onChange={(e) => setPayer((p) => ({ ...p, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
                disabled={!!started}
                className="h-11"
              />
              {errors.phone ? <p className="text-xs text-destructive">{errors.phone}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                inputMode="numeric"
                value={maskCpf(payer.cpf)}
                onChange={(e) => setPayer((p) => ({ ...p, cpf: e.target.value }))}
                placeholder="000.000.000-00"
                disabled={!!started}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Obrigatório para emitir a cobrança no seu nome.
              </p>
              {errors.cpf ? <p className="text-xs text-destructive">{errors.cpf}</p> : null}
            </div>
          </div>
        </section>

        {/* Payment method toggle */}
        <section className="mt-8">
          <h3 className="text-lg font-semibold">Pagamento</h3>
          <div
            role="radiogroup"
            aria-label="Forma de pagamento"
            className="mt-3 grid grid-cols-2 gap-2"
          >
            <MethodButton
              active={method === "pix"}
              onClick={() => setMethod("pix")}
              icon={QrCode}
              label="Pix"
            />
            <MethodButton
              active={method === "card"}
              onClick={() => setMethod("card")}
              icon={CreditCard}
              label="Cartão"
            />
          </div>

          <div className="mt-5">
            {method === "pix" ? (
              <PixSection
                started={started}
                ensureStarted={ensureStarted}
                starting={submitting}
                onApproved={onApproved}
              />
            ) : (
              <CardSection
                started={started}
                ensureStarted={ensureStarted}
                starting={submitting}
                mp={mp}
                amount={amount}
                onApproved={onApproved}
              />
            )}
          </div>
        </section>

        {/* Footer trust */}
        <footer className="mt-8 grid grid-cols-2 gap-3 border-t pt-6 text-xs text-muted-foreground sm:grid-cols-4">
          <FooterItem icon={Lock} label="Pagamento seguro" />
          <FooterItem icon={Zap} label="Acesso imediato" />
          <FooterItem icon={ShieldCheck} label="Garantia 7 dias" />
          <FooterItem icon={Mail} label="Suporte por e-mail" />
        </footer>
      </main>
    </div>
  );
}

// ============================================================
// Small UI atoms
// ============================================================
function TrustChip({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-foreground/80">
      <Icon className="h-3.5 w-3.5 text-primary" />
      {label}
    </span>
  );
}

function MethodButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function FooterItem({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

// ============================================================
// PIX section
// ============================================================
function PixSection({
  started,
  ensureStarted,
  starting,
  onApproved,
}: {
  started: StartResp | null;
  ensureStarted: () => Promise<StartResp | null>;
  starting: boolean;
  onApproved: (d: string, s: string, t?: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pix, setPix] = useState<{
    qr_code: string;
    qr_code_base64: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generate = useCallback(async () => {
    setErr(null);
    const s = await ensureStarted();
    if (!s) return;
    setLoading(true);
    try {
      const resp = await apiProcess({
        diagnosis_id: s.diagnosis_id,
        secret_slug: s.secret_slug,
        method: "pix",
      });
      if (resp.pix?.qr_code && resp.pix?.qr_code_base64) {
        setPix({
          qr_code: resp.pix.qr_code,
          qr_code_base64: resp.pix.qr_code_base64,
        });
      } else {
        setErr("Não foi possível gerar o PIX. Tente novamente.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [ensureStarted]);

  useEffect(() => {
    if (!pix || !started) return;
    pollRef.current = setInterval(async () => {
      try {
        const { status, auto_login_token } = await apiStatus(
          started.diagnosis_id,
          started.secret_slug,
        );
        if (status !== "awaiting_payment") {
          if (pollRef.current) clearInterval(pollRef.current);
          onApproved(started.diagnosis_id, started.secret_slug, auto_login_token);
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
      <div className="space-y-3">
        {err ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {err}
          </div>
        ) : null}
        <Button
          onClick={generate}
          disabled={loading || starting}
          className="h-12 w-full text-base font-semibold"
        >
          {loading || starting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando Pix…
            </>
          ) : (
            "Gerar Pix e liberar meu acesso"
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Seu acesso será liberado em segundos após a confirmação do Pix.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-background p-5">
        <img
          alt="QR Code PIX"
          src={`data:image/png;base64,${pix.qr_code_base64}`}
          className="h-56 w-56"
        />
        <p className="text-center text-sm text-muted-foreground">
          Abra o app do seu banco, escolha pagar com Pix e escaneie o QR Code.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Ou copie o código Pix</Label>
        <div className="flex gap-2">
          <Input value={pix.qr_code} readOnly className="font-mono text-xs" />
          <Button type="button" variant="outline" onClick={copy} className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Aguardando confirmação do pagamento…
      </div>
    </div>
  );
}

// ============================================================
// Card section
// ============================================================
function CardSection({
  started,
  ensureStarted,
  starting,
  mp,
  amount,
  onApproved,
}: {
  started: StartResp | null;
  ensureStarted: () => Promise<StartResp | null>;
  starting: boolean;
  mp: MpInstance | null;
  amount: number;
  onApproved: (d: string, s: string, t?: string | null) => void;
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
      const num = onlyDigits(number);
      const exp = onlyDigits(expiry);
      if (num.length < 13) return setErr("Número do cartão inválido");
      if (!holder.trim()) return setErr("Informe o nome impresso no cartão");
      if (exp.length !== 4) return setErr("Validade inválida (MM/AA)");
      if (cvv.length < 3) return setErr("CVV inválido");

      const s = await ensureStarted();
      if (!s) return;
      if (!mp) {
        setErr("Aguardando carregamento do Mercado Pago…");
        return;
      }

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
          diagnosis_id: s.diagnosis_id,
          secret_slug: s.secret_slug,
          method: "card",
          card: {
            token: token.id,
            payment_method_id: card.id,
            issuer_id: issuerId,
            installments: 1,
          },
        });
        if (resp.status === "approved") {
          onApproved(s.diagnosis_id, s.secret_slug);
        } else if (resp.status === "in_process" || resp.status === "pending") {
          setErr("Pagamento em análise. Você receberá um e-mail assim que for aprovado.");
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
    [mp, number, holder, expiry, cvv, ensureStarted, onApproved],
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cardNumber">Número do cartão</Label>
        <Input
          id="cardNumber"
          inputMode="numeric"
          autoComplete="cc-number"
          value={maskCardNumber(number)}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="0000 0000 0000 0000"
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="holder">Nome impresso no cartão</Label>
        <Input
          id="holder"
          autoComplete="cc-name"
          value={holder}
          onChange={(e) => setHolder(e.target.value.toUpperCase())}
          placeholder="NOME COMO IMPRESSO"
          maxLength={50}
          className="h-11"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="expiry">Validade</Label>
          <Input
            id="expiry"
            inputMode="numeric"
            autoComplete="cc-exp"
            value={maskExpiry(expiry)}
            onChange={(e) => setExpiry(e.target.value)}
            placeholder="MM/AA"
            maxLength={5}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cvv">CVV</Label>
          <Input
            id="cvv"
            inputMode="numeric"
            autoComplete="cc-csc"
            value={onlyDigits(cvv).slice(0, 4)}
            onChange={(e) => setCvv(e.target.value)}
            placeholder="000"
            maxLength={4}
            className="h-11"
          />
        </div>
      </div>

      {err ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={loading || starting}
        className="h-12 w-full text-base font-semibold"
      >
        {loading || starting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando pagamento…
          </>
        ) : (
          `Pagar ${formatBRL(amount)} e liberar meu acesso`
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Seus dados são criptografados e enviados direto ao Mercado Pago.
        Acesso imediato após a aprovação.
      </p>
    </form>
  );
}
