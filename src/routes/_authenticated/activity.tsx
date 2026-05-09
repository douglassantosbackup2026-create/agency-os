import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/format";
import { Card, Empty, PageSkeleton } from "@/components/operational-ui";
import { throwIfSupabaseError } from "@/lib/supabase-result";
import { QueryErrorState } from "@/components/query-error-state";
import { Activity as Act } from "lucide-react";
import { useOperationClientScope } from "@/hooks/use-operation-client-scope";

export const Route = createFileRoute("/_authenticated/activity")({
  component: Feed,
});

function Feed() {
  const { agency } = useAuth();
  const { clientId: scopeClientId } = useOperationClientScope();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["activity", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const res = await supabase
        .from("activities")
        .select("*, clients(name)")
        .eq("agency_id", agency!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      throwIfSupabaseError(res.error, "activities");
      return res.data ?? [];
    },
  });

  const visible = useMemo(() => {
    if (!data) return [];
    if (!scopeClientId) return data;
    return data.filter(
      (a: { client_id?: string | null }) => a.client_id === scopeClientId,
    );
  }, [data, scopeClientId]);

  if (isError) {
    return (
      <QueryErrorState
        message={
          error instanceof Error ? error.message : String(error ?? "Erro")
        }
        onRetry={() => void refetch()}
      />
    );
  }
  if (isLoading || !data) return <PageSkeleton />;

  return (
    <div className="space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Feed operacional
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {scopeClientId
            ? "Filtrado pelo cliente selecionado no topo (atalho de carteira)."
            : "Histórico completo da operação."}
        </p>
      </header>
      <Card>
        {visible.length === 0 ? (
          <Empty label="Sem atividades." />
        ) : (
          <div className="divide-y divide-border">
            {visible.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <Act className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{a.title}</div>
                  {a.description && (
                    <div className="text-xs text-muted-foreground">
                      {a.description}
                    </div>
                  )}
                  {a.clients?.name && (
                    <div className="text-[11px] text-muted-foreground">
                      {a.clients.name}
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {timeAgo(a.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
