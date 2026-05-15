import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/format";
import { Card, Empty, PageSkeleton } from "@/components/operational-ui";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/ai-review")({
  component: AiReviewCenter,
});

type QueueKind = "report" | "alert" | "meeting" | "whatsapp" | "competitor";

type QueueItemBase = {
  id: string;
  created_at: string;
  client_id: string | null;
  client_name: string;
};

type QueueItem =
  | (QueueItemBase & { kind: "report"; raw: QueueReportRow })
  | (QueueItemBase & { kind: "alert"; raw: QueueAlertRow })
  | (QueueItemBase & { kind: "meeting"; raw: QueueMeetingRow })
  | (QueueItemBase & { kind: "whatsapp"; raw: QueueWhatsRow })
  | (QueueItemBase & { kind: "competitor"; raw: QueueCompetitorRow });

type ClientNameJoin = { name?: string | null } | null;

type QueueReportRow = {
  id: string;
  created_at: string;
  client_id: string | null;
  executive_summary?: string | null;
  confianca?: string | null;
  clients?: ClientNameJoin;
};

type QueueAlertRow = {
  id: string;
  created_at: string;
  client_id: string | null;
  title?: string | null;
  description?: string | null;
  confianca?: string | null;
  clients?: ClientNameJoin;
};

type QueueMeetingRow = {
  id: string;
  created_at: string;
  client_id: string | null;
  agenda?: string | null;
  confianca?: string | null;
  clients?: ClientNameJoin;
};

type QueueWhatsRow = {
  id: string;
  created_at: string;
  client_id: string | null;
  message?: string | null;
  recipient?: string | null;
  confianca?: string | null;
  clients?: ClientNameJoin;
};

type QueueCompetitorRow = {
  id: string;
  captured_at: string;
  client_id: string | null;
  summary?: string | null;
  insight?: string | null;
  headline?: string | null;
  confianca?: string | null;
  clients?: ClientNameJoin;
};

type ActionInsert = Database["public"]["Tables"]["action_center"]["Insert"];

/** Tipo estrutural com todas as propriedades opcionais dos raw rows — elimina `as any` no render da fila. */
type AnyQueueRaw = {
  id?: string;
  client_id?: string | null;
  confianca?: string | null;
  // report
  executive_summary?: string | null;
  // alert
  title?: string | null;
  description?: string | null;
  // meeting
  agenda?: string | null;
  // whatsapp
  recipient?: string | null;
  message?: string | null;
  // competitor
  summary?: string | null;
  insight?: string | null;
  headline?: string | null;
};

