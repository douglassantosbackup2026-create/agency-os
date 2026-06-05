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
type CreativeAssetRow =
  Database["public"]["Tables"]["creative_assets"]["Row"] & {
    clients?: { name: string } | null;
  };

export const Route = createFileRoute("/_authenticated/creatives")({
  component: CreativesPage,
});

function CreativesPage() {
  const { agency } = useAuth();
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [description, setDescription] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["creatives", agency?.id],
    enabled: !!agency,
    meta: queryErrorMeta,
    queryFn: async () => {
      const [clientsRes, creativesRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name")
          .eq("agency_id", agency!.id)
          .order("name"),
        supabase
          .from("creative_assets")
          .select("*, clients(name)")
          .eq("agency_id", agency!.id)
          .order("created_at", { ascending: false }),
      ]);
      throwIfSupabaseError(clientsRes.error, "creatives.clients");
      throwIfSupabaseError(creativesRes.error, "creatives.creative_assets");
      return {
        clients: (clientsRes.data ?? []) as ClientMini[],
        creatives: (creativesRes.data ?? []) as CreativeAssetRow[],
      };
    },
  });

  async function createCreative() {
    if (!agency) return;
    if (!clientId || !title.trim()) {
      toast.error("Selecione cliente e título.");
      return;
    }
    const { error } = await supabase.from("creative_assets").insert({
      agency_id: agency.id,
      client_id: clientId,
      title: title.trim(),
      preview_url: previewUrl.trim() || null,
      description: description.trim() || null,
      status: "pending",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Criativo enviado para aprovação.");
    setTitle("");
    setPreviewUrl("");
    setDescription("");
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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Aprovação de criativos
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Centralize aprovação/reprovação no portal do cliente.
        </p>
      </header>

      <Card>
        <CardHeader title="Novo criativo" />
        <div className="grid gap-2 p-4 md:grid-cols-2">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Selecione o cliente</option>
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do criativo"
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
          <input
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
            placeholder="URL do preview (imagem/vídeo)"
            className="h-9 rounded-md border border-border bg-background px-3 text-sm md:col-span-2"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição para o cliente"
            className="min-h-20 rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <button
            type="button"
            onClick={createCreative}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground md:col-span-2"
          >
            Enviar para aprovação
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Fila de aprovação" />
        {data.creatives.length === 0 ? (
          <Empty label="Nenhum criativo cadastrado." />
        ) : (
          <div className="divide-y divide-border">
            {data.creatives.map((it: any) => (
              <div
                key={it.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{it.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.clients?.name ?? "Cliente"} · {it.status}
                  </div>
                </div>
                {it.preview_url ? (
                  <a
                    href={it.preview_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Ver preview
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Sem preview
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
