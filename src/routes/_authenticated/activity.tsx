import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/format";
import { Card, Empty, PageSkeleton } from "./dashboard";
import { Activity as Act } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({ component: Feed });

function Feed() {
  const { agency } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["activity", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const { data } = await supabase.from("activities").select("*, clients(name)").eq("agency_id", agency!.id).order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });
  if (isLoading || !data) return <PageSkeleton />;
  return (
    <div className="space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Feed operacional</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Histórico completo da operação.</p>
      </header>
      <Card>
        {data.length === 0 ? <Empty label="Sem atividades." /> :
          <div className="divide-y divide-border">
            {data.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <Act className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{a.title}</div>
                  {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                  {a.clients?.name && <div className="text-[11px] text-muted-foreground">{a.clients.name}</div>}
                </div>
                <div className="text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</div>
              </div>
            ))}
          </div>}
      </Card>
    </div>
  );
}
