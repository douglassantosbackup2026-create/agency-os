import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardHeader,
  Empty,
  PageSkeleton,
} from "@/components/operational-ui";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { throwIfSupabaseError, queryErrorMeta } from "@/lib/supabase-result";
import { QueryErrorState } from "@/components/query-error-state";

type ClientMini = Pick<
  Database["public"]["Tables"]["clients"]["Row"],
  "id" | "name"
>;
type WatchlistRow =
  Database["public"]["Tables"]["competitor_watchlist"]["Row"] & {
    clients?: { name?: string | null } | null;
  };
type SnapshotRow =
  Database["public"]["Tables"]["competitor_snapshots"]["Row"] & {
    competitor_watchlist?: { competitor_name?: string | null } | null;
  };

export const Route = createFileRoute("/_authenticated/competitors")({
  component: CompetitorsPage,
});

function CompetitorsPage() {
  const { agency } = useAuth();
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["competitors", agency?.id],
    enabled: !!agency,
    meta: queryErrorMeta,
    queryFn: async () => {
      const [clientsRes, wlRes, snapRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name")
          .eq("agency_id", agency!.id)
          .order("name"),
        supabase
          .from("competitor_watchlist")
          .select("*, clients(name)")
          .eq("agency_id", agency!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("competitor_snapshots")
          .select("*, competitor_watchlist(competitor_name)")
          .eq("agency_id", agency!.id)
          .order("captured_at", { ascending: false })
          .limit(30),
      ]);
      throwIfSupabaseError(clientsRes.error, "competitors.clients");
      throwIfSupabaseError(wlRes.error, "competitors.watchlist");
      throwIfSupabaseError(snapRes.error, "competitors.snapshots");
      return {
        clients: clientsRes.data ?? [],
        watchlist: wlRes.data ?? [],
        snapshots: snapRes.data ?? [],
      };
    },
  });

  async function addCompetitor() {
    if (!agency) return;
    if (!clientId || !name.trim()) {
      toast.error("Selecione cliente e concorrente.");
      return;
    }
    const { error } = await supabase.from("competitor_watchlist").insert({
      agency_id: agency.id,
      client_id: clientId,
      competitor_name: name.trim(),
      source_url: sourceUrl.trim() || null,
      is_active: true,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setSourceUrl("");
    toast.success("Concorrente adicionado.");
    refetch();
  }

  async function syncNow() {
    if (!agency) return;
    const { data: res, error } = await supabase.functions.invoke(
      "sync-competitors",
      { body: { agency_id: agency.id } },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    const created =
      res && typeof res === "object" && "created" in res
        ? Number((res as { created?: number }).created ?? 0)
        : 0;
    toast.success(`Snapshots criados: ${created}`);
    refetch();
  }

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

  if (isLoading || !data) return <PageSkeleton preset="compact" />;

  return (
    <div className="space-y-5 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Inteligência de concorrentes
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Monitoramento MVP com snapshots semanais.
          </p>
        </div>
        <button
          type="button"
          onClick={syncNow}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Rodar coleta agora
        </button>
      </header>

      <Card>
        <CardHeader title="Watchlist" />
        <div className="grid gap-2 p-4 md:grid-cols-4">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Cliente</option>
            {data.clients.map((c: ClientMini) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do concorrente"
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="URL fonte (opcional)"
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
          <button
            type="button"
            onClick={addCompetitor}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
          >
            Adicionar
          </button>
        </div>
        {data.watchlist.length === 0 ? (
          <Empty label="Nenhum concorrente cadastrado." />
        ) : (
          <div className="divide-y divide-border">
            {data.watchlist.map((w: WatchlistRow) => (
              <div key={w.id} className="px-4 py-2 text-sm">
                <div className="font-medium">{w.competitor_name}</div>
                <div className="text-xs text-muted-foreground">
                  {w.clients?.name ?? "Cliente"} · {w.source_url || "sem URL"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Snapshots recentes" />
        {data.snapshots.length === 0 ? (
          <Empty label="Sem snapshots ainda." />
        ) : (
          <div className="divide-y divide-border">
            {data.snapshots.map((s: SnapshotRow) => (
              <div key={s.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="font-medium">{s.headline}</div>
                <div className="text-xs text-muted-foreground">
                  {s.competitor_watchlist?.competitor_name ?? "Concorrente"} ·{" "}
                  {new Date(s.captured_at).toLocaleString("pt-BR")} · anúncios:{" "}
                  {s.ad_count ?? 0}
                </div>
                {s.insight ? <div className="text-sm">{s.insight}</div> : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
