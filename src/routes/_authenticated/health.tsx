import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { brl } from "@/lib/format";
import {
  Card,
  Empty,
  PageSkeleton,
  RiskDot,
  ScoreBar,
} from "@/components/operational-ui";
import type { Database } from "@/integrations/supabase/types";
import { throwIfSupabaseError } from "@/lib/supabase-result";
import { QueryErrorState } from "@/components/query-error-state";

type ClientBrief = Pick<
  Database["public"]["Tables"]["clients"]["Row"],
  "id" | "name" | "mrr" | "segment"
>;
type HealthLatest = Database["public"]["Tables"]["health_scores"]["Row"];
type ClientWithHealth = ClientBrief & HealthLatest;

export const Route = createFileRoute("/_authenticated/health")({
  component: Health,
});

function Health() {
  const { agency } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["health", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const [clients, scores] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, mrr, segment")
          .eq("agency_id", agency!.id),
        supabase
          .from("health_scores")
          .select("*")
          .eq("agency_id", agency!.id)
          .order("recorded_at", { ascending: false }),
      ]);
      throwIfSupabaseError(clients.error, "clients");
      throwIfSupabaseError(scores.error, "health_scores");
      const latest = new Map<string, HealthLatest>();
      for (const h of scores.data ?? [])
        if (!latest.has(h.client_id)) latest.set(h.client_id, h);
      return { clients: (clients.data ?? []) as ClientBrief[], latest };
    },
  });

  if (isError) {
    return (
      <QueryErrorState
        title="Não foi possível carregar o Health Score"
        message={
          error instanceof Error ? error.message : String(error ?? "Erro")
        }
        onRetry={() => void refetch()}
      />
    );
  }

  if (isLoading || !data) return <PageSkeleton />;

  const grouped: {
    high: ClientWithHealth[];
    medium: ClientWithHealth[];
    low: ClientWithHealth[];
    none: ClientBrief[];
  } = {
    high: [],
    medium: [],
    low: [],
    none: [],
  };
  for (const c of data.clients) {
    const h = data.latest.get(c.id);
    if (!h) grouped.none.push(c);
    else if (h.risk === "high" || h.risk === "medium" || h.risk === "low") {
      grouped[h.risk].push({ ...c, ...h });
    } else grouped.none.push(c);
  }

  return (
    <div className="space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Health Score</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Risco de churn por cliente, calculado a partir de performance,
          otimização, comunicação, estabilidade e engajamento.
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        <RiskColumn title="Alto risco" risk="high" items={grouped.high} />
        <RiskColumn title="Risco médio" risk="medium" items={grouped.medium} />
        <RiskColumn title="Saudáveis" risk="low" items={grouped.low} />
      </div>
      {grouped.none.length > 0 && (
        <Card>
          <div className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">
            Sem score calculado
          </div>
          <div className="divide-y divide-border">
            {grouped.none.map((c) => (
              <Link
                key={c.id}
                to="/clients/$clientId"
                params={{ clientId: c.id }}
                className="block px-4 py-3 text-sm hover:bg-surface-2"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function RiskColumn({
  title,
  risk,
  items,
}: {
  title: string;
  risk: string;
  items: ClientWithHealth[];
}) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <RiskDot risk={risk} />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <span className="font-mono text-xs text-muted-foreground tabular">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <Empty label="—" />
      ) : (
        <div className="divide-y divide-border">
          {items.map((c) => (
            <Link
              key={c.id}
              to="/clients/$clientId"
              params={{ clientId: c.id }}
              className="block px-4 py-3 hover:bg-surface-2 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{c.name}</span>
                <span className="font-mono text-sm tabular">{c.score}</span>
              </div>
              <div className="mt-1.5">
                <ScoreBar score={c.score} />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {brl(c.mrr)} MRR · {c.segment ?? "—"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
