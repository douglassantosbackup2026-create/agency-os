import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { brl, num, timeAgo } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  FileDown,
  MessageSquare,
  Send,
} from "lucide-react";
import { Card, Empty, PageSkeleton } from "@/components/operational-ui";
import { AgencyClientSelect } from "@/components/agency-client-select";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import type { Database } from "@/integrations/supabase/types";
import {
  getReportMetricsBlock,
  getReportRawDataView,
} from "@/lib/supabase-json";
import { useAiJobStatus } from "@/hooks/use-ai-job-status";

type ReportRow = Database["public"]["Tables"]["reports"]["Row"] & {
  clients?: {
    id: string;
    name: string;
    contact_phone?: string | null;
  } | null;
};

export const Route = createFileRoute("/_authenticated/reports")({
  component: Reports,
});

const REPORT_FILTERS_KEY = "agency-os-reports-filters";

function isoDateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function applyReportPeriodPreset(
  preset: "7d" | "30d" | "month",
  setFrom: (v: string) => void,
  setTo: (v: string) => void,
) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  if (preset === "7d") start.setDate(start.getDate() - 6);
  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "month") start.setDate(1);
  setFrom(isoDateLocal(start));
  setTo(isoDateLocal(end));
}

function Reports() {
  const { agency } = useAuth();
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pendingReportJobId, setPendingReportJobId] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [filterClientId, setFilterClientId] = useState<string>("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [summaryQ, setSummaryQ] = useState("");
  const [sortBy, setSortBy] = useState<
    "created_desc" | "period_desc" | "client"
  >("created_desc");
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["reports", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const [reports, clients] = await Promise.all([
        supabase
          .from("reports")
          .select("*, clients(id, name, contact_phone)")
          .eq("agency_id", agency!.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("clients")
          .select("id, name")
          .eq("agency_id", agency!.id)
          .order("name"),
      ]);
      return {
        reports: (reports.data ?? []) as ReportRow[],
        clients: clients.data ?? [],
      };
    },
  });

  useAiJobStatus(pendingReportJobId, {
    onDone: () => {
      toast.success("Relatório gerado.");
      setPendingReportJobId(null);
      void refetch();
    },
    onFailed: (lastError) => {
      toast.error(lastError ?? "Falha ao gerar relatório.");
      setPendingReportJobId(null);
    },
    onTimeout: () => {
      toast.info(
        "Relatório ainda em processamento. Atualize a lista em alguns minutos.",
      );
      setPendingReportJobId(null);
      void refetch();
    },
  });

  useEffect(() => {
    if (!agency?.id) return;
    setFiltersHydrated(false);
    try {
      const raw = localStorage.getItem(REPORT_FILTERS_KEY);
      if (!raw) {
        setFiltersHydrated(true);
        return;
      }
      const o = JSON.parse(raw) as {
        agency_id?: string;
        filterClientId?: string;
        createdFrom?: string;
        createdTo?: string;
        periodFrom?: string;
        periodTo?: string;
        summaryQ?: string;
        sortBy?: "created_desc" | "period_desc" | "client";
      };
      if (o.agency_id !== agency.id) {
        setFiltersHydrated(true);
        return;
      }
      if (typeof o.filterClientId === "string")
        setFilterClientId(o.filterClientId);
      if (typeof o.createdFrom === "string") setCreatedFrom(o.createdFrom);
      if (typeof o.createdTo === "string") setCreatedTo(o.createdTo);
      if (typeof o.periodFrom === "string") setPeriodFrom(o.periodFrom);
      if (typeof o.periodTo === "string") setPeriodTo(o.periodTo);
      if (typeof o.summaryQ === "string") setSummaryQ(o.summaryQ);
      if (
        o.sortBy === "created_desc" ||
        o.sortBy === "period_desc" ||
        o.sortBy === "client"
      )
        setSortBy(o.sortBy);
    } catch {
      /* ignore */
    }
    setFiltersHydrated(true);
  }, [agency?.id]);

  useEffect(() => {
    if (!agency?.id || !filtersHydrated) return;
    try {
      localStorage.setItem(
        REPORT_FILTERS_KEY,
        JSON.stringify({
          agency_id: agency.id,
          filterClientId,
          createdFrom,
          createdTo,
          periodFrom,
          periodTo,
          summaryQ,
          sortBy,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [
    agency?.id,
    filtersHydrated,
    filterClientId,
    createdFrom,
    createdTo,
    periodFrom,
    periodTo,
    summaryQ,
    sortBy,
  ]);

  useEffect(() => {
    if (!data?.reports?.length) return;
    let id: string | null = null;
    try {
      id = sessionStorage.getItem("agency-os-highlight-report");
    } catch {
      return;
    }
    if (!id) return;
    const found = data.reports.find((r: { id: string }) => r.id === id);
    if (found) {
      setSelected(found);
      try {
        sessionStorage.removeItem("agency-os-highlight-report");
      } catch {
        /* ignore */
      }
    }
  }, [data?.reports]);

  const filteredReports = useMemo(() => {
    if (!data?.reports) return [];
    let list: ReportRow[] = [...data.reports];
    if (filterClientId !== "all") {
      list = list.filter((r) => r.client_id === filterClientId);
    }
    if (createdFrom.trim()) {
      const start = new Date(createdFrom);
      start.setHours(0, 0, 0, 0);
      list = list.filter(
        (r) => new Date(r.created_at).getTime() >= start.getTime(),
      );
    }
    if (createdTo.trim()) {
      const end = new Date(createdTo);
      end.setHours(23, 59, 59, 999);
      list = list.filter(
        (r) => new Date(r.created_at).getTime() <= end.getTime(),
      );
    }
    if (periodFrom.trim()) {
      const pf = periodFrom.slice(0, 10);
      list = list.filter((r) => String(r.period_end ?? "").slice(0, 10) >= pf);
    }
    if (periodTo.trim()) {
      const pt = periodTo.slice(0, 10);
      list = list.filter(
        (r) => String(r.period_start ?? "").slice(0, 10) <= pt,
      );
    }
    if (summaryQ.trim()) {
      const q = summaryQ.trim().toLowerCase();
      list = list.filter((r) => {
        const ex = String(r.executive_summary ?? "").toLowerCase();
        const cf = String(r.client_friendly_summary ?? "").toLowerCase();
        return ex.includes(q) || cf.includes(q);
      });
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "client") {
        return String(a.clients?.name ?? "").localeCompare(
          String(b.clients?.name ?? ""),
          "pt-BR",
        );
      }
      if (sortBy === "period_desc") {
        const pa = String(a.period_end ?? a.period_start ?? "");
        const pb = String(b.period_end ?? b.period_start ?? "");
        return pb.localeCompare(pa);
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
    return list;
  }, [
    data?.reports,
    filterClientId,
    createdFrom,
    createdTo,
    periodFrom,
    periodTo,
    summaryQ,
    sortBy,
  ]);

  const previousReportById = useMemo(() => {
    const map = new Map<string, ReportRow>();
    const all = data?.reports ?? [];
    for (const r of all) {
      const prev = all.find(
        (x) =>
          x.client_id === r.client_id &&
          new Date(x.created_at).getTime() < new Date(r.created_at).getTime(),
      );
      if (prev) map.set(r.id, prev);
    }
    return map;
  }, [data?.reports]);

  async function generateFor(
    clientId: string,
    mode: "monthly_manager" | "monthly_client" = "monthly_manager",
  ) {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("generate-report", {
      body: {
        client_id: clientId,
        mode,
        click_context: "checkin_rotina",
      },
    });
    setGenerating(false);
    if (error) return toast.error(error.message);
    const payload = data as {
      async?: boolean;
      job_id?: string;
      report?: unknown;
    } | null;
    if (payload?.async && payload.job_id) {
      toast.info("Relatório enfileirado. Aguarde…");
      setPendingReportJobId(payload.job_id);
      return;
    }
    toast.success("Relatório gerado.");
    refetch();
  }

  function copyToClipboard(r: ReportRow) {
    const txt = `${r.executive_summary ?? ""}\n\nPositivos:\n${r.positives ?? "-"}\n\nProblemas:\n${r.problems ?? "-"}\n\nOportunidades:\n${r.opportunities ?? "-"}\n\nPróximos passos:\n${r.next_steps ?? "-"}`;
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function sendReportToClientAndLog(r: ReportRow) {
    if (!agency?.id) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("activities").insert({
      agency_id: agency.id,
      client_id: r.client_id,
      user_id: user?.id ?? null,
      type: "report_sent_client",
      title:
        `Relatório IA partilhado com o cliente (${String(r.period_start)} → ${String(r.period_end)})`.slice(
          0,
          500,
        ),
      description: String(r.executive_summary ?? "").slice(0, 2000),
      metadata: { report_id: r.id },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Envio registado no feed de atividade.");
    const digits = String(r.clients?.contact_phone ?? "").replace(/\D/g, "");
    const text = [
      r.executive_summary,
      r.positives ? `Positivos:\n${r.positives}` : "",
      r.problems ? `Problemas:\n${r.problems}` : "",
      r.next_steps ? `Próximos passos:\n${r.next_steps}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 3900);
    if (digits.length >= 10) {
      window.open(
        `https://wa.me/${digits}?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else {
      toast.info(
        "Sem telefone na ficha do cliente — use Copiar ou PDF para enviar por outro canal.",
      );
    }
  }

  async function sendWhatsAppSummary(r: ReportRow) {
    const defaultPhone = r.clients?.contact_phone as string | undefined;
    const recipient =
      defaultPhone ||
      window.prompt("Telefone (DDI + DDD + número, só dígitos)") ||
      "";
    if (!recipient.trim()) return;
    if (r.requer_revisao_humana) {
      const ok = window.confirm(
        "Este conteúdo exige revisão humana. Confirma envio manual agora?",
      );
      if (!ok) return;
    }
    const text = [
      r.executive_summary,
      r.positives ? `Positivos:\n${r.positives}` : "",
      r.problems ? `Problemas:\n${r.problems}` : "",
      r.next_steps ? `Próximos passos:\n${r.next_steps}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 3900);
    const tid = toast.loading("Enviando...");
    const { error } = await supabase.functions.invoke("send-whatsapp", {
      body: {
        recipient: recipient.trim(),
        message: text,
        client_id: r.client_id,
        template: "report_summary",
        requires_human_review: Boolean(r.requer_revisao_humana),
        approved_by_human: true,
      },
    });
    toast.dismiss(tid);
    if (error) toast.error(error.message);
    else toast.success("Enfileirado / enviado via WhatsApp.");
  }

  async function setReviewStatus(
    r: ReportRow,
    decision: "approved" | "edited" | "ignored",
  ) {
    const { error } = await supabase
      .from("reports")
      .update({
        requer_revisao_humana: false,
        status_envio: decision === "ignored" ? "descartado" : "aprovado",
      })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    if (decision !== "ignored") {
      await supabase.from("action_center").insert({
        agency_id: agency!.id,
        client_id: r.client_id,
        source_type: "relatorio_ia",
        source_ref_id: r.id,
        title: "Executar ação do relatório revisado",
        description: r.next_steps || r.executive_summary || "",
        priority: "media",
        status: "pendente",
        due_date: new Date().toISOString().slice(0, 10),
        metadata: { review_decision: decision },
      });
    }
    toast.success("Revisão atualizada.");
    refetch();
  }

  function exportPDF(r: ReportRow) {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const margin = 48;
    let y = margin;

    doc.setFillColor(124, 92, 255);
    doc.rect(0, 0, W, 6, "F");

    doc.setFont("helvetica", "bold").setFontSize(20);
    doc.text(r.clients?.name ?? "Relatório", margin, y + 24);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(120);
    doc.text(
      `Período: ${r.period_start ?? "-"} → ${r.period_end ?? "-"}`,
      margin,
      y + 42,
    );
    doc.text(
      `Gerado em ${new Date(r.created_at).toLocaleString("pt-BR")}`,
      margin,
      y + 56,
    );
    y += 84;

    const sections: Array<[string, string | null]> = [
      ["Resumo executivo", r.executive_summary],
      ["Pontos positivos", r.positives],
      ["Problemas detectados", r.problems],
      ["Oportunidades", r.opportunities],
      ["Próximos passos", r.next_steps],
      ["Versão para o cliente", r.client_friendly_summary],
    ];

    for (const [title, body] of sections) {
      if (!body) continue;
      if (y > 760) {
        doc.addPage();
        y = margin;
      }
      doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(20);
      doc.text(title, margin, y);
      y += 16;
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60);
      const lines = doc.splitTextToSize(body, W - margin * 2);
      for (const line of lines) {
        if (y > 800) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 14;
      }
      y += 14;
    }

    if (r.raw_data) {
      if (y > 740) {
        doc.addPage();
        y = margin;
      }
      doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(20);
      doc.text("Dados base", margin, y);
      y += 18;
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60);
      const m = getReportMetricsBlock(r.raw_data);
      const rows = [
        `Investimento: ${m.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        `Receita: ${m.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        `ROAS: ${Number(m.roas).toFixed(2)}x`,
        `Conversões: ${m.conv}`,
      ];
      for (const row of rows) {
        doc.text(row, margin, y);
        y += 14;
      }
    }

    doc.save(
      `relatorio-${(r.clients?.name ?? "cliente").toLowerCase().replace(/\s+/g, "-")}-${r.period_end ?? "atual"}.pdf`,
    );
  }

  if (isLoading || !data) return <PageSkeleton preset="split" />;

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[360px_1fr]">
      <aside className="overflow-y-auto border-r border-border">
        <div className="border-b border-border p-4">
          <h1 className="text-lg font-semibold tracking-tight">
            Relatórios IA
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filteredReports.length} de {data.reports.length} após filtros
          </p>
        </div>
        <div className="border-b border-border px-3 pb-3 pt-1">
          <div className="flex flex-col gap-2 text-xs">
            <AgencyClientSelect
              variant="native"
              clients={data.clients ?? []}
              value={filterClientId}
              onValueChange={setFilterClientId}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2"
                title="Gerado desde"
              />
              <input
                type="date"
                value={createdTo}
                onChange={(e) => setCreatedTo(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2"
                title="Gerado até"
              />
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Período coberto pelo relatório
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  applyReportPeriodPreset("7d", setPeriodFrom, setPeriodTo)
                }
              >
                Últimos 7 dias
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  applyReportPeriodPreset("30d", setPeriodFrom, setPeriodTo)
                }
              >
                Últimos 30 dias
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  applyReportPeriodPreset("month", setPeriodFrom, setPeriodTo)
                }
              >
                Este mês
              </Button>
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2"
                title="period_end a partir de"
              />
              <input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2"
                title="period_start até"
              />
            </div>
            <input
              value={summaryQ}
              onChange={(e) => setSummaryQ(e.target.value)}
              placeholder="Buscar no resumo executivo…"
              className="h-9 w-full rounded-md border border-border bg-background px-2"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-9 w-full rounded-md border border-border bg-background px-2"
            >
              <option value="created_desc">Ordenar: mais recentes</option>
              <option value="period_desc">Ordenar: fim do período</option>
              <option value="client">Ordenar: cliente (A–Z)</option>
            </select>
          </div>
        </div>
        <div className="border-b border-border p-3">
          <details className="group">
            <summary className="cursor-pointer rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground hover:opacity-90">
              <Sparkles className="mr-1.5 inline h-3.5 w-3.5" /> Gerar novo
              relatório
            </summary>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border">
              {data.clients.map((c) => (
                <div
                  key={c.id}
                  className="border-b border-border last:border-b-0"
                >
                  <div className="px-3 pt-2 text-xs font-medium">{c.name}</div>
                  <div className="flex gap-1 p-2">
                    <button
                      onClick={() => generateFor(c.id, "monthly_manager")}
                      disabled={generating}
                      className="flex-1 rounded border border-border px-2 py-1.5 text-left text-[11px] hover:bg-surface disabled:opacity-50"
                    >
                      Versão gestor
                    </button>
                    <button
                      onClick={() => generateFor(c.id, "monthly_client")}
                      disabled={generating}
                      className="flex-1 rounded border border-border px-2 py-1.5 text-left text-[11px] hover:bg-surface disabled:opacity-50"
                    >
                      Versão cliente
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {generating && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Gerando...
              </div>
            )}
          </details>
        </div>
        {data.reports.length === 0 ? (
          <div className="p-6">
            <Empty label="Nenhum relatório ainda." />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-6">
            <Empty label="Nenhum relatório com os filtros atuais." />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredReports.map((r: ReportRow) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`block w-full px-4 py-3 text-left transition hover:bg-surface ${selected?.id === r.id ? "bg-surface-2" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{r.clients?.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {timeAgo(r.created_at)}
                  </div>
                </div>
                {r.requer_revisao_humana && (
                  <div className="mt-1 text-[10px] font-medium uppercase text-amber-500">
                    Revisão humana pendente
                  </div>
                )}
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {r.executive_summary}
                </p>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className="overflow-y-auto p-6">
        {!selected ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Selecione um relatório à esquerda ou gere um novo.
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mx-auto max-w-3xl space-y-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    {selected.clients?.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Período: {selected.period_start} → {selected.period_end}
                  </p>
                  {selected.requer_revisao_humana && (
                    <p className="mt-1 text-xs font-medium text-amber-500">
                      Este conteúdo está na fila da Central de Revisão IA.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.requer_revisao_humana && (
                    <>
                      <button
                        type="button"
                        onClick={() => setReviewStatus(selected, "approved")}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewStatus(selected, "edited")}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2"
                      >
                        Editado
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewStatus(selected, "ignored")}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2"
                      >
                        Ignorar
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => exportPDF(selected)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2"
                  >
                    <FileDown className="h-3 w-3" /> PDF
                  </button>
                  <button
                    onClick={() => copyToClipboard(selected)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendReportToClientAndLog(selected)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium hover:bg-primary/15"
                  >
                    <Send className="h-3 w-3" /> Enviar ao cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => sendWhatsAppSummary(selected)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2"
                  >
                    <MessageSquare className="h-3 w-3" /> WhatsApp API
                  </button>
                </div>
              </div>
              {(() => {
                const prevRep = previousReportById.get(selected.id);
                const prevRaw = prevRep?.raw_data;
                return prevRaw && selected.raw_data ? (
                  <Card>
                    <div className="border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Comparativo com relatório anterior
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-4 text-xs sm:grid-cols-4">
                      {(["spend", "revenue", "roas", "conv"] as const).map(
                        (k) => {
                          const prevM = getReportMetricsBlock(prevRaw);
                          const curM = getReportMetricsBlock(selected.raw_data);
                          const prev = prevM[k];
                          const cur = curM[k];
                          const pct =
                            prev > 0 ? ((cur - prev) / prev) * 100 : 0;
                          return (
                            <Metric
                              key={k}
                              label={`${k} Δ`}
                              value={`${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
                            />
                          );
                        },
                      )}
                    </div>
                  </Card>
                ) : null;
              })()}
              <Section
                title="Resumo executivo"
                body={selected.executive_summary}
              />
              <Section
                title="Pontos positivos"
                body={selected.positives}
                accent="emerald"
              />
              <Section
                title="Problemas detectados"
                body={selected.problems}
                accent="amber"
              />
              <Section
                title="Oportunidades"
                body={selected.opportunities}
                accent="primary"
              />
              <Section title="Próximos passos" body={selected.next_steps} />
              {selected.client_friendly_summary && (
                <Section
                  title="Versão para o cliente"
                  body={selected.client_friendly_summary}
                />
              )}
              {selected.raw_data &&
                (() => {
                  const rd = getReportRawDataView(selected.raw_data);
                  return (
                    <Card>
                      <div className="border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Dados base
                      </div>
                      <div className="grid grid-cols-2 gap-3 p-4 text-xs sm:grid-cols-4">
                        <Metric label="Investimento" value={brl(rd.spend)} />
                        <Metric label="Receita" value={brl(rd.revenue)} />
                        <Metric label="ROAS" value={`${num(rd.roas, 2)}x`} />
                        <Metric label="Conversões" value={String(rd.conv)} />
                        <Metric
                          label="Sessões (GA4)"
                          value={String(rd.ga4_sessions)}
                        />
                        <Metric
                          label="CVR (GA4)"
                          value={`${num(rd.ga4_cvr * 100, 2)}%`}
                        />
                        <Metric
                          label="Ticket (GA4)"
                          value={brl(rd.ga4_avg_ticket)}
                        />
                        <Metric
                          label="Tracking"
                          value={rd.ga4_tracking_status}
                        />
                      </div>
                    </Card>
                  );
                })()}
              <Link
                to="/clients/$clientId"
                params={{ clientId: selected.client_id }}
                className="inline-block text-xs text-primary hover:underline"
              >
                Ver cliente →
              </Link>
            </motion.div>
          </AnimatePresence>
        )}
      </section>
    </div>
  );
}

function Section({
  title,
  body,
  accent,
}: {
  title: string;
  body: string | null;
  accent?: "emerald" | "amber" | "primary";
}) {
  if (!body) return null;
  const dot =
    accent === "emerald"
      ? "bg-emerald-500"
      : accent === "amber"
        ? "bg-amber-500"
        : accent === "primary"
          ? "bg-primary"
          : "bg-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
        {body}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
