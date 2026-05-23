import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { invokeDiagnosisFunction } from "@/lib/diagnosis-invoke";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import "@/styles/diagnosis.css";

type ObrigadoSearch = {
  d?: string;
  s?: string;
  t?: string;
  oauth_error?: string;
};

type StatusPayload = {
  status?: string;
  failed_reason?: string | null;
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

function ObrigadoPage() {
  const navigate = useNavigate();
  const { d, s, t, oauth_error } = Route.useSearch();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [pollErr, setPollErr] = useState<string | null>(null);

  const fullLink = useMemo(() => {
    if (!d || !s) return "";
    const envBase =
      typeof import.meta.env.VITE_PUBLIC_SITE_URL === "string" &&
      import.meta.env.VITE_PUBLIC_SITE_URL.trim()
        ? import.meta.env.VITE_PUBLIC_SITE_URL.replace(/\/+$/, "")
        : "";
    const base =
      envBase || (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}/obrigado?d=${encodeURIComponent(d)}&s=${encodeURIComponent(s)}`;
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
        // remove token from URL so it cannot be replayed
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
        }
      } catch (e) {
        if (alive) setPollErr(e instanceof Error ? e.message : "Erro");
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [d, s]);

  const oauthBase = () => {
    const u = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
    return u ? `${u}/functions/v1/meta-oauth-start` : "";
  };

  if (!d || !s) {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <div className="card">
            <h1>Link incompleto</h1>
            <p className="muted">
              Use o link completo da página de obrigado (com parâmetros d e s)
              que recebeste após o pagamento.
            </p>
            <Link to="/" className="btn btn-outline">
              Voltar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const st = status?.status;
  const metaUrl = `${oauthBase()}?d=${encodeURIComponent(d)}&s=${encodeURIComponent(s)}`;

  return (
    <div className="diagnosis-funnel">
      <div className="container">
        <div className="steps">
          <span className="step done">1. Pagamento</span>
          <span
            className={
              st === "awaiting_connection" || st === "awaiting_payment"
                ? "step current"
                : "step done"
            }
          >
            2. Conectar Meta
          </span>
          <span
            className={
              st === "processing"
                ? "step current"
                : st === "completed"
                  ? "step done"
                  : "step"
            }
          >
            3. Diagnóstico
          </span>
        </div>

        <div className="card">
          <h1 style={{ marginTop: 0 }}>Pagamento recebido</h1>
          <p className="muted">
            <strong>Guarde este link</strong> (cópia ou favoritos). É a forma
            mais rápida de voltar aqui caso saia do navegador.
          </p>
          <p>
            <code style={{ wordBreak: "break-all", fontSize: "0.85rem" }}>
              {fullLink}
            </code>
          </p>
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginTop: "0.5rem" }}
            onClick={() => void navigator.clipboard.writeText(fullLink)}
          >
            Copiar link
          </button>
        </div>

        {/* Set password card */}
        {(auto.kind === "verifying" ||
          auto.kind === "ready" ||
          auto.kind === "saved" ||
          auto.kind === "error") && (
          <SetPasswordCard auto={auto} setAuto={setAuto} />
        )}

        {oauth_error ? (
          <div className="card" style={{ borderColor: "#b91c1c" }}>
            <h2 style={{ color: "#b91c1c" }}>Erro ao conectar Meta</h2>
            <p>{OAUTH_ERROR_MESSAGES[oauth_error] ?? `Erro: ${oauth_error}`}</p>
            {d && s ? (
              <a
                className="btn btn-primary"
                href={metaUrl}
                style={{ marginTop: "0.75rem", display: "inline-block" }}
              >
                Tentar novamente
              </a>
            ) : null}
          </div>
        ) : null}

        {st === "awaiting_connection" ? (
          <div className="card">
            <h2>Conectar Meta Ads</h2>
            <p>
              Acesso <strong>somente de leitura</strong> (ads_read). Você pode
              revogar nas configurações da Meta.
            </p>
            <a className="btn btn-primary" href={metaUrl}>
              Conectar Meta Ads
            </a>
          </div>
        ) : null}

        {st === "awaiting_payment" ? (
          <div className="card">
            <p>
              Aguardando confirmação do Mercado Pago… Esta página atualiza
              automaticamente.
            </p>
          </div>
        ) : null}

        {st === "processing" ? (
          <div className="card">
            <h2>Processando</h2>
            <p>
              Extraindo dados e gerando o diagnóstico (normalmente alguns
              minutos). Você pode fechar a aba — desde que guarde o link acima.
            </p>
            {pollErr ? <p style={{ color: "#b91c1c" }}>{pollErr}</p> : null}
          </div>
        ) : null}

        {st === "completed" ? (
          <div className="card">
            <h2>Pronto</h2>
            <Link
              to="/diagnostico/$diagnosisId"
              params={{ diagnosisId: d }}
              search={{ s }}
              className="btn btn-primary"
            >
              Ver diagnóstico
            </Link>
          </div>
        ) : null}

        {st === "failed" ? (
          <div className="card">
            <h2>Falhou</h2>
            <p>{status?.failed_reason ?? "Erro desconhecido"}</p>
          </div>
        ) : null}

        {pollErr && st !== "processing" ? (
          <p className="muted">{pollErr}</p>
        ) : null}
      </div>
    </div>
  );
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
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (auto.kind === "verifying") {
    return (
      <div className="card">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Ativando seu acesso…</span>
        </div>
      </div>
    );
  }

  if (auto.kind === "error") {
    return (
      <div className="card" style={{ borderColor: "#b91c1c" }}>
        <h2 style={{ color: "#b91c1c", marginTop: 0 }}>
          Não foi possível ativar o acesso automaticamente
        </h2>
        <p className="muted">{auto.message}</p>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Sem problemas — você ainda tem acesso ao diagnóstico pelo link acima.
          Se quiser criar sua conta depois, use o e-mail informado no checkout
          para definir uma senha.
        </p>
      </div>
    );
  }

  if (auto.kind === "saved") {
    return (
      <div
        className="card"
        style={{
          borderColor: "hsl(var(--primary, 222 84% 44%))",
          background: "hsl(var(--primary, 222 84% 44%) / 0.06)",
        }}
      >
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 style={{ marginTop: 0 }}>Senha definida!</h2>
            <p className="muted">
              Sua conta está pronta. Você pode entrar a qualquer momento com seu
              e-mail e essa senha.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ready
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) {
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
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Erro ao salvar senha");
    } finally {
      setSaving(false);
    }
  };

  if (auto.kind !== "ready") return null;

  return (
    <div className="card">
      <div className="flex items-start gap-2">
        <KeyRound className="mt-0.5 h-5 w-5 text-primary" />
        <div style={{ flex: 1 }}>
          <h2 style={{ marginTop: 0 }}>Defina sua senha de acesso</h2>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Criamos sua conta automaticamente com o e-mail{" "}
            <strong>{auto.email}</strong>. Defina uma senha para entrar de novo
            quando quiser.
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw">Nova senha (mínimo 8 caracteres)</Label>
              <Input
                id="pw"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw2">Confirmar senha</Label>
              <Input
                id="pw2"
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            {err ? (
              <p className="text-sm" style={{ color: "#b91c1c" }}>
                {err}
              </p>
            ) : null}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando…
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
