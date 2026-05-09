import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { brl, num, timeAgo } from "@/lib/format";
import { useState } from "react";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { Card, Empty, PageSkeleton } from "./dashboard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({ component: Reports });

function Reports() {
  const { agency } = useAuth();
  const [selected, setSelected] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["reports", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const [reports, clients] = await Promise.all([
        supabase.from("reports").select("*, clients(id, name)").eq("agency_id", agency!.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("clients").select("id, name").eq("agency_id", agency!.id).order("name"),
      ]);
      return { reports: reports.data ?? [], clients: clients.data ?? [] };
    },
  });

  async function generateFor(clientId: string) {
    setGenerating(true);
    const { error } = await supabase.functions.invoke("generate-report", { body: { client_id: clientId } });
    setGenerating(false);
    if (error) return toast.error(error.message);
    toast.success("Relatório gerado.");
    refetch();
  }

  function copyToClipboard(r: any) {
    const txt = `${r.executive_summary ?? ""}\n\nPositivos:\n${r.positives ?? "-"}\n\nProblemas:\n${r.problems ?? "-"}\n\nOportunidades:\n${r.opportunities ?? "-"}\n\nPróximos passos:\n${r.next_steps ?? "-"}`;
    navigator.clipboard.writeText(txt);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  if (isLoading || !data) return <PageSkeleton />;

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[360px_1fr]">
      <aside className="overflow-y-auto border-r border-border">
        <div className="border-b border-border p-4">
          <h1 className="text-lg font-semibold tracking-tight">Relatórios IA</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{data.reports.length} relatórios gerados</p>
        </div>
        <div className="border-b border-border p-3">
          <details className="group">
            <summary className="cursor-pointer rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground hover:opacity-90">
              <Sparkles className="mr-1.5 inline h-3.5 w-3.5" /> Gerar novo relatório
            </summary>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border">
              {data.clients.map(c => (
                <button key={c.id} onClick={() => generateFor(c.id)} disabled={generating} className="block w-full px-3 py-2 text-left text-xs hover:bg-surface disabled:opacity-50">
                  {c.name}
                </button>
              ))}
            </div>
            {generating && <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Gerando...</div>}
          </details>
        </div>
        {data.reports.length === 0 ? (
          <div className="p-6"><Empty label="Nenhum relatório ainda." /></div>
        ) : (
          <div className="divide-y divide-border">
            {data.reports.map((r: any) => (
              <button key={r.id} onClick={() => setSelected(r)} className={`block w-full px-4 py-3 text-left transition hover:bg-surface ${selected?.id === r.id ? "bg-surface-2" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{r.clients?.name}</div>
                  <div className="text-[10px] text-muted-foreground">{timeAgo(r.created_at)}</div>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.executive_summary}</p>
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
          <div className="mx-auto max-w-3xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{selected.clients?.name}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Período: {selected.period_start} → {selected.period_end}</p>
              </div>
              <button onClick={() => copyToClipboard(selected)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2">
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <Section title="Resumo executivo" body={selected.executive_summary} />
            <Section title="Pontos positivos" body={selected.positives} accent="emerald" />
            <Section title="Problemas detectados" body={selected.problems} accent="amber" />
            <Section title="Oportunidades" body={selected.opportunities} accent="primary" />
            <Section title="Próximos passos" body={selected.next_steps} />
            {selected.client_friendly_summary && (
              <Section title="Versão para o cliente" body={selected.client_friendly_summary} />
            )}
            {selected.raw_data && (
              <Card>
                <div className="border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Dados base</div>
                <div className="grid grid-cols-2 gap-3 p-4 text-xs sm:grid-cols-4">
                  <Metric label="Investimento" value={brl(selected.raw_data.spend)} />
                  <Metric label="Receita" value={brl(selected.raw_data.revenue)} />
                  <Metric label="ROAS" value={`${num(selected.raw_data.roas, 2)}x`} />
                  <Metric label="Conversões" value={String(selected.raw_data.conv ?? 0)} />
                </div>
              </Card>
            )}
            <Link to="/clients/$clientId" params={{ clientId: selected.client_id }} className="inline-block text-xs text-primary hover:underline">
              Ver cliente →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function Section({ title, body, accent }: { title: string; body: string | null; accent?: "emerald" | "amber" | "primary" }) {
  if (!body) return null;
  const dot = accent === "emerald" ? "bg-emerald-500" : accent === "amber" ? "bg-amber-500" : accent === "primary" ? "bg-primary" : "bg-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
