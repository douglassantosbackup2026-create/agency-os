import { useState } from "react";
import { invokeFunction } from "@/lib/invoke";

export function LandingPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function checkout() {
    setErr(null);
    setLoading(true);
    try {
      const res = await invokeFunction("create-diagnosis-checkout", {
        method: "POST",
        body: "{}",
      });
      const j = (await res.json()) as {
        init_point?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "Erro ao criar checkout");
      if (!j.init_point) throw new Error("Sem link de pagamento");
      window.location.href = j.init_point;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Diagnóstico Meta Ads</h1>
        <p className="muted">
          Auditoria orientada a e-commerce: ligas a tua conta (leitura), recebes
          score, problemas prioritários e plano de ação. Sem e-mail: guarda o
          link da página seguinte.
        </p>
        <ul className="muted">
          <li>Pagamento seguro (Mercado Pago)</li>
          <li>Permissões mínimas na Meta (ads_read)</li>
          <li>Análise com IA + dados reais da conta</li>
        </ul>
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading}
          onClick={() => void checkout()}
        >
          {loading ? "A redirecionar…" : "Comprar diagnóstico"}
        </button>
        {err ? (
          <p style={{ color: "#b91c1c", marginTop: "1rem" }}>{err}</p>
        ) : null}
      </div>
    </div>
  );
}
