import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/format";
import { Card, Empty, PageSkeleton } from "./dashboard";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/ai-review")({
  component: AiReviewCenter,
});

function AiReviewCenter() {
  const { agency } = useAuth();
  const [tab, setTab] = useState<
    "reports" | "alerts" | "meetings" | "whatsapp"
  >("reports");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ai-review-queue", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const sb = supabase as any;
      const [reports, alerts, meetings, wa] = await Promise.all([
        supabase
          .from("reports")
          .select(
            "id, created_at, client_id, executive_summary, confianca, clients(name)",
          )
          .eq("agency_id", agency!.id)
          .eq("requer_revisao_humana", true)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("alerts")
          .select(
            "id, created_at, client_id, title, description, confianca, requer_revisao_humana, status_envio, clients(name)",
          )
          .eq("agency_id", agency!.id)
          .eq("status", "open")
          .not("ai_output_json", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
        sb
          .from("meeting_reports")
          .select(
            "id, created_at, client_id, agenda, confianca, requer_revisao_humana, clients(name)",
          )
          .eq("agency_id", agency!.id)
          .eq("requer_revisao_humana", true)
          .order("created_at", { ascending: false })
          .limit(50),
        sb
          .from("whatsapp_logs")
          .select(
            "id, created_at, recipient, message, client_id, clients(name)",
          )
          .eq("agency_id", agency!.id)
          .eq("pending_review", true)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      return {
        reports: reports.data ?? [],
        alerts: alerts.data ?? [],
        meetings: meetings.data ?? [],
        whatsapp: wa.data ?? [],
      };
    },
  });

  async function approveReport(id: string) {
    const { error } = await supabase
      .from("reports")
      .update({
        requer_revisao_humana: false,
        status_envio: "aprovado",
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Relatório aprovado.");
      refetch();
    }
  }

  async function discardReport(id: string) {
    const { error } = await supabase
      .from("reports")
      .update({
        requer_revisao_humana: false,
        status_envio: "descartado",
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Marcado como descartado.");
      refetch();
    }
  }

  async function createActionFromReport(r: any) {
    const sb = supabase as any;
    const { error } = await sb.from("action_center").insert({
      agency_id: agency!.id,
      client_id: r.client_id,
      source_type: "relatorio_ia",
      source_ref_id: r.id,
      title: `Follow-up pós-revisão — ${r.clients?.name ?? "Cliente"}`,
      description: (r.executive_summary ?? "").slice(0, 1200),
      priority: "media",
      status: "pendente",
      due_date: new Date().toISOString().slice(0, 10),
      metadata: { from: "ai-review" },
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Ação criada.");
      refetch();
    }
  }

  async function approveAlert(id: string) {
    const { error } = await supabase
      .from("alerts")
      .update({
        requer_revisao_humana: false,
        status_envio: "aprovado",
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Alerta revisado.");
      refetch();
    }
  }

  async function approveMeeting(id: string) {
    const sb = supabase as any;
    const { error } = await sb
      .from("meeting_reports")
      .update({
        requer_revisao_humana: false,
        status_envio: "aprovado",
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Pauta revisada.");
      refetch();
    }
  }

  async function sendWhatsDraft(logId: string) {
    const tid = toast.loading("Enviando...");
    const { error } = await supabase.functions.invoke("send-whatsapp", {
      body: { resend_from_log_id: logId, approved_by_human: true },
    });
    toast.dismiss(tid);
    if (error) toast.error(error.message);
    else {
      toast.success("Mensagem enviada.");
      refetch();
    }
  }

  async function discardWhatsDraft(logId: string) {
    const sb = supabase as any;
    const { error } = await sb
      .from("whatsapp_logs")
      .update({
        pending_review: false,
        status: "failed",
        error: "review_discarded",
      })
      .eq("id", logId);
    if (error) toast.error(error.message);
    else {
      toast.success("Rascunho descartado.");
      refetch();
    }
  }

  if (isLoading || !data) return <PageSkeleton preset="compact" />;

  const counts = {
    reports: data.reports.length,
    alerts: data.alerts.length,
    meetings: data.meetings.length,
    whatsapp: data.whatsapp.length,
  };

  return (
    <div className="space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Central de Revisão IA
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Aprove, descarte ou transforme saídas da IA em ação executável.
        </p>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {(
          [
            ["reports", `Relatórios (${counts.reports})`],
            ["alerts", `Alertas (${counts.alerts})`],
            ["meetings", `Reuniões (${counts.meetings})`],
            ["whatsapp", `WhatsApp (${counts.whatsapp})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === k
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-surface"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "reports" && (
        <Card>
          {data.reports.length === 0 ? (
            <Empty label="Sem relatórios pendentes de revisão." />
          ) : (
            <div className="divide-y divide-border">
              {data.reports.map((r: any) => (
                <div key={r.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {r.clients?.name ?? "Cliente"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {timeAgo(r.created_at)} · conf. {r.confianca ?? "—"}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-xs text-muted-foreground">
                    {r.executive_summary}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => approveReport(r.id)}
                      className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      onClick={() => discardReport(r.id)}
                      className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                    >
                      Ignorar
                    </button>
                    <button
                      type="button"
                      onClick={() => createActionFromReport(r)}
                      className="rounded border border-primary/40 px-2 py-1 text-xs text-primary hover:bg-primary/10"
                    >
                      Virar ação
                    </button>
                    <Link
                      to="/reports"
                      className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                    >
                      Abrir relatórios
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "alerts" && (
        <Card>
          {data.alerts.length === 0 ? (
            <Empty label="Sem alertas na fila de revisão." />
          ) : (
            <div className="divide-y divide-border">
              {data.alerts.map((a: any) => (
                <div key={a.id} className="space-y-2 px-4 py-3">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.clients?.name ?? ""} · {timeAgo(a.created_at)}
                  </div>
                  {a.description && (
                    <p className="text-xs text-muted-foreground">
                      {a.description}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => approveAlert(a.id)}
                    className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                  >
                    Marcar revisado
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "meetings" && (
        <Card>
          {data.meetings.length === 0 ? (
            <Empty label="Sem pautas pendentes." />
          ) : (
            <div className="divide-y divide-border">
              {data.meetings.map((m: any) => (
                <div key={m.id} className="space-y-2 px-4 py-3">
                  <div className="text-sm font-medium">
                    {m.clients?.name ?? "Cliente"}
                  </div>
                  <p className="line-clamp-4 text-xs text-muted-foreground">
                    {m.agenda ?? "—"}
                  </p>
                  <button
                    type="button"
                    onClick={() => approveMeeting(m.id)}
                    className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                  >
                    Aprovar pauta
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "whatsapp" && (
        <Card>
          {data.whatsapp.length === 0 ? (
            <Empty label="Sem rascunhos WhatsApp pendentes." />
          ) : (
            <div className="divide-y divide-border">
              {data.whatsapp.map((w: any) => (
                <div key={w.id} className="space-y-2 px-4 py-3">
                  <div className="text-xs text-muted-foreground">
                    {w.clients?.name ?? "—"} · {w.recipient} ·{" "}
                    {timeAgo(w.created_at)}
                  </div>
                  <p className="whitespace-pre-wrap text-xs">{w.message}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => sendWhatsDraft(w.id)}
                      className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                    >
                      Enviar agora
                    </button>
                    <button
                      type="button"
                      onClick={() => discardWhatsDraft(w.id)}
                      className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
