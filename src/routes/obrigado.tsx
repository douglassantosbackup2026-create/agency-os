import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { invokeDiagnosisFunction } from "@/lib/diagnosis-invoke";
import { resolveSupabaseUrl } from "@/lib/supabase-config";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type ObrigadoSearch = {
  d?: string;
  s?: string;
  t?: string;
  oauth_error?: string;
};

type StatusPayload = {
  status?: string;
  failed_reason?: string | null;
  meta_ad_account_id?: string | null;
};

export const Route = createFileRoute("/obrigado")({
  validateSearch: (search: Record<string, unknown>): ObrigadoSearch => ({
    d: typeof search.d === "string" ? search.d : undefined,
    s: typeof search.s === "string" ? search.s : undefined,
    t: typeof search.t === "string" ? search.t : undefined,
    oauth_error:
      typeof search.oauth_error === "string" ? search.oauth_error : undefined,
  }),
  component: ObrigadoPage,
});

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  token: "Não foi possível obter o token de acesso da Meta. Tente novamente.",
  noadaccounts:
    "A conta Meta ligada não tem contas de anúncios ativas. Verifique as permissões e tente novamente.",
  access_denied:
    "Acesso negado. Autorize o acesso de leitura (ads_read) para continuar.",
};

type AutoLoginState =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "ready"; email: string }
  | { kind: "saved" }
  | { kind: "error"; message: string };

const POLL_MS = 5000;

