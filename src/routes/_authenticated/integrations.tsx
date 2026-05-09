import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Plug, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardHeader, PageSkeleton } from "./dashboard";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/integrations")({ component: Integrations });

const PROVIDERS = [
  { key: "meta_ads", name: "Meta Ads", desc: "Facebook & Instagram Ads" },
  { key: "google_ads", name: "Google Ads", desc: "Search, Display, YouTube" },
  { key: "tiktok_ads", name: "TikTok Ads", desc: "TikTok For Business" },
  { key: "google_analytics", name: "Google Analytics 4", desc: "GA4 conversões e receita" },
];

function Integrations() {
  const { agency } = useAuth();
  const [editing, setEditing] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [accountId, setAccountId] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["integrations", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const [integ, clients] = await Promise.all([
        supabase.from("integrations").select("*").eq("agency_id", agency!.id),
        supabase.from("clients").select("id, name").eq("agency_id", agency!.id).order("name"),
      ]);
      return { integ: integ.data ?? [], clients: clients.data ?? [] };
    },
  });

  async function save(provider: string) {
    if (!apiKey.trim()) return toast.error("Informe a API key");
    const existing = data?.integ.find(i => i.provider === provider);
    if (existing) {
      const { error } = await supabase.from("integrations").update({
        status: "connected", api_key_encrypted: apiKey, account_id: accountId || null,
      }).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("integrations").insert({
        agency_id: agency!.id, provider, status: "connected",
        api_key_encrypted: apiKey, account_id: accountId || null,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("Integração conectada.");
    setEditing(null); setApiKey(""); setAccountId("");
    refetch();
  }

  async function disconnect(id: string) {
    if (!confirm("Desconectar integração?")) return;
    const { error } = await supabase.from("integrations").update({ status: "disconnected", api_key_encrypted: null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Desconectada.");
    refetch();
  }

  async function syncAll(provider: string) {
    if (!data) return;
    setSyncing(provider);
    let ok = 0, fail = 0;
    for (const c of data.clients) {
      const { error } = await supabase.functions.invoke("sync-platform", { body: { provider, client_id: c.id } });
      if (error) fail++; else ok++;
    }
    setSyncing(null);
    toast[fail ? "error" : "success"](`Sync: ${ok} ok, ${fail} falhas`);
  }

  if (isLoading || !data) return <PageSkeleton />;

  return (
    <div className="space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Conecte suas plataformas de mídia e analytics para puxar métricas reais.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {PROVIDERS.map(p => {
          const conn = data.integ.find(i => i.provider === p.key);
          const isConnected = conn?.status === "connected";
          const isEditing = editing === p.key;
          return (
            <Card key={p.key}>
              <CardHeader title={p.name} />
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Conectado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                        <XCircle className="h-3 w-3" /> Desconectado
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{p.desc}</span>
                  </div>
                </div>

                {isConnected && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {conn?.account_id && <div>Conta: <span className="font-mono">{conn.account_id}</span></div>}
                    <div>Última sync: {conn?.last_sync_at ? timeAgo(conn.last_sync_at) : "—"}</div>
                  </div>
                )}

                {isEditing && (
                  <div className="space-y-2 rounded-md border border-border bg-surface p-3">
                    <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API key / token" className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs" />
                    <input value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="Account ID (opcional)" className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs" />
                    <div className="flex gap-2">
                      <button onClick={() => save(p.key)} className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Salvar</button>
                      <button onClick={() => { setEditing(null); setApiKey(""); }} className="rounded border border-border px-3 py-1 text-xs">Cancelar</button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {!isEditing && (
                    <button onClick={() => { setEditing(p.key); setApiKey(""); setAccountId(conn?.account_id ?? ""); }} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2">
                      <Plug className="h-3 w-3" /> {isConnected ? "Reconectar" : "Conectar"}
                    </button>
                  )}
                  {isConnected && (
                    <>
                      <button disabled={syncing === p.key} onClick={() => syncAll(p.key)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
                        {syncing === p.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Sincronizar todos clientes
                      </button>
                      <button onClick={() => disconnect(conn!.id)} className="rounded-md px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">Desconectar</button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader title="Como funciona" />
        <div className="space-y-2 p-4 text-xs text-muted-foreground">
          <p>• Cole a API key/token gerado no painel de cada plataforma.</p>
          <p>• Clique em "Sincronizar" para puxar métricas dos últimos 7 dias para todos os clientes.</p>
          <p>• Por enquanto, a sync usa dados simulados baseados no orçamento mensal de cada cliente. OAuth real para Meta/Google/TikTok/GA4 exige apps aprovados em cada plataforma — disponível como upgrade.</p>
        </div>
      </Card>
    </div>
  );
}