function AiReviewCenter() {
  const { agency } = useAuth();
  const [kindFilter, setKindFilter] = useState<QueueKind | "all">("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ai-review-queue", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const [reports, alerts, meetings, wa, competitors] = await Promise.all([
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
            "id, created_at, client_id, title, description, confianca, clients(name)",
          )
          .eq("agency_id", agency!.id)
          .eq("status", "open")
          .not("ai_output_json", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("meeting_reports")
          .select("id, created_at, client_id, agenda, confianca, clients(name)")
          .eq("agency_id", agency!.id)
          .eq("requer_revisao_humana", true)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("whatsapp_logs")
          .select(
            "id, created_at, recipient, message, client_id, clients(name)",
          )
          .eq("agency_id", agency!.id)
          .eq("pending_review", true)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("competitor_snapshots")
          .select(
            "id, captured_at, client_id, summary, insight, headline, confianca, clients(name)",
          )
          .eq("agency_id", agency!.id)
          .eq("requer_revisao_humana", true)
          .order("captured_at", { ascending: false })
          .limit(50),
      ]);
      return {
        reports: reports.data ?? [],
        alerts: alerts.data ?? [],
        meetings: meetings.data ?? [],
        whatsapp: wa.data ?? [],
        competitors: competitors.data ?? [],
      };
    },
  });

  const queue = useMemo(() => {
    if (!data) return [];
    const items: QueueItem[] = [];
    for (const r of data.reports as QueueReportRow[]) {
      items.push({
        kind: "report",
        id: r.id,
        created_at: r.created_at,
        client_id: r.client_id,
        client_name: r.clients?.name ?? "Cliente",
        raw: r,
      });
    }
    for (const a of data.alerts as QueueAlertRow[]) {
      items.push({
        kind: "alert",
        id: a.id,
        created_at: a.created_at,
        client_id: a.client_id,
        client_name: a.clients?.name ?? "Cliente",
        raw: a,
      });
    }
    for (const m of data.meetings as QueueMeetingRow[]) {
      items.push({
        kind: "meeting",
        id: m.id,
        created_at: m.created_at,
        client_id: m.client_id,
        client_name: m.clients?.name ?? "Cliente",
        raw: m,
      });
    }
    for (const w of data.whatsapp as QueueWhatsRow[]) {
      items.push({
        kind: "whatsapp",
        id: w.id,
        created_at: w.created_at,
        client_id: w.client_id,
        client_name: w.clients?.name ?? "—",
        raw: w,
      });
    }
    for (const c of data.competitors as QueueCompetitorRow[]) {
      items.push({
        kind: "competitor",
        id: c.id,
        created_at: c.captured_at,
        client_id: c.client_id,
        client_name: c.clients?.name ?? "Cliente",
        raw: c,
      });
    }
    items.sort(
      (x, y) =>
        new Date(y.created_at).getTime() - new Date(x.created_at).getTime(),
    );
    return items;
  }, [data]);

  const filtered = useMemo(() => {
    if (kindFilter === "all") return queue;
    return queue.filter((q) => q.kind === kindFilter);
  }, [queue, kindFilter]);

  const counts = useMemo(() => {
    const c = {
      report: 0,
      alert: 0,
      meeting: 0,
      whatsapp: 0,
      competitor: 0,
    };
    for (const q of queue) c[q.kind]++;
    return c;
  }, [queue]);

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
      toast.success("Descartado.");
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
      toast.success("Alerta aprovado.");
      refetch();
    }
  }

  async function discardAlert(id: string) {
    const { error } = await supabase
      .from("alerts")
      .update({
        requer_revisao_humana: false,
        status_envio: "descartado",
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Alerta ignorado.");
      refetch();
    }
  }

  async function approveMeeting(id: string) {
    const { error } = await supabase
      .from("meeting_reports")
      .update({
        requer_revisao_humana: false,
        status_envio: "aprovado",
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Pauta aprovada.");
      refetch();
    }
  }

  async function discardMeeting(id: string) {
    const { error } = await supabase
      .from("meeting_reports")
      .update({
        requer_revisao_humana: false,
        status_envio: "descartado",
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Pauta descartada.");
      refetch();
    }
  }

  async function approveCompetitor(id: string) {
    const { error } = await supabase
      .from("competitor_snapshots")
      .update({
        requer_revisao_humana: false,
        status_envio: "aprovado",
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Snapshot de concorrente aprovado.");
      refetch();
    }
  }

  async function discardCompetitor(id: string) {
    const { error } = await supabase
      .from("competitor_snapshots")
      .update({
        requer_revisao_humana: false,
        status_envio: "descartado",
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Descartado.");
      refetch();
    }
  }

  async function insertAction(payload: ActionInsert) {
    const { error } = await supabase.from("action_center").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Ação criada.");
      refetch();
    }
  }

  function createActionFromReport(r: QueueReportRow) {
    insertAction({
      agency_id: agency!.id,
      client_id: r.client_id,
      source_type: "relatorio_ia",
      source_ref_id: r.id,
      title: `Follow-up pós-revisão — ${r.clients?.name ?? "Cliente"}`,
      description: String(r.executive_summary ?? "").slice(0, 1200),
      priority: "media",
      status: "pendente",
      due_date: new Date().toISOString().slice(0, 10),
      metadata: { from: "ai-review", kind: "report" },
    });
  }

  function createActionFromAlert(a: QueueAlertRow) {
    insertAction({
      agency_id: agency!.id,
      client_id: a.client_id,
      source_type: "alerta_ia",
      source_ref_id: a.id,
      title: String(a.title ?? "Alerta IA").slice(0, 220),
      description: String(a.description ?? "").slice(0, 1200),
      priority: "media",
      status: "pendente",
      due_date: new Date().toISOString().slice(0, 10),
      metadata: { from: "ai-review", kind: "alert" },
    });
  }

  function createActionFromMeeting(m: QueueMeetingRow) {
    insertAction({
      agency_id: agency!.id,
      client_id: m.client_id,
      source_type: "manual",
      source_ref_id: m.id,
      title: `Pós-reunião — ${m.clients?.name ?? "Cliente"}`,
      description: String(m.agenda ?? "").slice(0, 1200),
      priority: "media",
      status: "pendente",
      due_date: new Date().toISOString().slice(0, 10),
      metadata: { from: "ai-review", kind: "meeting" },
    });
  }

  function createActionFromCompetitor(c: QueueCompetitorRow) {
    insertAction({
      agency_id: agency!.id,
      client_id: c.client_id,
      source_type: "manual",
      source_ref_id: c.id,
      title: `Concorrente — ${c.clients?.name ?? "Cliente"}`,
      description: String(c.summary ?? c.insight ?? c.headline ?? "").slice(
        0,
        1200,
      ),
      priority: "baixa",
      status: "pendente",
      due_date: new Date().toISOString().slice(0, 10),
      metadata: { from: "ai-review", kind: "competitor" },
    });
  }

  function createActionFromWhatsApp(w: QueueWhatsRow) {
    insertAction({
      agency_id: agency!.id,
      client_id: w.client_id,
      source_type: "whatsapp",
      source_ref_id: w.id,
      title: `WhatsApp pendente — ${w.clients?.name ?? "Cliente"}`,
      description: String(w.message ?? "").slice(0, 1200),
      priority: "media",
      status: "pendente",
      due_date: new Date().toISOString().slice(0, 10),
      metadata: { from: "ai-review", kind: "whatsapp" },
    });
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
    const { error } = await supabase
      .from("whatsapp_logs")
      .update({
        pending_review: false,
        status: "failed",
        error: "review_discarded",
      })
      .eq("id", logId);
    if (error) toast.error(error.message);
    else {
      toast.success("Descartado.");
      refetch();
    }
  }

  function kindLabel(k: QueueKind): string {
    switch (k) {
      case "report":
        return "Relatório";
      case "alert":
        return "Alerta";
      case "meeting":
        return "Reunião";
      case "whatsapp":
        return "WhatsApp";
      case "competitor":
        return "Concorrente";
      default:
        return k;
    }
  }

  if (isLoading || !data) return <PageSkeleton preset="compact" />;

  return (
    <div className="space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Central de Revisão IA
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Uma fila única: aprove, ignore, edite na tela original ou vire tarefa.
        </p>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {(
          [
            ["all", `Todos (${queue.length})`],
            ["report", `Relatórios (${counts.report})`],
            ["alert", `Alertas (${counts.alert})`],
            ["meeting", `Reuniões (${counts.meeting})`],
            ["whatsapp", `WhatsApp (${counts.whatsapp})`],
            ["competitor", `Concorrentes (${counts.competitor})`],
          ] as const
        ).map(([k, label]) => (
          <Button
            key={k}
            type="button"
            variant={kindFilter === k ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setKindFilter(k)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <Empty label="Nada pendente nesta fila." />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((item) => {
              const r = item.raw as AnyQueueRaw;
              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="space-y-2 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                        {kindLabel(item.kind)}
                      </span>
                      <span className="text-sm font-medium">
                        {item.client_name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(item.created_at)}
                      {" · confiança "}
                      {String(
                        "confianca" in r && r.confianca != null
                          ? r.confianca
                          : "—",
                      )}
                    </span>
                  </div>

                  {item.kind === "report" && (
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {String(r.executive_summary ?? "")}
                    </p>
                  )}
                  {item.kind === "alert" && (
                    <>
                      <div className="text-sm font-medium">
                        {String(r.title)}
                      </div>
                      {r.description && (
                        <p className="text-sm text-muted-foreground">
                          {String(r.description)}
                        </p>
                      )}
                    </>
                  )}
                  {item.kind === "meeting" && (
                    <p className="line-clamp-4 text-sm text-muted-foreground">
                      {String(r.agenda ?? "—")}
                    </p>
                  )}
                  {item.kind === "whatsapp" && (
                    <>
                      <div className="text-xs text-muted-foreground">
                        {String(r.recipient)}
                      </div>
                      <p className="whitespace-pre-wrap text-sm">
                        {String(r.message ?? "")}
                      </p>
                    </>
                  )}
                  {item.kind === "competitor" && (
                    <p className="line-clamp-4 text-sm text-muted-foreground">
                      {String(r.summary ?? r.insight ?? r.headline ?? "—")}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {item.kind === "report" && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => approveReport(item.id)}
                        >
                          Aprovar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => discardReport(item.id)}
                        >
                          Ignorar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                          onClick={() => createActionFromReport(item.raw as QueueReportRow)}
                        >
                          Virar ação
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          asChild
                        >
                          <Link to="/reports">Editar</Link>
                        </Button>
                      </>
                    )}
                    {item.kind === "alert" && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => approveAlert(item.id)}
                        >
                          Aprovar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => discardAlert(item.id)}
                        >
                          Ignorar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                          onClick={() => createActionFromAlert(item.raw as QueueAlertRow)}
                        >
                          Virar ação
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          asChild
                        >
                          <Link to="/alerts">Editar</Link>
                        </Button>
                      </>
                    )}
                    {item.kind === "meeting" && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => approveMeeting(item.id)}
                        >
                          Aprovar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => discardMeeting(item.id)}
                        >
                          Ignorar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                          onClick={() => createActionFromMeeting(r)}
                        >
                          Virar ação
                        </Button>
                        {item.client_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            asChild
                          >
                            <Link
                              to="/clients/$clientId"
                              params={{ clientId: item.client_id }}
                            >
                              Editar
                            </Link>
                          </Button>
                        )}
                      </>
                    )}
                    {item.kind === "competitor" && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => approveCompetitor(item.id)}
                        >
                          Aprovar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => discardCompetitor(item.id)}
                        >
                          Ignorar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                          onClick={() => createActionFromCompetitor(r)}
                        >
                          Virar ação
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          asChild
                        >
                          <Link to="/competitors">Editar</Link>
                        </Button>
                      </>
                    )}
                    {item.kind === "whatsapp" && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => sendWhatsDraft(item.id)}
                        >
                          Enviar agora
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => discardWhatsDraft(item.id)}
                        >
                          Ignorar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                          onClick={() => createActionFromWhatsApp(r)}
                        >
                          Virar ação
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          asChild
                        >
                          <Link to="/whatsapp">Editar</Link>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
