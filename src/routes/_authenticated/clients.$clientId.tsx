import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { brl, num, pct, timeAgo } from "@/lib/format";
import { useState } from "react";
import { ArrowLeft, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Card, CardHeader, Empty, PageSkeleton, Row, RiskDot, ScoreBar, Stat } from "../dashboard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const { agency } = useAuth();
  const [tab, setTab] = useState<"overview" | "campaigns" | "alerts" | "reports" | "notes">("overview");
  const [generating, setGenerating] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const [client, metrics, campaigns, alerts, reports, notes, health] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
        supabase.from("metrics_daily").select("*").eq("client_id", clientId).order("date", { ascending: false }).limit(60),
        supabase.from("campaigns").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
        supabase.from("alerts").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
        supabase.from("reports").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(10),
        supabase.from("notes").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
        supabase.from("health_scores").select("*").eq("client_id", clientId).order("recorded_at", { ascending: false }).limit(30),
      ]);
      return { client: client.data, metrics: metrics.data ?? [], campaigns: campaigns.data ?? [], alerts: alerts.data ?? [], reports: reports.data ?? [], notes: notes.data ?? [], health: health.data ?? [] };
    },
  });

  if (isLoading || !data) return <PageSkeleton />;
  if (!data.client) return <div className="p-6 text-sm text-muted-foreground">Cliente não encontrado.</div>;

  const c = data.client;
  const last30 = data.metrics.slice(0, 30);
  const spend = last30.reduce((a, b) => a + Number(b.spend ?? 0), 0);
  const revenue = last30.reduce((a, b) => a + Number(b.revenue ?? 0), 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = last30.reduce((a, b) => a + Number(b.conversions ?? 0), 0) > 0 ? spend / last30.reduce((a, b) => a + Number(b.conversions ?? 0), 0) : 0;
  const ctr = last30.length ? last30.reduce((a, b) => a + Number(b.ctr ?? 0), 0) / last30.length : 0;
  const latestHealth = data.health[0];

  async function generateReport() {
    setGenerating(true);
    const { data: res, error } = await supabase.functions.invoke("generate-report", { body: { client_id: clientId } });
    setGenerating(false);
    if (error || !res) return toast.error(error?.message ?? "Erro ao gerar relatório.");
    toast.success("Relatório gerado pela IA.");
    refetch();
    setTab("reports");
  }

  return (
    <div className="space-y-5 p-6">
      <Link to="/clients" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Clientes
      </Link>

      <header className="flex items-end justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-base font-semibold text-primary">{c.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{c.segment ?? "—"} · {c.status}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={generateReport} disabled={generating} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Gerar relatório IA
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={Sparkles} label="ROAS 30d" value={`${roas.toFixed(2)}x`} accent={roas >= 2 ? "text-success" : "text-warning"} />
        <Stat icon={Sparkles} label="Spend 30d" value={brl(spend)} />
        <Stat icon={Sparkles} label="Receita 30d" value={brl(revenue)} accent="text-success" />
        <Stat icon={Sparkles} label="CPA médio" value={brl(cpa)} />
        <Stat icon={Sparkles} label="CTR médio" value={pct(ctr)} />
      </div>

      <nav className="flex gap-1 border-b border-border">
        {(["overview","campaigns","alerts","reports","notes"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`relative px-3 py-2 text-sm capitalize transition ${tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "overview" ? "Visão geral" : t === "campaigns" ? "Campanhas" : t === "alerts" ? "Alertas" : t === "reports" ? "Relatórios" : "Notas"}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-px bg-primary" />}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title="Health Score" />
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-3">
                <div className="font-mono text-4xl font-semibold tabular">{latestHealth?.score ?? "--"}</div>
                {latestHealth && <RiskDot risk={latestHealth.risk} />}
              </div>
              {latestHealth && <ScoreBar score={latestHealth.score} />}
              <div className="space-y-2 pt-2">
                <Row label="Performance" value={String(latestHealth?.performance_score ?? "—")} />
                <Row label="Otimização" value={String(latestHealth?.optimization_score ?? "—")} />
                <Row label="Comunicação" value={String(latestHealth?.communication_score ?? "—")} />
                <Row label="Estabilidade" value={String(latestHealth?.stability_score ?? "—")} />
                <Row label="Engajamento" value={String(latestHealth?.engagement_score ?? "—")} />
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="Métricas (últimos 30 dias)" />
            <div className="grid grid-cols-2 gap-3 p-4">
              <Row label="Investimento" value={brl(spend)} />
              <Row label="Receita" value={brl(revenue)} accent="text-success" />
              <Row label="ROAS" value={`${roas.toFixed(2)}x`} accent={roas >= 2 ? "text-success" : "text-warning"} />
              <Row label="CPA" value={brl(cpa)} />
              <Row label="CTR médio" value={pct(ctr)} />
              <Row label="MRR" value={brl(c.mrr)} />
            </div>
          </Card>
        </div>
      )}

      {tab === "campaigns" && (
        <Card>
          {data.campaigns.length === 0 ? <Empty label="Nenhuma campanha cadastrada." /> :
            <div className="divide-y divide-border">
              {data.campaigns.map(cm => (
                <div key={cm.id} className="grid grid-cols-12 items-center px-4 py-3 text-sm">
                  <div className="col-span-5">
                    <div className="font-medium">{cm.name}</div>
                    <div className="text-xs text-muted-foreground">{cm.platform} · {cm.objective ?? "—"}</div>
                  </div>
                  <div className="col-span-3"><span className="rounded bg-surface px-2 py-0.5 text-[11px] uppercase">{cm.status}</span></div>
                  <div className="col-span-2 font-mono text-xs tabular text-muted-foreground">Diário</div>
                  <div className="col-span-2 text-right font-mono tabular">{brl(cm.daily_budget)}</div>
                </div>
              ))}
            </div>}
        </Card>
      )}

      {tab === "alerts" && (
        <Card>
          {data.alerts.length === 0 ? <Empty label="Sem alertas." /> :
            <div className="divide-y divide-border">
              {data.alerts.map(a => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{a.title}</div>
                    <span className="text-[11px] uppercase text-muted-foreground">{a.priority}</span>
                  </div>
                  {a.description && <div className="mt-0.5 text-xs text-muted-foreground">{a.description}</div>}
                  <div className="mt-1 text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</div>
                </div>
              ))}
            </div>}
        </Card>
      )}

      {tab === "reports" && (
        <div className="space-y-3">
          {data.reports.length === 0 && <Card><Empty label="Nenhum relatório IA. Clique em 'Gerar relatório IA'." /></Card>}
          {data.reports.map(r => (
            <Card key={r.id}>
              <CardHeader title={`Relatório · ${new Date(r.created_at).toLocaleDateString("pt-BR")}`} action={<button onClick={() => navigator.clipboard.writeText([r.executive_summary,r.positives,r.problems,r.opportunities,r.next_steps].filter(Boolean).join("\n\n"))} className="text-xs text-primary hover:underline">Copiar</button>} />
              <div className="space-y-3 p-4 text-sm">
                <ReportSection title="Resumo executivo" body={r.executive_summary} />
                <ReportSection title="Pontos positivos" body={r.positives} />
                <ReportSection title="Problemas identificados" body={r.problems} />
                <ReportSection title="Oportunidades" body={r.opportunities} />
                <ReportSection title="Próximos passos" body={r.next_steps} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "notes" && (
        <Card>
          {data.notes.length === 0 ? <Empty label="Sem notas." /> :
            <div className="divide-y divide-border">
              {data.notes.map(n => (
                <div key={n.id} className="px-4 py-3 text-sm">
                  <p>{n.content}</p>
                  <div className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</div>
                </div>
              ))}
            </div>}
        </Card>
      )}
    </div>
  );
}

function ReportSection({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">{title}</div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}

export const _u = { num, RefreshCw };
