import { useEffect, useState } from "react";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { invokeFunction } from "@/lib/invoke";

type Analysis = {
  score: number;
  scoreLabel: string;
  summary: string;
  metrics?: { name: string; current: string; reference: string; status: string }[];
  criticalIssues?: { title: string; description: string; priority: string }[];
  budgetLeaks?: { title: string; estimateNote: string; hint: string }[];
  opportunities?: {
    title: string;
    potentialNote: string;
    complexity: string;
  }[];
  creativesSummary?: { best: string; worst: string; recommendation: string };
  audiencesSummary?: { segmentation: string; notes: string[] };
  structureNotes?: string[];
  actionPlan?: { step: number; action: string; impact: string; eta: string }[];
  improvementScenario?: { note: string; confidence: string };
  disclaimer?: string;
};

export function DiagnosticoPage() {
  const { diagnosisId } = useParams({ strict: false }) as {
    diagnosisId: string;
  };
  const { s } = useSearch({ strict: false }) as {
    s?: string;
  };
  const [data, setData] = useState<{
    diagnosis?: { status?: string; failed_reason?: string | null };
    report?: {
      analysis_json?: Analysis | null;
      management_cta_eligible?: boolean;
    } | null;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Diagnóstico Meta — Retentio";
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, nofollow");
  }, []);

  useEffect(() => {
    if (!s) return;
    void invokeFunction("diagnosis-track", {
      method: "POST",
      body: JSON.stringify({
        diagnosis_id: diagnosisId,
        secret_slug: s,
        event: "viewed",
      }),
    });
  }, [diagnosisId, s]);

  useEffect(() => {
    if (!s) {
      setErr("Falta o parâmetro secreto (s) na URL. Usa o link completo guardado.");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await invokeFunction("diagnosis-report", {
          query: { d: diagnosisId, s },
        });
        const j = (await res.json()) as typeof data & { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Erro");
        if (alive) setData(j);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Erro");
      }
    })();
    return () => {
      alive = false;
    };
  }, [diagnosisId, s]);

  const analysis = data?.report?.analysis_json;

  async function trackCta() {
    if (!s) return;
    await invokeFunction("diagnosis-track", {
      method: "POST",
      body: JSON.stringify({
        diagnosis_id: diagnosisId,
        secret_slug: s,
        event: "cta",
      }),
    });
  }

  if (!s) {
    return (
      <div className="container">
        <div className="card">
          <h1>Link incompleto</h1>
          <p className="muted">
            Abre o diagnóstico a partir do botão na página de obrigado (URL com
            ?s=...).
          </p>
          <Link to="/" className="btn btn-outline">
            Início
          </Link>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="container">
        <div className="card">
          <p style={{ color: "#b91c1c" }}>{err}</p>
        </div>
      </div>
    );
  }

  if (!data?.diagnosis) {
    return (
      <div className="container">
        <p className="muted">A carregar…</p>
      </div>
    );
  }

  if (data.diagnosis.status === "processing" || data.diagnosis.status === "awaiting_connection") {
    return (
      <div className="container">
        <div className="card">
          <h1>Ainda a processar</h1>
          <p className="muted">Volta em breve ou mantém a página de obrigado aberta.</p>
          <Link
            to="/obrigado"
            search={{ d: diagnosisId, s }}
            className="btn btn-outline"
          >
            Estado do pedido
          </Link>
        </div>
      </div>
    );
  }

  if (data.diagnosis.status === "failed") {
    return (
      <div className="container">
        <div className="card">
          <h1>Diagnóstico falhou</h1>
          <p>{data.diagnosis.failed_reason}</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="container">
        <p className="muted">Relatório indisponível.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="card">
        <p className="muted" style={{ margin: 0 }}>
          Diagnóstico Meta Ads
        </p>
        <h1 style={{ margin: "0.25rem 0" }}>{analysis.scoreLabel}</h1>
        <div className="score-big">{analysis.score}/100</div>
        <p>{analysis.summary}</p>
      </header>

      {analysis.metrics?.length ? (
        <section className="card">
          <h2>Métricas (resumo)</h2>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {analysis.metrics.map((m) => (
              <div
                key={m.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <strong>{m.name}</strong>
                <span>
                  {m.current} vs ref. {m.reference}{" "}
                  <span className="muted">({m.status})</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {analysis.criticalIssues?.length ? (
        <section className="card">
          <h2>Problemas críticos</h2>
          {analysis.criticalIssues.map((i) => (
            <div key={i.title} className="issue">
              <h3 style={{ margin: "0 0 0.5rem" }}>{i.title}</h3>
              <p className="muted">{i.description}</p>
              <span className={`badge badge-high`}>{i.priority}</span>
            </div>
          ))}
        </section>
      ) : null}

      {analysis.budgetLeaks?.length ? (
        <section className="card">
          <h2>Vazamentos de budget (estimativas)</h2>
          {analysis.budgetLeaks.map((b) => (
            <div key={b.title} style={{ marginBottom: "1rem" }}>
              <h3 style={{ margin: "0 0 0.35rem" }}>{b.title}</h3>
              <p className="muted">{b.estimateNote}</p>
              <p>{b.hint}</p>
            </div>
          ))}
        </section>
      ) : null}

      {analysis.opportunities?.length ? (
        <section className="card">
          <h2>Oportunidades</h2>
          <ul>
            {analysis.opportunities.map((o) => (
              <li key={o.title} style={{ marginBottom: "0.75rem" }}>
                <strong>{o.title}</strong> ({o.complexity}) — {o.potentialNote}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {analysis.creativesSummary ? (
        <section className="card">
          <h2>Criativos</h2>
          <p><strong>Melhor:</strong> {analysis.creativesSummary.best}</p>
          <p><strong>Pior:</strong> {analysis.creativesSummary.worst}</p>
          <p>{analysis.creativesSummary.recommendation}</p>
        </section>
      ) : null}

      {analysis.audiencesSummary ? (
        <section className="card">
          <h2>Públicos</h2>
          <p>{analysis.audiencesSummary.segmentation}</p>
          <ul>
            {analysis.audiencesSummary.notes?.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {analysis.structureNotes?.length ? (
        <section className="card">
          <h2>Estrutura da conta</h2>
          <ul>
            {analysis.structureNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {analysis.actionPlan?.length ? (
        <section className="card">
          <h2>Plano de ação</h2>
          <ol>
            {analysis.actionPlan.map((a) => (
              <li key={a.step} style={{ marginBottom: "0.75rem" }}>
                <strong>{a.action}</strong> — impacto {a.impact}, {a.eta}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {analysis.improvementScenario ? (
        <section className="card">
          <h2>Cenário de melhoria</h2>
          <p>{analysis.improvementScenario.note}</p>
          <p className="muted">
            Confiança: {analysis.improvementScenario.confidence}
          </p>
        </section>
      ) : null}

      {data.report?.management_cta_eligible ? (
        <section className="card" style={{ border: "2px solid #2563eb" }}>
          <h2>Gestão de tráfego</h2>
          <p>
            Queres que a nossa equipa execute este plano? Clica abaixo (abre
            contacto / checkout externo — configura o URL no código ou env).
          </p>
          <a
            className="btn btn-primary"
            href={import.meta.env.VITE_MANAGEMENT_CTA_URL ?? "#"}
            target="_blank"
            rel="noreferrer"
            onClick={() => void trackCta()}
          >
            Ver proposta de gestão
          </a>
        </section>
      ) : null}

      <p className="muted" style={{ fontSize: "0.8rem" }}>
        {analysis.disclaimer}
      </p>
    </div>
  );
}
