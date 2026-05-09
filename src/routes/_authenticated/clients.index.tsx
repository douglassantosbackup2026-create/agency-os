import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { brl } from "@/lib/format";
import { Plus, Search } from "lucide-react";
import {
  Card,
  CardHeader,
  Empty,
  PageSkeleton,
  RiskDot,
  ScoreBar,
} from "./dashboard";
import { toast } from "sonner";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
import {
  canCreateClient,
  type SubscriptionLimits,
} from "@/lib/subscription-limits";

export const Route = createFileRoute("/_authenticated/clients/")({
  component: Clients,
  validateSearch: (s) => ({ new: (s.new as string) || undefined }),
});

function Clients() {
  const { agency, user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [creating, setCreating] = useState(!!search.new);
  const [q, setQ] = useState("");
  const limits = useSubscriptionLimits();

  useEffect(() => {
    setCreating(!!search.new);
  }, [search.new]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["clients", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const sb = supabase as any;
      const { data: myRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("agency_id", agency!.id)
        .eq("user_id", user!.id);
      const canSeeAll = (myRoles ?? []).some(
        (r) => r.role === "owner" || r.role === "admin",
      );
      const { data: scopedRows } = canSeeAll
        ? { data: [] as any[] }
        : await sb
            .from("client_member_scopes")
            .select("client_id")
            .eq("agency_id", agency!.id)
            .eq("user_id", user!.id);

      let clientQuery = supabase
        .from("clients")
        .select("*")
        .eq("agency_id", agency!.id)
        .order("created_at", { ascending: false });
      if (!canSeeAll) {
        const ids = (scopedRows ?? []).map((x: any) => x.client_id);
        clientQuery = ids.length
          ? clientQuery.in("id", ids)
          : clientQuery.limit(0);
      }

      const [clients, health, openAlerts] = await Promise.all([
        clientQuery,
        supabase
          .from("health_scores")
          .select("client_id, score, risk, recorded_at, score_explanation")
          .eq("agency_id", agency!.id)
          .order("recorded_at", { ascending: false }),
        supabase
          .from("alerts")
          .select("client_id, title, type, created_at")
          .eq("agency_id", agency!.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      const latest = new Map<string, Record<string, unknown>>();
      for (const h of health.data ?? [])
        if (!latest.has(h.client_id)) latest.set(h.client_id, h as any);

      const latestGa4AlertByClient = new Map<
        string,
        { title: string; created_at: string }
      >();
      for (const a of openAlerts.data ?? []) {
        const cid = a.client_id as string | null;
        if (!cid || latestGa4AlertByClient.has(cid)) continue;
        const t =
          `${String(a.type ?? "")} ${String(a.title ?? "")}`.toLowerCase();
        if (!t.includes("ga4") && !t.includes("analytics")) continue;
        latestGa4AlertByClient.set(cid, {
          title: String(a.title ?? "Alerta GA4"),
          created_at: String(a.created_at ?? ""),
        });
      }

      return {
        clients: clients.data ?? [],
        latest,
        latestGa4AlertByClient,
      };
    },
  });

  if (isLoading || !data) return <PageSkeleton />;
  const filtered = data.clients.filter(
    (c) => !q || c.name.toLowerCase().includes(q.toLowerCase()),
  );
  const riskOrder: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  const riskRadar = [...filtered]
    .map((c) => ({ client: c, health: data.latest.get(c.id) as any }))
    .filter((x) => x.health)
    .sort(
      (a, b) =>
        (riskOrder[b.health.risk] ?? 0) - (riskOrder[a.health.risk] ?? 0) ||
        Number(a.health.score ?? 0) - Number(b.health.score ?? 0),
    )
    .slice(0, 4);

  return (
    <div className="space-y-5 p-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data.clients.length} cliente(s) na operação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar..."
              className="h-9 w-56 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </div>
          <button
            onClick={() => {
              const sub = limits.data?.subscription;
              const n = limits.data?.clientCount ?? 0;
              if (!canCreateClient(n, sub)) {
                toast.error(
                  `Limite do plano atingido (${sub?.max_clients ?? 5} clientes). Faça upgrade em Admin.`,
                );
                return;
              }
              setCreating(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Novo cliente
          </button>
        </div>
      </header>

      <Card>
        <div className="border-b border-border px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Client Risk Radar (prioridade de retenção)
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {riskRadar.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Sem clientes com score calculado.
              </div>
            ) : (
              riskRadar.map((item) => {
                const expl = item.health?.score_explanation as
                  | {
                      penalties?: Array<{ reason?: string }>;
                      signals?: {
                        roas_recent?: number;
                        roas_delta_pct?: number;
                        tracking_status?: string;
                      };
                      suggested_next_step?: string;
                    }
                  | undefined;
                const pen = (expl?.penalties ?? []).filter(Boolean) as Array<{
                  reason?: string;
                }>;
                const bullets = pen
                  .slice(0, 3)
                  .map((p) => p.reason)
                  .filter(Boolean);
                const sig = expl?.signals;
                const ga4Alert = data.latestGa4AlertByClient.get(
                  item.client.id,
                );
                const roasHint =
                  sig &&
                  typeof sig.roas_recent === "number" &&
                  typeof sig.roas_delta_pct === "number"
                    ? `ROAS ${sig.roas_recent.toFixed(2)} (${sig.roas_delta_pct >= 0 ? "+" : ""}${sig.roas_delta_pct.toFixed(0)}% vs período anterior)`
                    : null;
                const trackHint =
                  sig?.tracking_status === "critical"
                    ? "Tracking GA4 em estado crítico."
                    : sig?.tracking_status === "warning"
                      ? "Tracking GA4 em atenção."
                      : null;
                return (
                  <div
                    key={item.client.id}
                    className="rounded border border-border bg-surface px-2.5 py-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{item.client.name}</div>
                      <Link
                        to="/actions"
                        className="shrink-0 text-[10px] text-primary hover:underline"
                      >
                        Ações
                      </Link>
                    </div>
                    <div className="text-muted-foreground">
                      risco {item.health.risk} · health {item.health.score}
                    </div>
                    {roasHint && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {roasHint}
                      </p>
                    )}
                    {trackHint && (
                      <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-400">
                        {trackHint}
                      </p>
                    )}
                    {ga4Alert && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Alerta GA4: {ga4Alert.title}
                      </p>
                    )}
                    {bullets.length > 0 && (
                      <ul className="mt-1.5 list-inside list-disc text-[10px] text-muted-foreground">
                        {bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {expl?.suggested_next_step && (
                      <p className="mt-2 rounded bg-primary/10 px-2 py-1 text-[10px] font-medium text-foreground">
                        Próximo passo: {expl.suggested_next_step}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="grid grid-cols-12 border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <div className="col-span-4">Cliente</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">MRR</div>
          <div className="col-span-2">Orçamento</div>
          <div className="col-span-2 text-right">Health</div>
        </div>
        {filtered.length === 0 && <Empty label="Nenhum cliente." />}
        {filtered.map((c) => {
          const h = data.latest.get(c.id);
          return (
            <Link
              key={c.id}
              to="/clients/$clientId"
              params={{ clientId: c.id }}
              className="grid grid-cols-12 items-center border-b border-border px-4 py-3 text-sm last:border-0 hover:bg-surface-2 transition"
            >
              <div className="col-span-4 flex items-center gap-2.5">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-[11px] font-semibold text-primary">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.name}</div>
                  {c.segment && (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {c.segment}
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <StatusPill status={c.status} />
              </div>
              <div className="col-span-2 font-mono tabular text-sm">
                {brl(c.mrr)}
              </div>
              <div className="col-span-2 font-mono tabular text-sm text-muted-foreground">
                {brl(c.monthly_budget)}
              </div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                {h ? (
                  <>
                    <RiskDot risk={h.risk} />
                    <span className="font-mono tabular text-sm">{h.score}</span>
                    <ScoreBar score={h.score} />
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </Link>
          );
        })}
      </Card>

      {creating && (
        <NewClientDialog
          onClose={() => {
            setCreating(false);
            navigate({ to: "/clients", search: {} });
            refetch();
            limits.refetch();
          }}
          agencyId={agency!.id}
          clientCount={limits.data?.clientCount ?? 0}
          subscription={limits.data?.subscription ?? null}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success",
    paused: "bg-warning/15 text-warning",
    onboarding: "bg-info/15 text-info",
    churned: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

function NewClientDialog({
  onClose,
  agencyId,
  clientCount,
  subscription,
}: {
  onClose: () => void;
  agencyId: string;
  clientCount: number;
  subscription: SubscriptionLimits | null;
}) {
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [mrr, setMrr] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreateClient(clientCount, subscription)) {
      toast.error(
        `Limite do plano: máximo ${subscription?.max_clients ?? 5} clientes.`,
      );
      return;
    }
    setLoading(true);
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("clients").insert({
      agency_id: agencyId,
      name,
      segment: segment || null,
      mrr: Number(mrr) || 0,
      monthly_budget: Number(budget) || 0,
      portal_slug: slug,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cliente criado.");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface-card w-full max-w-md rounded-xl border border-border p-5 shadow-2xl"
      >
        <CardHeader title="Novo cliente" />
        <form onSubmit={submit} className="space-y-3 pt-4">
          <DField label="Nome" value={name} onChange={setName} autoFocus />
          <DField
            label="Segmento"
            value={segment}
            onChange={setSegment}
            placeholder="E-commerce, SaaS, ..."
          />
          <div className="grid grid-cols-2 gap-3">
            <DField
              label="MRR (R$)"
              value={mrr}
              onChange={setMrr}
              type="number"
            />
            <DField
              label="Orçamento mensal (R$)"
              value={budget}
              onChange={setBudget}
              type="number"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface transition"
            >
              Cancelar
            </button>
            <button
              disabled={loading || !name}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition"
            >
              Criar cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
      />
    </label>
  );
}
