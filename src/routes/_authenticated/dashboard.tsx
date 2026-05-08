import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { brl, num, pct, timeAgo } from "@/lib/format";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Database, Heart, Sparkles, TrendingUp, Users, Wallet, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { agency } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const [clients, metrics, alerts, activities, health] = await Promise.all([
        supabase.from("clients").select("id, name, status, mrr, monthly_budget").eq("agency_id", agency!.id),
        supabase.from("metrics_daily").select("date, spend, revenue, roas").eq("agency_id", agency!.id).gte("date", since),
        supabase.from("alerts").select("id, title, priority, created_at, type").eq("agency_id", agency!.id).eq("status", "open").order("priority", { ascending: false }).order("created_at", { ascending: false }).limit(8),
        supabase.from("activities").select("id, title, description, created_at, type").eq("agency_id", agency!.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("health_scores").select("client_id, score, risk, recorded_at").eq("agency_id", agency!.id).order("recorded_at", { ascending: false }),
      ]);
      return {
        clients: clients.data ?? [],
        metrics: metrics.data ?? [],
        alerts: alerts.data ?? [],
        activities: activities.data ?? [],
        health: health.data ?? [],
      };
    },
  });

  // realtime feed
  useEffect(() => {
    if (!agency) return;
    const ch = supabase.channel(`dash:${agency.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `agency_id=eq.${agency.id}` }, () => refetch())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activities", filter: `agency_id=eq.${agency.id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [agency, refetch]);

  if (isLoading || !data) return <PageSkeleton />;

  const spend = data.metrics.reduce((a, b) => a + Number(b.spend ?? 0), 0);
  const revenue = data.metrics.reduce((a, b) => a + Number(b.revenue ?? 0), 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const mrr = data.clients.reduce((a, b) => a + Number(b.mrr ?? 0), 0);
  const activeClients = data.clients.filter(c => c.status === "active").length;
  const latestHealth = new Map<string, { score: number; risk: string }>();
  for (const h of data.health) if (!latestHealth.has(h.client_id)) latestHealth.set(h.client_id, h);
  const atRisk = [...latestHealth.values()].filter(h => h.risk !== "low").length;
  const avgHealth = latestHealth.size ? [...latestHealth.values()].reduce((a, b) => a + b.score, 0) / latestHealth.size : 0;
  const criticals = data.alerts.filter(a => a.priority === "critical" || a.priority === "high").length;

  // empty state
  if (data.clients.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <div className="surface-card mx-auto rounded-2xl border border-border p-10">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Bem-vindo ao Retentio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Comece gerando dados de exemplo para explorar o sistema, ou crie seu primeiro cliente.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={async () => {
              const tid = toast.loading("Gerando dados...");
              const { error } = await supabase.functions.invoke("seed-demo-data");
              toast.dismiss(tid);
              if (error) toast.error(error.message);
              else { toast.success("Dados criados."); refetch(); }
            }} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition">
              <Database className="h-4 w-4" /> Gerar dados demo
            </button>
            <button onClick={() => navigate({ to: "/clients" })} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface transition">
              Criar cliente manualmente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Tudo que importa hoje, em tempo real.</p>
        </div>
        <div className="text-xs text-muted-foreground">Últimos 30 dias</div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Wallet} label="Faturamento gerenciado" value={brl(revenue)} accent="text-success" />
        <Stat icon={TrendingUp} label="ROAS médio" value={`${roas.toFixed(2)}x`} accent={roas >= 2 ? "text-success" : "text-warning"} />
        <Stat icon={Zap} label="Spend total" value={brl(spend)} />
        <Stat icon={Users} label="Clientes ativos" value={String(activeClients)} sub={`${data.clients.length} no total`} />
        <Stat icon={Heart} label="Health médio" value={`${avgHealth.toFixed(0)}`} accent={avgHealth >= 75 ? "text-success" : avgHealth >= 50 ? "text-warning" : "text-destructive"} sub={`${atRisk} em risco`} />
        <Stat icon={Bell} label="Alertas críticos" value={String(criticals)} accent={criticals > 0 ? "text-destructive" : "text-muted-foreground"} sub={`${data.alerts.length} abertos`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Alertas prioritários" action={<Link to="/alerts" className="text-xs text-primary hover:underline">Ver todos</Link>} />
          <div className="divide-y divide-border">
            {data.alerts.length === 0 && <Empty label="Nenhum alerta aberto. 🎉" />}
            {data.alerts.map(a => (
              <Link key={a.id} to="/alerts" className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2 transition">
                <PriorityDot p={a.priority} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{a.title}</span>
                    <Badge>{a.type}</Badge>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Resumo financeiro" />
          <div className="space-y-4 p-4">
            <Row label="MRR consolidado" value={brl(mrr)} />
            <Row label="Receita gerada (30d)" value={brl(revenue)} />
            <Row label="Investimento (30d)" value={brl(spend)} />
            <Row label="Margem (R / S)" value={`${roas.toFixed(2)}x`} />
            <Row label="Clientes em risco" value={`${atRisk}`} accent={atRisk > 0 ? "text-warning" : "text-success"} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Feed operacional" action={<Link to="/activity" className="text-xs text-primary hover:underline">Histórico</Link>} />
          <div className="divide-y divide-border">
            {data.activities.length === 0 && <Empty label="Sem atividade recente." />}
            {data.activities.map(a => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <Activity className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{a.title}</div>
                  {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                </div>
                <div className="text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Clientes por health" action={<Link to="/health" className="text-xs text-primary hover:underline">Ver tudo</Link>} />
          <div className="divide-y divide-border">
            {data.clients.slice(0, 8).map(c => {
              const h = latestHealth.get(c.id);
              const score = h?.score ?? 0;
              const risk = h?.risk ?? "low";
              return (
                <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition">
                  <RiskDot risk={risk} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">{brl(c.mrr)} MRR</div>
                  </div>
                  <div className="font-mono text-sm tabular">{score}</div>
                  <ScoreBar score={score} />
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function Stat({ icon: Icon, label, value, sub, accent }: { icon: React.ElementType; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="surface-card rounded-xl border border-border p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className={`mt-2 font-mono text-xl font-semibold tabular ${accent ?? ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`surface-card rounded-xl border border-border ${className ?? ""}`}>{children}</div>;
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {action}
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{label}</div>;
}

export function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium tabular ${accent ?? ""}`}>{value}</span>
    </div>
  );
}

export function PriorityDot({ p }: { p: string }) {
  const map: Record<string, string> = { critical: "bg-destructive", high: "bg-warning", medium: "bg-info", low: "bg-muted-foreground" };
  return <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${map[p] ?? "bg-muted-foreground"}`} />;
}

export function RiskDot({ risk }: { risk: string }) {
  const map: Record<string, string> = { low: "bg-success", medium: "bg-warning", high: "bg-destructive" };
  return <div className={`h-2 w-2 shrink-0 rounded-full ${map[risk] ?? "bg-muted-foreground"}`} />;
}

export function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-2">
      <div className={`h-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, score))}%` }} />
    </div>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{children}</span>;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-7 w-48 animate-pulse rounded bg-surface" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-xl bg-surface lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-xl bg-surface" />
      </div>
    </div>
  );
}

// unused but kept for potential
export const _unused = { ArrowDownRight, ArrowUpRight, AlertTriangle, num, pct };
