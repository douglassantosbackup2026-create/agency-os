import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { invokeDiagnosisFunction } from "@/lib/diagnosis-invoke";
import {
  buildGestaoIntroMessage,
  whatsappGestaoHref,
} from "@/lib/gestao-whatsapp";
import { useManagementCheckout } from "@/hooks/use-management-checkout";
import "@/styles/diagnosis.css";

type DiagnosticoSearch = { s?: string; gestaoCheckout?: string };

type Analysis = {
  score: number;
  scoreLabel: string;
  summary: string;
  metrics?: {
    name: string;
    current: string;
    reference: string;
    status: string;
  }[];
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

export const Route = createFileRoute("/diagnostico/$diagnosisId")({
  validateSearch: (search: Record<string, unknown>): DiagnosticoSearch => ({
    s: typeof search.s === "string" ? search.s : undefined,
    gestaoCheckout:
      typeof search.gestaoCheckout === "string"
        ? search.gestaoCheckout
        : undefined,
  }),
  component: DiagnosticoReportPage,
});

function DiagnosticoReportPage() {
  const { diagnosisId } = Route.useParams();
  const { s, gestaoCheckout } = Route.useSearch();
  const mgmt = useManagementCheckout();
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [data, setData] = useState<{
    diagnosis?: {
      status?: string;
      failed_reason?: string | null;
      management_status?: string | null;
      management_business_name?: string | null;
    };
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
    void invokeDiagnosisFunction("diagnosis-track", {
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
      setErr(
        "Falta o parâmetro secreto (s) na URL. Usa o link completo guardado.",
      );
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await invokeDiagnosisFunction("diagnosis-report", {
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
    await invokeDiagnosisFunction("diagnosis-track", {
      method: "POST",
      body: JSON.stringify({
        diagnosis_id: diagnosisId,
        secret_slug: s,
        event: "cta",
      }),
    });
  }

  const managementPaid = data?.diagnosis?.management_status === "paid";
  const whatsappGestaoLink = useMemo(() => {
    if (!managementPaid || !data?.diagnosis) return "";
    return whatsappGestaoHref(
      buildGestaoIntroMessage({
        diagnosisId,
        storeName: data.diagnosis.management_business_name ?? undefined,
      }),
    );
  }, [managementPaid, data?.diagnosis, diagnosisId]);

  if (!s) {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <div className="card">
            <h1>Link incompleto</h1>
            <p className="muted">
              Abra o diagnóstico pelo botão da página de obrigado (URL com
              ?s=...).
            </p>
            <Link to="/" className="btn btn-outline">
              Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <div className="card">
            <p style={{ color: "#b91c1c" }}>{err}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.diagnosis) {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <p className="muted">Carregando…</p>
        </div>
      </div>
    );
  }

  if (
    data.diagnosis.status === "processing" ||
    data.diagnosis.status === "awaiting_connection"
  ) {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <div className="card">
            <h1>Ainda processando</h1>
            <p className="muted">
              Volte em instantes ou mantenha a página de obrigado aberta.
            </p>
            <Link
              to="/obrigado"
              search={{ d: diagnosisId, s }}
              className="btn btn-outline"
            >
              Status do pedido
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (data.diagnosis.status === "failed") {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <div className="card">
            <h1>Diagnóstico falhou</h1>
            <p>{data.diagnosis.failed_reason}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="diagnosis-funnel">
        <div className="container">
          <p className="muted">Relatório indisponível.</p>
        </div>
      </div>
    );
  }

  const score = analysis.score ?? 0;
  const scoreTier = score < 40 ? "low" : score < 70 ? "mid" : "high";
  const heroPain =
    score < 40
      ? "Sua conta está sangrando dinheiro todos os dias."
      : score < 70
        ? "Você está deixando resultado em cima da mesa — e nem sabe quanto."
        : "Está bem — mas tem um teto invisível te travando.";

  const statusClass = (status: string) => {
    const s = (status ?? "").toLowerCase();
    if (/(mau|bad|baixo|crítico|critico|red|vermelho|low|alerta)/.test(s))
      return "is-bad";
    if (/(médio|medio|mid|atenção|atencao|warning|amber|amarelo)/.test(s))
      return "is-mid";
    if (/(bom|good|ok|verde|green|saudável|saudavel|high)/.test(s))
      return "is-good";
    return "";
  };

  const priorityBadge = (priority: string) => {
    const p = (priority ?? "").toLowerCase();
    if (/(alta|high|crítica|critica|urgente)/.test(p)) return "badge-high";
    if (/(média|media|medium|moderada)/.test(p)) return "badge-medium";
    return "badge-low";
  };

  return (
    <div className="diagnosis-funnel">
      <div className="container">
        <header className="card hero-card">
          <span className="eyebrow">Diagnóstico Meta Ads</span>
          <div
            className="score-big"
            style={{
              color:
                scoreTier === "low"
                  ? "#dc2626"
                  : scoreTier === "mid"
                    ? "#d97706"
                    : "#059669",
            }}
          >
            {score}
            <span style={{ fontSize: "1.5rem", color: "#94a3b8" }}>/100</span>
          </div>
          <div className={`score-bar score-${scoreTier}`}>
            <span style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
          </div>
          <h1 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.5rem" }}>
            {analysis.scoreLabel}
          </h1>
          <p className="hero-pain">{heroPain}</p>
          <p style={{ margin: 0, color: "#334155" }}>{analysis.summary}</p>
        </header>

        {analysis.metrics?.length ? (
          <section className="card">
            <h2>Onde seu dinheiro está agora</h2>
            <p className="section-hint">
              Os números reais da sua conta — comparados com o que o mercado
              está entregando. ROAS, CPA, CTR e companhia.
            </p>
            <div className="metric-grid">
              {analysis.metrics.map((m) => (
                <div key={m.name} className={`metric-card ${statusClass(m.status)}`}>
                  <div>
                    <div className="metric-name">{m.name}</div>
                    <div className="metric-ref">Referência: {m.reference}</div>
                  </div>
                  <div>
                    <div className="metric-value">{m.current}</div>
                    <div style={{ textAlign: "right", marginTop: "0.25rem" }}>
                      <span
                        className={`badge ${
                          statusClass(m.status) === "is-bad"
                            ? "badge-bad"
                            : statusClass(m.status) === "is-mid"
                              ? "badge-mid"
                              : "badge-good"
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="pain-line">
              Cada métrica vermelha = real saindo da conta sem voltar. ROAS
              baixo significa que cada R$ investido está rendendo menos do
              que poderia.
            </div>
          </section>
        ) : null}

        {analysis.criticalIssues?.length ? (
          <section className="card">
            <h2>Os buracos no seu funil</h2>
            <p className="section-hint">
              Cada um desses pontos está ativo agora — enquanto você lê isso.
            </p>
            {analysis.criticalIssues.map((i) => (
              <div key={i.title} className="issue-card">
                <div className="issue-icon">⚠️</div>
                <div>
                  <h3>{i.title}</h3>
                  <p className="muted" style={{ margin: "0 0 0.5rem" }}>
                    {i.description}
                  </p>
                  <span className={`badge ${priorityBadge(i.priority)}`}>
                    {i.priority}
                  </span>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {analysis.budgetLeaks?.length ? (
          <section className="card">
            <h2>Quanto você está queimando por mês</h2>
            <p className="section-hint">
              Estimativas baseadas no histórico recente da sua conta.
            </p>
            {analysis.budgetLeaks.map((b) => (
              <div key={b.title} className="leak-card">
                <div className="leak-icon">💸</div>
                <div>
                  <h3>{b.title}</h3>
                  <p style={{ margin: "0 0 0.35rem", fontWeight: 600, color: "#991b1b" }}>
                    {b.estimateNote}
                  </p>
                  <p className="muted" style={{ margin: 0 }}>{b.hint}</p>
                </div>
              </div>
            ))}
            <div className="pain-line">
              Some o que está aí em cima — é o custo mensal de não corrigir.
            </div>
          </section>
        ) : null}

        {analysis.opportunities?.length ? (
          <section className="card">
            <h2>O que você está deixando na mesa</h2>
            <p className="section-hint">
              Receita que existe na sua conta mas ainda não foi ativada.
            </p>
            {analysis.opportunities.map((o) => (
              <div key={o.title} className="opp-card">
                <div className="opp-icon">📈</div>
                <div>
                  <h3>{o.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>{o.potentialNote}</p>
                </div>
                <span className="badge badge-medium">{o.complexity}</span>
              </div>
            ))}
          </section>
        ) : null}

        {analysis.creativesSummary ? (
          <section className="card">
            <h2>Criativos: o que vende e o que queima</h2>
            <p className="section-hint">
              O que está funcionando — e o que está sugando budget.
            </p>
            <div className="creatives-grid">
              <div className="creative-col creative-best">
                <h4 style={{ color: "#166534" }}>✅ Melhor</h4>
                <p style={{ margin: 0 }}>{analysis.creativesSummary.best}</p>
              </div>
              <div className="creative-col creative-worst">
                <h4 style={{ color: "#991b1b" }}>❌ Pior</h4>
                <p style={{ margin: 0 }}>{analysis.creativesSummary.worst}</p>
              </div>
            </div>
            <div className="creative-reco">
              {analysis.creativesSummary.recommendation}
            </div>
          </section>
        ) : null}

        {analysis.audiencesSummary ? (
          <section className="card">
            <h2>Você está falando com as pessoas erradas?</h2>
            <p style={{ marginTop: 0 }}>
              <strong>{analysis.audiencesSummary.segmentation}</strong>
            </p>
            <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
              {analysis.audiencesSummary.notes?.map((n) => (
                <li key={n} style={{ marginBottom: "0.35rem" }}>{n}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {analysis.structureNotes?.length ? (
          <section className="card">
            <h2>A fundação da conta</h2>
            <p className="section-hint">
              Sem isso ajustado, nenhuma otimização se sustenta.
            </p>
            <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
              {analysis.structureNotes.map((n) => (
                <li key={n} style={{ marginBottom: "0.35rem" }}>{n}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {analysis.actionPlan?.length ? (
          <section className="card">
            <h2>O caminho — se quisesses fazer sozinho</h2>
            <p className="section-hint">
              Execução técnica, passo a passo. É o que a nossa equipa faz por
              ti se contratares a gestão.
            </p>
            <div className="timeline">
              {analysis.actionPlan.map((a) => (
                <div key={a.step} className="timeline-step">
                  <div className="timeline-num">{a.step}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.action}</div>
                    <div className="timeline-meta">
                      Impacto {a.impact} · {a.eta}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="pain-line">
              Cada semana sozinho é mais uma semana a queimar budget.
            </div>
          </section>
        ) : null}

        {analysis.improvementScenario ? (
          <section className="card scenario-card">
            <h2>Onde podes estar em 30 dias</h2>
            <p className="scenario-value">{analysis.improvementScenario.note}</p>
            <span className="badge badge-good">
              Confiança: {analysis.improvementScenario.confidence}
            </span>
          </section>
        ) : null}

        {data.report?.management_cta_eligible ? (
          <section className="card cta-pain">
            <span className="cta-stamp">Recomendado pela análise</span>
            {gestaoCheckout === "falha" ? (
              <p role="alert" style={{ color: "#b91c1c", marginBottom: "1rem" }}>
                O Mercado Pago não concluiu o pagamento. Podes tentar de novo
                em seguida.
              </p>
            ) : gestaoCheckout === "pending" ? (
              <p className="muted" style={{ marginBottom: "1rem" }}>
                Pagamento pendente no Mercado Pago. Esta página será
                actualizada quando o relatório rever o estado da gestão.
              </p>
            ) : null}
            {managementPaid ? (
              <>
                <h2>Estamos prontos a começar</h2>
                <p>
                  Pagamento registado — obrigado. Fala connosco no WhatsApp com
                  o link abaixo (incluímos os dados da loja que indicaste).
                </p>
                {whatsappGestaoLink ? (
                  <a
                    className="btn btn-primary"
                    href={whatsappGestaoLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => void trackCta()}
                  >
                    WhatsApp — próximos passos
                  </a>
                ) : null}
              </>
            ) : (
              <>
                <h2>Cada dia parado custa-te dinheiro</h2>
                <p style={{ marginTop: "0.5rem" }}>
                  O diagnóstico acima mostra exactamente onde estás a queimar
                  budget. Enquanto não corriges, três coisas continuam a
                  acontecer todos os dias na tua conta:
                </p>
                <ul className="pain-list">
                  <li>
                    <span className="pain-emoji">🔥</span>
                    <span>
                      <strong>Budget queimado</strong> em criativos e públicos
                      errados — dinheiro que não volta.
                    </span>
                  </li>
                  <li>
                    <span className="pain-emoji">📉</span>
                    <span>
                      <strong>Leads que o teu concorrente apanha</strong>{" "}
                      porque o teu CPA está acima do mercado.
                    </span>
                  </li>
                  <li>
                    <span className="pain-emoji">⏰</span>
                    <span>
                      <strong>Cada semana sozinho</strong> é mais um mês de
                      resultados adiados.
                    </span>
                  </li>
                </ul>
                <p className="bridge">
                  Podes continuar a tentar sozinho — ou deixar a nossa equipa
                  executar o plano em <strong>7 dias</strong>, por{" "}
                  <strong>R$ 1.997</strong> (valor único, via Mercado Pago).
                </p>
                <p className="form-intro">
                  Últimos 3 campos antes de começarmos
                </p>
                <div
                  style={{
                    display: "grid",
                    gap: "0.75rem",
                    marginBottom: "1rem",
                  }}
                >
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      Nome da loja
                    </span>
                    <input
                      className="field-input"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      autoComplete="organization"
                      maxLength={240}
                      required
                    />
                  </label>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      Site / URL principal
                    </span>
                    <input
                      className="field-input"
                      type="url"
                      inputMode="url"
                      placeholder="https://..."
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      maxLength={500}
                      required
                    />
                  </label>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      Instagram (@conta ou URL)
                    </span>
                    <input
                      className="field-input"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      maxLength={240}
                      placeholder="@loja ou link"
                      required
                    />
                  </label>
                </div>
                {mgmt.error ? (
                  <p style={{ color: "#b91c1c", marginBottom: "0.5rem" }}>
                    {mgmt.error}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="btn btn-pain"
                  disabled={
                    mgmt.loading ||
                    !businessName.trim() ||
                    !website.trim() ||
                    !instagram.trim()
                  }
                  onClick={() =>
                    void mgmt.checkout({
                      diagnosisId,
                      secretSlug: s ?? "",
                      business_name: businessName.trim(),
                      website: website.trim(),
                      instagram: instagram.trim(),
                    })
                  }
                >
                  {mgmt.loading
                    ? "A abrir Mercado Pago…"
                    : "Parar de queimar budget — R$ 1.997 →"}
                </button>
                <p className="cta-micro">
                  Pagamento único · Sem mensalidade · Execução começa em 48h
                </p>
                <div className="trust-row">
                  <span>✓ Equipa certificada Meta</span>
                  <span>✓ Relatório semanal</span>
                  <span>✓ Cancelas quando quiseres</span>
                </div>
              </>
            )}
          </section>
        ) : null}

        <p className="muted" style={{ fontSize: "0.8rem", textAlign: "center" }}>
          {analysis.disclaimer}
        </p>
      </div>
    </div>
  );
}
