import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Plug,
  RefreshCw,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardHeader, PageSkeleton } from "./dashboard";
import { timeAgo } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: Integrations,
});

function cfgSyncDays(cfg: unknown): number {
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return 7;
  const n = Number((cfg as Record<string, unknown>).sync_days);
  return Number.isFinite(n) && n >= 1 && n <= 90 ? Math.round(n) : 7;
}

function cfgMetaGranularity(cfg: unknown): "campaign" | "account" {
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return "campaign";
  return (cfg as Record<string, unknown>).meta_granularity === "account"
    ? "account"
    : "campaign";
}

const PROVIDERS = [
  { key: "meta_ads", name: "Meta Ads", desc: "Facebook & Instagram Ads" },
  { key: "google_ads", name: "Google Ads", desc: "Search, Display, YouTube" },
  { key: "tiktok_ads", name: "TikTok Ads", desc: "TikTok For Business" },
  {
    key: "google_analytics",
    name: "Google Analytics 4",
    desc: "GA4 conversões e receita",
  },
];

function Integrations() {
  const { agency } = useAuth();
  const [editing, setEditing] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [accountId, setAccountId] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [oauthBusy, setOauthBusy] = useState<string | null>(null);
  const [manualClientId, setManualClientId] = useState("");
  const [manualCsv, setManualCsv] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["integrations", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const [integ, clients] = await Promise.all([
        supabase.from("integrations").select("*").eq("agency_id", agency!.id),
        supabase
          .from("clients")
          .select("id, name")
          .eq("agency_id", agency!.id)
          .order("name"),
      ]);
      return { integ: integ.data ?? [], clients: clients.data ?? [] };
    },
  });

  async function save(provider: string) {
    if (!apiKey.trim()) return toast.error("Informe a API key");
    const existing = data?.integ.find((i) => i.provider === provider);
    if (existing) {
      const { error } = await supabase
        .from("integrations")
        .update({
          status: "connected",
          api_key_encrypted: apiKey,
          account_id: accountId || null,
        })
        .eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("integrations").insert({
        agency_id: agency!.id,
        provider:
          provider as Database["public"]["Enums"]["integration_provider"],
        status: "connected",
        api_key_encrypted: apiKey,
        account_id: accountId || null,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("Integração conectada.");
    setEditing(null);
    setApiKey("");
    setAccountId("");
    refetch();
  }

  async function updateIntegrationConfig(
    providerKey: string,
    patch: Record<string, unknown>,
  ) {
    const existing = data?.integ.find((i) => i.provider === providerKey);
    if (!existing?.id) return;
    const base =
      existing.config &&
      typeof existing.config === "object" &&
      !Array.isArray(existing.config)
        ? { ...(existing.config as Record<string, unknown>) }
        : {};
    const next = { ...base, ...patch };
    const { error } = await supabase
      .from("integrations")
      .update({ config: next })
      .eq("id", existing.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Preferências de sincronização guardadas.");
      refetch();
    }
  }

  async function startOAuth(provider: string) {
    setOauthBusy(provider);
    const { data, error } = await supabase.functions.invoke(
      "integration-oauth",
      { body: { action: "start", provider } },
    );
    setOauthBusy(null);
    if (error) return toast.error(error.message);
    const url = (data as { url?: string })?.url;
    const err = (data as { error?: string })?.error;
    if (err) return toast.error(err);
    if (url) window.location.href = url;
    else toast.error("URL OAuth não devolvida — configure secrets.");
  }

  async function disconnect(id: string) {
    if (!confirm("Desconectar integração?")) return;
    const { error } = await supabase
      .from("integrations")
      .update({
        status: "disconnected",
        api_key_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Desconectada.");
    refetch();
  }

  async function syncAll(provider: string) {
    if (!data) return;
    setSyncing(provider);
    let ok = 0,
      fail = 0;
    for (const c of data.clients) {
      const { error } = await supabase.functions.invoke("sync-platform", {
        body: { provider, client_id: c.id },
      });
      if (error) fail++;
      else ok++;
    }
    setSyncing(null);
    toast[fail ? "error" : "success"](`Sync: ${ok} ok, ${fail} falhas`);
  }

  async function importManualCsv() {
    if (!manualClientId || !manualCsv.trim()) {
      toast.error("Selecione cliente e informe CSV.");
      return;
    }
    const lines = manualCsv
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      toast.error("CSV inválido. Use cabeçalho + pelo menos 1 linha.");
      return;
    }
    const head = lines[0].split(",").map((x) => x.trim().toLowerCase());
    const idx = (k: string) => head.indexOf(k);
    const colDate = idx("date");
    if (colDate < 0) return toast.error("CSV precisa da coluna date.");
    const client = data?.clients.find((c) => c.id === manualClientId);
    if (!client) return toast.error("Cliente inválido.");
    setManualLoading(true);
    const payload = lines.slice(1).map((line) => {
      const p = line.split(",").map((x) => x.trim());
      const spend = Number(p[idx("spend")] ?? 0) || 0;
      const revenue = Number(p[idx("revenue")] ?? 0) || 0;
      const conv = Number(p[idx("conversions")] ?? 0) || 0;
      return {
        agency_id: agency!.id,
        client_id: manualClientId,
        date: p[colDate],
        spend,
        revenue,
        conversions: conv,
        roas: spend > 0 ? revenue / spend : 0,
        cpa: conv > 0 ? spend / conv : 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        data_source: "manual_csv",
        data_reliability: "medium",
      };
    });
    const { error } = await supabase.from("metrics_daily").insert(payload);
    setManualLoading(false);
    if (error) return toast.error(error.message);
    toast.success(`Importação manual concluída (${payload.length} linhas).`);
    setManualCsv("");
  }

  if (isLoading || !data) return <PageSkeleton preset="compact" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Conecte suas plataformas de mídia e analytics para puxar métricas
          reais.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {PROVIDERS.map((p) => {
          const conn = data.integ.find((i) => i.provider === p.key);
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
                    <span className="text-xs text-muted-foreground">
                      {p.desc}
                    </span>
                  </div>
                </div>

                {isConnected && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {conn?.account_id && (
                      <div>
                        Conta:{" "}
                        <span className="font-mono">{conn.account_id}</span>
                      </div>
                    )}
                    <div>
                      Última sync:{" "}
                      {conn?.last_sync_at ? timeAgo(conn.last_sync_at) : "—"}
                    </div>
                    {conn?.token_expires_at && (
                      <div>
                        Token OAuth até:{" "}
                        {new Date(conn.token_expires_at).toLocaleString(
                          "pt-BR",
                        )}
                      </div>
                    )}
                  </div>
                )}

                {isConnected && (
                  <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
                    <div className="font-medium text-foreground">
                      Janela de sincronização
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="text-muted-foreground">
                        Dias de histórico nas APIs (1–90)
                      </span>
                      <select
                        value={cfgSyncDays(conn?.config)}
                        onChange={(e) =>
                          updateIntegrationConfig(p.key, {
                            sync_days: Number(e.target.value),
                          })
                        }
                        className="h-8 rounded-md border border-border bg-background px-2"
                      >
                        {[7, 14, 30, 60, 90].map((d) => (
                          <option key={d} value={d}>
                            {d} dias
                          </option>
                        ))}
                      </select>
                    </label>
                    {p.key === "meta_ads" && (
                      <label className="flex flex-col gap-1">
                        <span className="text-muted-foreground">
                          Granularidade Meta
                        </span>
                        <select
                          value={cfgMetaGranularity(conn?.config)}
                          onChange={(e) =>
                            updateIntegrationConfig(p.key, {
                              meta_granularity: e.target.value,
                            })
                          }
                          className="h-8 rounded-md border border-border bg-background px-2"
                        >
                          <option value="campaign">
                            Por campanha (recomendado)
                          </option>
                          <option value="account">
                            Apenas conta (agregado)
                          </option>
                        </select>
                      </label>
                    )}
                  </div>
                )}

                {isEditing && (
                  <div className="space-y-2 rounded-md border border-border bg-surface p-3">
                    <input
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="API key / token"
                      className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs"
                    />
                    <input
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      placeholder="Account ID (opcional)"
                      className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => save(p.key)}
                        className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => {
                          setEditing(null);
                          setApiKey("");
                        }}
                        className="rounded border border-border px-3 py-1 text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {!isEditing && (
                    <>
                      <button
                        type="button"
                        disabled={oauthBusy === p.key}
                        onClick={() => startOAuth(p.key)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                      >
                        {oauthBusy === p.key ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3 w-3" />
                        )}
                        OAuth (recomendado)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(p.key);
                          setApiKey("");
                          setAccountId(conn?.account_id ?? "");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2"
                      >
                        <Plug className="h-3 w-3" /> Token manual
                      </button>
                    </>
                  )}
                  {isConnected && (
                    <>
                      <button
                        disabled={syncing === p.key}
                        onClick={() => syncAll(p.key)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                      >
                        {syncing === p.key ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Sincronizar todos clientes
                      </button>
                      <button
                        onClick={() => disconnect(conn!.id)}
                        className="rounded-md px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                      >
                        Desconectar
                      </button>
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
          <p>
            • <strong>Meta Ads:</strong> token + <strong>Account ID</strong>.
            Sync via Marketing API: insights por <strong>campanha</strong>{" "}
            (fallback nível conta) — janela configurável acima — atualiza também
            a tabela <code className="rounded bg-surface px-1">campaigns</code>.
          </p>
          <p>
            • <strong>Google Analytics 4:</strong>{" "}
            <strong>access token OAuth</strong> com escopo de leitura (ex.{" "}
            <code className="text-[10px]">analytics.readonly</code>) no campo
            API key + <strong>Property ID</strong> no campo Account (número ou{" "}
            <code className="text-[10px]">properties/123</code>).
          </p>
          <p>
            • <strong>OAuth:</strong> use o botão OAuth — configure secrets na
            Edge Function{" "}
            <code className="rounded bg-surface px-1">integration-oauth</code>{" "}
            (ver README). Redirect:{" "}
            <code className="text-[10px]">.../integrations/oauth/callback</code>
            .
          </p>
          <p>
            • <strong>Google Ads:</strong> após OAuth, indique o{" "}
            <strong>Customer ID</strong> (token manual ou edição). É preciso{" "}
            <code className="rounded bg-surface px-1">
              GOOGLE_ADS_DEVELOPER_TOKEN
            </code>{" "}
            nas secrets do projeto para sync real.
          </p>
          <p>
            • <strong>TikTok:</strong> OAuth + <strong>Advertiser ID</strong> no
            campo conta; sync por relatório integrado (janela configurável).
          </p>
          <p>
            • Use &quot;Sincronizar todos clientes&quot; após conectar cada
            provedor.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Modo manual / importação CSV" />
        <div className="space-y-2 p-4 text-xs">
          <p className="text-muted-foreground">
            Formato esperado: <code>date,spend,revenue,conversions</code>.
            Linhas são gravadas como{" "}
            <code className="rounded bg-surface px-1">manual_csv</code> com
            confiabilidade{" "}
            <code className="rounded bg-surface px-1">medium</code>.
          </p>
          <select
            value={manualClientId}
            onChange={(e) => setManualClientId(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2"
          >
            <option value="">Selecione o cliente</option>
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <textarea
            rows={6}
            value={manualCsv}
            onChange={(e) => setManualCsv(e.target.value)}
            className="w-full rounded-md border border-border bg-background p-2 font-mono text-[11px]"
            placeholder="date,spend,revenue,conversions&#10;2026-05-01,1200,3400,18"
          />
          <button
            type="button"
            disabled={manualLoading}
            onClick={importManualCsv}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {manualLoading ? "Importando..." : "Importar CSV"}
          </button>
        </div>
      </Card>
    </motion.div>
  );
}
