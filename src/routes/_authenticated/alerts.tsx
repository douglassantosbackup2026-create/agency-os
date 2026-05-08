import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/format";
import { Card, CardHeader, Empty, PageSkeleton, PriorityDot } from "./dashboard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/alerts")({
  component: Alerts,
});

function Alerts() {
  const { agency } = useAuth();
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["alerts", agency?.id, filter],
    enabled: !!agency,
    queryFn: async () => {
      let q = supabase.from("alerts").select("*, clients(name)").eq("agency_id", agency!.id).order("created_at", { ascending: false }).limit(200);
      if (filter !== "all") q = q.eq("status", filter);
      const { data } = await q;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!agency) return;
    const ch = supabase.channel(`alerts:${agency.id}`).on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `agency_id=eq.${agency.id}` }, () => refetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [agency, refetch]);

  if (isLoading || !data) return <PageSkeleton />;

  async function resolve(id: string) {
    const { error } = await supabase.from("alerts").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Alerta resolvido."); refetch(); }
  }

  return (
    <div className="space-y-5 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Central de alertas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{data.length} alerta(s)</p>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-surface p-1">
          {(["open","resolved","all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded px-3 py-1.5 text-xs ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {f === "open" ? "Abertos" : f === "resolved" ? "Resolvidos" : "Todos"}
            </button>
          ))}
        </div>
      </header>

      <Card>
        {data.length === 0 ? <Empty label="Sem alertas." /> :
          <div className="divide-y divide-border">
            {data.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <PriorityDot p={a.priority} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.title}</span>
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{a.type}</span>
                    {a.clients?.name && <span className="text-[11px] text-muted-foreground">· {a.clients.name}</span>}
                  </div>
                  {a.description && <div className="mt-0.5 text-xs text-muted-foreground">{a.description}</div>}
                  {a.recommended_action && <div className="mt-1 text-xs text-primary">→ {a.recommended_action}</div>}
                  <div className="mt-1 text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</div>
                </div>
                {a.status === "open" && <button onClick={() => resolve(a.id)} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface-2 transition">Resolver</button>}
              </div>
            ))}
          </div>}
      </Card>
    </div>
  );
}
