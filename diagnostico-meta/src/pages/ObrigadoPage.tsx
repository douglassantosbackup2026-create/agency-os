import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { invokeFunction } from "@/lib/invoke";

type StatusPayload = {
  status?: string;
  failed_reason?: string | null;
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  token: "Não foi possível obter o token de acesso da Meta. Tenta novamente.",
  noadaccounts:
    "A conta Meta ligada não tem contas de anúncios ativas. Verifica as permissões e tenta novamente.",
  access_denied:
    "Acesso negado. Autoriza o acesso de leitura (ads_read) para continuar.",
};

export function ObrigadoPage() {
  const { d, s, oauth_error } = useSearch({ strict: false }) as {
    d?: string;
    s?: string;
    oauth_error?: string;
  };
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [pollErr, setPollErr] = useState<string | null>(null);

  const fullLink = useMemo(() => {
    if (!d || !s) return "";
    const base =
      typeof import.meta.env.VITE_PUBLIC_SITE_URL === "string"
        ? import.meta.env.VITE_PUBLIC_SITE_URL.replace(/\/+$/, "")
        : window.location.origin;
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

  useEffect(() => {
    if (!d || !s) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await invokeFunction("diagnosis-status", {
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
      <div className="container">
        <div className="card">
          <h1>Link incompleto</h1>
          <p className="muted">
            Usa o link completo da página de obrigado (com parâmetros d e s) que
            recebeste após o pagamento.
          </p>
          <Link to="/" className="btn btn-outline">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const st = status?.status;
  const metaUrl = `${oauthBase()}?d=${encodeURIComponent(d)}&s=${encodeURIComponent(s)}`;

  return (
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
          <strong>Sem e-mail:</strong> guarda este link (cópia ou favoritos). É
          a única forma de voltares aqui.
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
            Acesso <strong>só de leitura</strong> (ads_read). Podes revogar nas
            definições da Meta.
          </p>
          <a className="btn btn-primary" href={metaUrl}>
            Conectar Meta Ads
          </a>
        </div>
      ) : null}

      {st === "awaiting_payment" ? (
        <div className="card">
          <p>
            A aguardar confirmação do Mercado Pago… Esta página atualiza
            automaticamente.
          </p>
        </div>
      ) : null}

      {st === "processing" ? (
        <div className="card">
          <h2>A processar</h2>
          <p>
            A extrair dados e a gerar o diagnóstico (normalmente alguns
            minutos). Podes fechar o separador — desde que guardes o link acima.
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
  );
}
