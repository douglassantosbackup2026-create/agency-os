import { useState } from "react";
import { callDiagnosisApi } from "@/lib/diagnosis-api";

export type BusinessContext = {
  niche?: string | null;
  avg_ticket_brl?: number | null;
  margin_pct?: number | null;
  monthly_goal_brl?: number | null;
  target_roas?: number | null;
  notes?: string | null;
  saved_at?: string | null;
};

type Props = {
  diagnosisId: string;
  secretSlug: string;
  initial: BusinessContext | null;
  reportCompleted: boolean;
};

export function DiagnosisBusinessContextForm({
  diagnosisId,
  secretSlug,
  initial,
  reportCompleted,
}: Props) {
  const [niche, setNiche] = useState(initial?.niche ?? "");
  const [ticket, setTicket] = useState(
    initial?.avg_ticket_brl != null ? String(initial.avg_ticket_brl) : "",
  );
  const [margin, setMargin] = useState(
    initial?.margin_pct != null ? String(initial.margin_pct) : "",
  );
  const [goal, setGoal] = useState(
    initial?.monthly_goal_brl != null ? String(initial.monthly_goal_brl) : "",
  );
  const [targetRoas, setTargetRoas] = useState(
    initial?.target_roas != null ? String(initial.target_roas) : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await callDiagnosisApi("diagnosis-context", {
        method: "POST",
        body: JSON.stringify({
          diagnosis_id: diagnosisId,
          secret_slug: secretSlug,
          context: {
            niche: niche.trim() || null,
            avg_ticket_brl: ticket.trim() ? Number(ticket) : null,
            margin_pct: margin.trim() ? Number(margin) : null,
            monthly_goal_brl: goal.trim() ? Number(goal) : null,
            target_roas: targetRoas.trim() ? Number(targetRoas) : null,
            notes: notes.trim() || null,
          },
        }),
      });
      setMessage("Contexto salvo.");
      if (reportCompleted) {
        setMessage(
          "Contexto salvo. Reprocesse o diagnóstico para aplicar à narrativa do relatório.",
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="diagnosis-context-form" onSubmit={onSubmit}>
      <h2 className="section-title">Contexto da sua loja</h2>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Ajuda a interpretar ROAS e margem — não altera dados da Meta.
      </p>
      <div className="diagnosis-context-grid">
        <label>
          Nicho
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Ex.: moda feminina"
            maxLength={120}
          />
        </label>
        <label>
          Ticket médio (R$)
          <input
            type="number"
            min={0}
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            placeholder="Ex.: 180"
          />
        </label>
        <label>
          Margem no produto (%)
          <input
            type="number"
            min={0}
            max={100}
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            placeholder="Ex.: 30"
          />
        </label>
        <label>
          Meta mensal (R$)
          <input
            type="number"
            min={0}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Ex.: 50000"
          />
        </label>
        <label>
          Meta de ROAS (×)
          <input
            type="number"
            min={1}
            max={50}
            step={0.1}
            value={targetRoas}
            onChange={(e) => setTargetRoas(e.target.value)}
            placeholder="Ex.: 10"
          />
        </label>
      </div>
      <label className="diagnosis-context-notes">
        Notas (opcional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={600}
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? "A guardar…" : "Guardar contexto"}
      </button>
      {message ? (
        <p className="diagnosis-context-msg" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
