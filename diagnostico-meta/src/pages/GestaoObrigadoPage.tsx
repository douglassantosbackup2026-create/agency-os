import { Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { invokeFunction } from "@/lib/invoke";
import {
  buildGestaoIntroMessage,
  whatsappGestaoHref,
} from "@/lib/gestao-whatsapp";

type StatusPayload = {
  management_status?: string | null;
  management_business_name?: string | null;
};

const POLL_MS = 5000;
const TIMEOUT_MS = 180_000;

export function GestaoObrigadoPage() {
  const { d, s } = useSearch({ strict: false }) as {
    d?: string;
    s?: string;
  };
  const [snapshot, setSnapshot] = useState<StatusPayload | null>(null);
  const [pollErr, setPollErr] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

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
    const started = Date.now();
    let intervalId = 0;

    const stop = () => {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = 0;
    };

    const tick = async (): Promise<"stop" | "continue"> => {
      if (!alive) return "stop";
      if (Date.now() - started > TIMEOUT_MS) {
        setTimedOut(true);
        return "stop";
      }
      try {
        const res = await invokeFunction("diagnosis-status", {
          query: { d, s },
        });
        const j = (await res.json()) as StatusPayload & { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Erro ao consultar estado");
        if (!alive) return "stop";
        setSnapshot(j);
        setPollErr(null);
        if (j.management_status === "paid") {
          setTimedOut(false);
          return "stop";
        }
        return "continue";
      } catch (e) {
        if (alive) setPollErr(e instanceof Error ? e.message : "Erro");
        return "continue";
      }
    };

    const run = async () => {
      const first = await tick();
      if (!alive || first === "stop") return;
      intervalId = window.setInterval(() => {
        void (async () => {
          const r = await tick();
          if (r === "stop") stop();
        })();
      }, POLL_MS);
    };

    void run();

    return () => {
      alive = false;
      stop();
    };
  }, [d, s]);

  const waHref = useMemo(() => {
    if (!d) return "";
    const name =
      snapshot?.management_status === "paid"
        ? snapshot.management_business_name
        : null;
    return whatsappGestaoHref(
      buildGestaoIntroMessage({ diagnosisId: d, storeName: name }),
    );
  }, [d, snapshot?.management_status, snapshot?.management_business_name]);

  if (!d || !s) {
    return (
      <div className="container">
        <div className="card">
          <h1>Link incompleto</h1>
          <p className="muted">
            Usa o link completo voltando do Mercado Pago (parâmetros d e s).
          </p>
          <Link to="/" className="btn btn-outline">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const confirmed = snapshot?.management_status === "paid";

  return (
    <div className="container">
      <div className="steps">
        <span className="step done">1. Diagnóstico</span>
        <span className="step done">2. Gestão — pagamento</span>
        <span className={confirmed ? "step done" : "step current"}>
          3. Confirmação
        </span>
      </div>

      <div className="card">
        <h1 style={{ marginTop: 0 }}>Gestão de tráfego</h1>
        {!confirmed ? (
          <p>
            {timedOut
              ? "Ainda não recebemos a confirmação final do Mercado Pago nesta página. O pagamento pode demorar alguns minutos — actualiza dentro de instantes ou abre novamente este link pelo teu relatório."
              : "A aguardar confirmação do Mercado Pago… Esta página atualiza automaticamente."}
          </p>
        ) : (
          <>
            <p>
              Pagamento confirmado para o pedido ligado ao teu diagnóstico (ID{" "}
              <code>{d}</code>). Próximo passo: WhatsApp connosco.
            </p>
            <p className="muted">
              Se o botão não abrir, volta ao relatório através do link que
              guardaste.
            </p>
          </>
        )}
        {pollErr ? <p style={{ color: "#b91c1c" }}>{pollErr}</p> : null}
      </div>

      {(confirmed || timedOut) && waHref ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Falar connosco</h2>
          <a
            className="btn btn-primary"
            href={waHref}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp — próximos passos
          </a>
          <div style={{ marginTop: "1rem" }}>
            <Link
              to="/diagnostico/$diagnosisId"
              params={{ diagnosisId: d }}
              search={{ s, gestaoCheckout: undefined }}
              className="btn btn-outline"
            >
              Voltar ao relatório
            </Link>
          </div>
        </div>
      ) : null}

      {!confirmed ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Estado da gestão:{" "}
          <strong>{snapshot?.management_status ?? "…"}</strong>
        </p>
      ) : null}
    </div>
  );
}
