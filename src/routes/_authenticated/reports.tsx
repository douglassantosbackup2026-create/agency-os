import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/format";
import { Card, Empty, PageSkeleton } from "./dashboard";

export const Route = createFileRoute("/_authenticated/reports")({ component: Reports });

function Reports() {
  const { agency } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["reports", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const { data } = await supabase.from("reports").select("*, clients(id, name)").eq("agency_id", agency!.id).order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  if (isLoading || !data) return <PageSkeleton />;
  return (
    <div className="space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios IA</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Análises geradas a partir das métricas reais de cada cliente.</p>
      </header>
      <Card>
        {data.length === 0 ? <Empty label="Nenhum relatório gerado. Vá até um cliente e clique em 'Gerar relatório IA'." /> :
          <div className="divide-y divide-border">
            {data.map((r: any) => (
              <Link key={r.id} to="/clients/$clientId" params={{ clientId: r.client_id }} className="block px-4 py-3 hover:bg-surface-2 transition">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{r.clients?.name}</div>
                  <div className="text-[11px] text-muted-foreground">{timeAgo(r.created_at)}</div>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.executive_summary}</p>
              </Link>
            ))}
          </div>}
      </Card>
    </div>
  );
}