function ObrigadoPage() {
  const navigate = useNavigate();
  const { d, s, t, oauth_error } = Route.useSearch();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [pollErr, setPollErr] = useState<string | null>(null);
  const [waitedSec, setWaitedSec] = useState(0);
  const [nextPollIn, setNextPollIn] = useState(POLL_MS / 1000);

  // Client-only to avoid SSR hydration mismatch on window.location
  const [fullLink, setFullLink] = useState<string>("");
  useEffect(() => {
    if (!d || !s) return;
    const envBase =
      typeof import.meta.env.VITE_PUBLIC_SITE_URL === "string" &&
      import.meta.env.VITE_PUBLIC_SITE_URL.trim()
        ? import.meta.env.VITE_PUBLIC_SITE_URL.replace(/\/+$/, "")
        : "";
    const base =
      envBase || (typeof window !== "undefined" ? window.location.origin : "");
    setFullLink(
      `${base}/obrigado?d=${encodeURIComponent(d)}&s=${encodeURIComponent(s)}`,
    );
  }, [d, s]);

  useEffect(() => {
    if (!d || !s) return;
    try {
      localStorage.setItem(`diagnosis_${d}`, s);
    } catch {
      /* ignore */
    }
  }, [d, s]);

  // ---- Auto-login via magiclink token ---------------------------------
  const [auto, setAuto] = useState<AutoLoginState>({ kind: "idle" });

  useEffect(() => {
    if (!t || auto.kind !== "idle") return;
    let cancelled = false;
    (async () => {
      setAuto({ kind: "verifying" });
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          type: "magiclink",
          token_hash: t,
        });
        if (cancelled) return;
        if (error || !data.user?.email) {
          setAuto({
            kind: "error",
            message: error?.message ?? "Não foi possível autenticar.",
          });
          return;
        }
        setAuto({ kind: "ready", email: data.user.email });
        if (d && s) {
          navigate({
            to: "/obrigado",
            search: { d, s } as never,
            replace: true,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setAuto({
            kind: "error",
            message: e instanceof Error ? e.message : "Erro ao autenticar",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t, auto.kind, d, s, navigate]);

  // ---- Status polling -------------------------------------------------
  useEffect(() => {
    if (!d || !s) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await invokeDiagnosisFunction("diagnosis-status", {
          query: { d, s },
        });
        const j = (await res.json()) as StatusPayload & { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Erro ao consultar estado");
        if (alive) {
          setStatus(j);
          setPollErr(null);
          setNextPollIn(POLL_MS / 1000);
        }
      } catch (e) {
        if (alive) setPollErr(e instanceof Error ? e.message : "Erro");
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    const sec = window.setInterval(() => {
      if (!alive) return;
      setWaitedSec((x) => x + 1);
      setNextPollIn((x) => (x <= 1 ? POLL_MS / 1000 : x - 1));
    }, 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearInterval(sec);
    };
  }, [d, s]);

  const oauthBase = () => {
    const u = resolveSupabaseUrl();
    return u ? `${u}/functions/v1/meta-oauth-start` : "";
  };

  const metaUrl = useMemo(
    () =>
      d && s
        ? `${oauthBase()}?d=${encodeURIComponent(d)}&s=${encodeURIComponent(s)}`
        : "",
    [d, s],
  );

  if (!d || !s) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="mx-auto max-w-xl px-4 py-16">
          <div className="rounded-2xl border bg-card p-8 text-card-foreground shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">
              Link incompleto
            </h1>
            <p className="mt-2 text-muted-foreground">
              Use o link completo da página de obrigado (com parâmetros d e s)
              que recebeste após o pagamento.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
            >
              Voltar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const st = status?.status;
  const currentStepIndex =
    st === "completed"
      ? 3
      : st === "processing"
        ? 2
        : st === "awaiting_connection"
          ? 1
          : st === "failed"
            ? 1
            : 0; // awaiting_payment / unknown -> step 1 active (Pagamento)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <Stepper currentIndex={currentStepIndex} failed={st === "failed"} />

        {/* Hero confirmation */}
        <SuccessHero />

        {/* Save link — collapsible */}
        <SaveLinkBlock fullLink={fullLink} />

        {/* Password card */}
        {(auto.kind === "verifying" ||
          auto.kind === "ready" ||
          auto.kind === "saved" ||
          auto.kind === "error") && (
          <SetPasswordCard auto={auto} setAuto={setAuto} />
        )}

        {/* OAuth error */}
        {oauth_error ? (
          <OAuthErrorCard
            errorKey={oauth_error}
            metaUrl={metaUrl}
            canRetry={Boolean(d && s)}
          />
        ) : null}

        {/* Status-specific blocks */}
        {st === "awaiting_connection" ? (
          <ConnectMetaCard metaUrl={metaUrl} />
        ) : null}

        {/* Meta connected confirmation (after successful OAuth) */}
        {(st === "processing" || st === "completed") &&
        status?.meta_ad_account_id ? (
          <MetaConnectedCard adAccountId={status.meta_ad_account_id} />
        ) : null}

        {st === "awaiting_payment" ? (
          <AwaitingPaymentCard
            waitedSec={waitedSec}
            nextPollIn={nextPollIn}
          />
        ) : null}

        {st === "processing" ? <ProcessingCard pollErr={pollErr} /> : null}

        {st === "completed" ? (
          <div className="mt-4 rounded-2xl border bg-card p-6 shadow-sm animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold tracking-tight">
                  O teu diagnóstico está pronto
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Já podes consultar o relatório completo com insights e
                  recomendações.
                </p>
                <Link
                  to="/diagnostico/$diagnosisId"
                  params={{ diagnosisId: d }}
                  search={{ s }}
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
                >
                  Ver diagnóstico
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {st === "failed" ? (
          <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <h2 className="text-lg font-semibold text-destructive">
                  Algo correu mal
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {status?.failed_reason ?? "Erro desconhecido"}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {pollErr && st !== "processing" && st !== "awaiting_payment" ? (
          <p className="mt-4 text-sm text-muted-foreground">{pollErr}</p>
        ) : null}

        <TrustFooter />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stepper                                                                    */
/* -------------------------------------------------------------------------- */

function Stepper({
  currentIndex,
  failed,
}: {
  currentIndex: number;
  failed: boolean;
}) {
  const steps = ["Pagamento", "Conectar Meta", "Diagnóstico"];
  return (
    <ol className="mb-8 flex items-center gap-2 sm:gap-3">
      {steps.map((label, i) => {
        const done = i < currentIndex || (i === 0 && currentIndex >= 1);
        const current = i === currentIndex && !failed;
        const isFailed = failed && i === currentIndex;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : current
                      ? "border-primary bg-primary/10 text-primary ring-4 ring-primary/15"
                      : isFailed
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-border bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={[
                  "hidden text-sm font-medium sm:inline",
                  done || current
                    ? "text-foreground"
                    : "text-muted-foreground",
                ].join(" ")}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="h-px flex-1 bg-border">
                <div
                  className="h-px bg-primary transition-all"
                  style={{ width: done ? "100%" : "0%" }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function SuccessHero() {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8 animate-fade-in">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 animate-scale-in dark:text-emerald-400">
          <CheckCircle2 className="h-9 w-9" strokeWidth={2.25} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Pagamento confirmado
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
          Estamos a preparar o teu diagnóstico Meta Ads. Segue os próximos
          passos abaixo.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Save link (collapsible)                                                    */
/* -------------------------------------------------------------------------- */

function SaveLinkBlock({ fullLink }: { fullLink: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (!fullLink) return;
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      toast.success("Link copiado");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="mt-4 rounded-2xl border bg-card shadow-sm">
      <Accordion type="single" collapsible>
        <AccordionItem value="link" className="border-none">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Guardar link de acesso{" "}
              <span className="text-muted-foreground">(recomendado)</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-5">
            <p className="text-sm text-muted-foreground">
              Guarda este link nos favoritos. É a forma mais rápida de voltar
              aqui caso saias do navegador.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <code
                className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 text-xs"
                title={fullLink}
              >
                {fullLink || "…"}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCopy}
                disabled={!fullLink}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Connect Meta                                                               */
/* -------------------------------------------------------------------------- */

function ConnectMetaCard({ metaUrl }: { metaUrl: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm animate-fade-in">
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold tracking-tight">
              Conectar Meta Ads
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Acesso <strong className="text-foreground">somente de leitura</strong>.
              Podes revogar nas configurações da Meta a qualquer momento.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <PermissionList
            title="O que vamos ler"
            tone="positive"
            items={["Campanhas e conjuntos", "Métricas (90 dias)", "Criativos publicados"]}
          />
          <PermissionList
            title="O que nunca fazemos"
            tone="negative"
            items={["Alterar ou pausar anúncios", "Publicar em teu nome", "Aceder a mensagens"]}
          />
        </div>

        <a
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 sm:w-auto"
          href={metaUrl}
        >
          Conectar Meta Ads
          <span className="ml-2">→</span>
        </a>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Acesso ads_read · Revogável a qualquer momento
        </p>
      </div>
    </div>
  );
}

function PermissionList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "positive" | "negative";
  items: string[];
}) {
  return (
    <div className="rounded-xl border bg-background/60 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1.5 text-sm">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2">
            {tone === "positive" ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                ✗
              </span>
            )}
            <span className={tone === "negative" ? "text-muted-foreground" : ""}>
              {it}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Awaiting payment                                                           */
/* -------------------------------------------------------------------------- */

function AwaitingPaymentCard({
  waitedSec,
  nextPollIn,
}: {
  waitedSec: number;
  nextPollIn: number;
}) {
  const tookLong = waitedSec > 60;
  return (
    <div className="mt-4 rounded-2xl border bg-card p-6 shadow-sm animate-fade-in">
      <div className="flex items-start gap-3">
        <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-primary" />
        <div className="flex-1">
          <h2 className="text-base font-semibold tracking-tight">
            A confirmar com Mercado Pago…
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta página atualiza automaticamente. Próxima verificação em{" "}
            <span className="font-medium text-foreground">{nextPollIn}s</span>.
          </p>
          {tookLong ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Verificar agora
              </Button>
              <span className="text-xs text-muted-foreground">
                A demorar mais que o normal? Fala connosco no fim da página.
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Processing                                                                 */
/* -------------------------------------------------------------------------- */

function ProcessingCard({ pollErr }: { pollErr: string | null }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1500);
    return () => window.clearInterval(id);
  }, []);
  // Animated checklist progression (visual only)
  const progress = Math.min(95, 25 + tick * 4);
  const steps = [
    { label: "Ligação Meta estabelecida", at: 0 },
    { label: "A extrair dados das campanhas (90 dias)", at: 25 },
    { label: "A analisar performance e gerar insights", at: 55 },
    { label: "A preparar relatório", at: 80 },
  ];

  return (
    <div className="mt-4 rounded-2xl border bg-card p-6 shadow-sm animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold tracking-tight">
            A preparar o teu diagnóstico
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Normalmente demora 2 a 4 minutos. Podes fechar esta aba — voltamos
            a abrir pelo link guardado.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <Progress value={progress} className="h-1.5" />
      </div>

      <ul className="mt-5 space-y-2.5">
        {steps.map((s) => {
          const done = progress >= s.at + 15;
          const active = !done && progress >= s.at;
          return (
            <li
              key={s.label}
              className="flex items-center gap-3 text-sm transition"
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : active ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-border" />
              )}
              <span
                className={
                  done
                    ? "text-foreground"
                    : active
                      ? "text-foreground"
                      : "text-muted-foreground"
                }
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>

      {pollErr ? (
        <p className="mt-4 text-xs text-destructive">{pollErr}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* OAuth error                                                                */
/* -------------------------------------------------------------------------- */

function MetaConnectedCard({ adAccountId }: { adAccountId: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-sm animate-fade-in">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <div className="flex-1">
          <h2 className="text-base font-semibold tracking-tight">
            Meta Ads conectada com sucesso
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Conta de anúncios ligada:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {adAccountId}
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}

function OAuthErrorCard({
  errorKey,
  metaUrl,
  canRetry,
}: {
  errorKey: string;
  metaUrl: string;
  canRetry: boolean;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
        <div className="flex-1">
          <h2 className="text-base font-semibold tracking-tight">
            Não conseguimos ligar à Meta
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {OAUTH_ERROR_MESSAGES[errorKey] ?? `Erro: ${errorKey}`}
          </p>
          {canRetry ? (
            <a
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
              href={metaUrl}
            >
              Tentar novamente
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Trust footer                                                               */
/* -------------------------------------------------------------------------- */

function TrustFooter() {
  return (
    <div className="mt-10 flex flex-col items-center gap-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3 w-3" /> Dados encriptados
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> Acesso somente leitura
        </span>
        <span>Suporte: 2h em média</span>
      </div>
      <div className="flex gap-3">
        <Link to="/privacidade" className="hover:underline">
          Privacidade
        </Link>
        <span>·</span>
        <Link to="/termos" className="hover:underline">
          Termos
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Password card                                                              */
/* -------------------------------------------------------------------------- */

function passwordStrength(pw: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  tone: string;
} {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const s = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const map = [
    { label: "Muito fraca", tone: "bg-destructive" },
    { label: "Fraca", tone: "bg-destructive" },
    { label: "Razoável", tone: "bg-amber-500" },
    { label: "Boa", tone: "bg-emerald-500" },
    { label: "Forte", tone: "bg-emerald-600" },
  ];
  return { score: s, label: map[s].label, tone: map[s].tone };
}

function SetPasswordCard({
  auto,
  setAuto,
}: {
  auto: AutoLoginState;
  setAuto: (s: AutoLoginState) => void;
}) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (auto.kind === "verifying") {
    return (
      <div className="mt-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>A ativar o teu acesso…</span>
        </div>
      </div>
    );
  }

  if (auto.kind === "error") {
    return (
      <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6 animate-fade-in">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Não foi possível ativar o acesso automaticamente
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{auto.message}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Sem stress — ainda tens acesso ao diagnóstico pelo link guardado.
              Podes criar a tua conta depois com o e-mail do checkout.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (auto.kind === "saved") {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 animate-fade-in">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Senha definida
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A tua conta está pronta. Podes entrar quando quiseres com o teu
              e-mail e essa senha.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (auto.kind !== "ready") return null;

  const strength = passwordStrength(pw);
  const match = pw.length > 0 && pw === pw2;
  const lengthOk = pw.length >= 8;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!lengthOk) {
      setErr("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (pw !== pw2) {
      setErr("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setAuto({ kind: "saved" });
      toast.success("Senha definida com sucesso");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Erro ao salvar senha");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border bg-card p-6 shadow-sm animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Defina a sua senha de acesso
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Criámos a conta com o e-mail{" "}
            <strong className="text-foreground">{auto.email}</strong>. Define
            uma senha para voltares quando quiseres.
          </p>

          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw">Nova senha</Label>
              <div className="relative">
                <Input
                  id="pw"
                  type={show ? "text" : "password"}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((x) => !x)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                >
                  {show ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {pw.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={[
                          "h-1 flex-1 rounded-full transition",
                          i < strength.score ? strength.tone : "bg-muted",
                        ].join(" ")}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Força: <span className="font-medium">{strength.label}</span>
                    {!lengthOk ? " · mínimo 8 caracteres" : null}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pw2">Confirmar senha</Label>
              <Input
                id="pw2"
                type={show ? "text" : "password"}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              {pw2.length > 0 && (
                <p
                  className={[
                    "flex items-center gap-1 text-xs",
                    match ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {match ? <Check className="h-3 w-3" /> : null}
                  {match ? "As senhas coincidem" : "As senhas ainda não coincidem"}
                </p>
              )}
            </div>

            {err ? <p className="text-sm text-destructive">{err}</p> : null}

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A guardar…
                </>
              ) : (
                "Definir senha e ativar conta"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
