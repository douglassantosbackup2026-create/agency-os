import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Ad, AdAccount, AdSet, Campaign, Insights } from "@/types/meta";
import {
  clearMetaTestStorage,
  formatTokenPreview,
  generateMetaOAuthURL,
  getAdAccounts,
  getAds,
  getAdSets,
  getCampaigns,
  getInsights,
  isMetaTestTokenExpired,
  loadMetaTestJsonResult,
  loadMetaTestSession,
  saveMetaTestJsonResult,
  saveMetaTestSelection,
  secondsUntilExpiry,
} from "@/lib/meta-api-test";

export const Route = createFileRoute("/test-meta-oauth")({
  beforeLoad: () => {
    const allowHarness =
      import.meta.env.DEV ||
      import.meta.env.VITE_META_TEST_ENABLED === "true";
    if (!allowHarness) {
      throw redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    oauth_error:
      typeof search.oauth_error === "string" ? search.oauth_error : undefined,
  }),
  component: MetaTestOAuthPage,
});

type LoadingAction =
  | "connect"
  | "accounts"
  | "campaigns"
  | "insights"
  | "adsets"
  | "ads"
  | null;

function MetaTestOAuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [session, setSession] = useState(loadMetaTestSession);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState<LoadingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultType, setResultType] = useState<string | null>(
    () => loadMetaTestJsonResult().type,
  );
  const [resultJson, setResultJson] = useState<string | null>(
    () => loadMetaTestJsonResult().json,
  );

  const connected = !!session.accessToken;
  const expired = isMetaTestTokenExpired(session.expiresAt);
  const expirySeconds = secondsUntilExpiry(session.expiresAt);

  const refreshSession = useCallback(() => {
    setSession(loadMetaTestSession());
  }, []);

  useEffect(() => {
    if (!search.oauth_error) return;
    const msg = search.oauth_error;
    setError(msg);
    toast.error(`Meta OAuth: ${msg}`);
    void navigate({ to: "/test-meta-oauth", search: {}, replace: true });
  }, [search.oauth_error, navigate]);

  const setResult = useCallback((type: string, data: unknown) => {
    saveMetaTestJsonResult(type, data);
    setResultType(type);
    setResultJson(JSON.stringify(data, null, 2));
  }, []);

  const loadAccounts = useCallback(
    async (token: string) => {
      setLoading("accounts");
      setError(null);
      try {
        const data = await getAdAccounts(token);
        setAccounts(data);
        setResult("adaccounts", data);
        console.log("[test-meta-oauth] ad accounts loaded", data.length);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha ao listar contas";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(null);
      }
    },
    [setResult],
  );

  useEffect(() => {
    if (session.accessToken && !expired && accounts.length === 0) {
      void loadAccounts(session.accessToken);
    }
  }, [session.accessToken, expired, accounts.length, loadAccounts]);

  const handleConnect = async () => {
    setLoading("connect");
    setError(null);
    try {
      const url = await generateMetaOAuthURL();
      console.log("[test-meta-oauth] redirecting to Meta OAuth", url);
      window.location.href = url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao iniciar OAuth";
      setError(msg);
      toast.error(msg);
      setLoading(null);
    }
  };

  const handleClear = () => {
    clearMetaTestStorage();
    setSession(loadMetaTestSession());
    setAccounts([]);
    setCampaigns([]);
    setAdSets([]);
    setAds([]);
    setInsights(null);
    setResultType(null);
    setResultJson(null);
    setError(null);
    toast.message("Dados de teste removidos.");
  };

  const handleSelectAccount = (account: AdAccount) => {
    const id = account.id.startsWith("act_")
      ? account.id
      : `act_${account.account_id}`;
    saveMetaTestSelection({
      selectedAdAccountId: id,
      selectedCampaignId: null,
      selectedAdSetId: null,
    });
    setCampaigns([]);
    setAdSets([]);
    setAds([]);
    setInsights(null);
    refreshSession();
    toast.success(`Conta seleccionada: ${account.name ?? id}`);
  };

  const handleSelectCampaign = (campaign: Campaign) => {
    saveMetaTestSelection({
      selectedCampaignId: campaign.id,
      selectedAdSetId: null,
    });
    setAdSets([]);
    setAds([]);
    refreshSession();
    toast.success(`Campanha seleccionada: ${campaign.name}`);
  };

  const handleSelectAdSet = (adSet: AdSet) => {
    saveMetaTestSelection({ selectedAdSetId: adSet.id });
    setAds([]);
    refreshSession();
    toast.success(`Ad set seleccionado: ${adSet.name}`);
  };

  const token = session.accessToken;
  const selectedAccountId = session.selectedAdAccountId;
  const selectedCampaignId = session.selectedCampaignId;
  const selectedAdSetId = session.selectedAdSetId;

  const runWithToken = async (
    action: LoadingAction,
    fn: (t: string) => Promise<void>,
  ) => {
    if (!token) {
      toast.error("Conecte a Meta Ads primeiro.");
      return;
    }
    if (expired) {
      toast.error("Token expirado. Reconecte.");
      return;
    }
    setLoading(action);
    setError(null);
    try {
      await fn(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro na API Meta";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const statusBadge = useMemo(() => {
    if (!connected) {
      return <Badge variant="secondary">Desconectado</Badge>;
    }
    if (expired) {
      return <Badge variant="destructive">Token expirado</Badge>;
    }
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600">Conectado</Badge>
    );
  }, [connected, expired]);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Dev only
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Teste de integração Meta Ads
            </h1>
            {statusBadge}
          </div>
          <p className="text-sm text-muted-foreground">
            Harness local para OAuth e Marketing API. Dados guardados apenas em{" "}
            <code className="text-xs">localStorage</code>.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}



        <Card>
          <CardHeader>
            <CardTitle>Conexão OAuth</CardTitle>
            <CardDescription>
              Escopos: ads_read, ads_management, business_management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!connected || expired ? (
              <Button
                type="button"
                size="lg"
                className="h-12 w-full bg-emerald-600 text-base font-semibold hover:bg-emerald-700 sm:w-auto sm:min-w-[240px]"
                disabled={loading === "connect"}
                onClick={() => void handleConnect()}
              >
                {loading === "connect" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />A iniciar…
                  </>
                ) : (
                  "Conectar Meta Ads"
                )}
              </Button>
            ) : (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <span className="font-medium">Token: </span>
                    <code className="text-xs">{formatTokenPreview(token)}</code>
                  </div>
                </div>
                {expirySeconds != null && (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>
                      Expira em:{" "}
                      <strong className="tabular-nums">
                        {expirySeconds.toLocaleString("pt-BR")}
                      </strong>{" "}
                      segundos
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading === "accounts"}
                    onClick={() => token && void loadAccounts(token)}
                  >
                    {loading === "accounts" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Recarregar contas
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleClear}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Limpar dados
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {connected && !expired && (
          <Card>
            <CardHeader>
              <CardTitle>Minhas Ad Accounts</CardTitle>
              <CardDescription>
                Clique numa conta para seleccionar e buscar campanhas/insights.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading === "accounts" && accounts.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />A carregar contas…
                </div>
              ) : accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma ad account encontrada.
                </p>
              ) : (
                accounts.map((account) => {
                  const id = account.id.startsWith("act_")
                    ? account.id
                    : `act_${account.account_id}`;
                  const selected = selectedAccountId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectAccount(account)}
                      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition hover:bg-accent/50 ${
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border"
                      }`}
                    >
                      <div>
                        <div className="font-medium">
                          {account.name ?? "Sem nome"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {id}
                          {account.currency ? ` · ${account.currency}` : ""}
                        </div>
                      </div>
                      {selected && (
                        <Badge variant="outline">Seleccionada</Badge>
                      )}
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        {connected && !expired && selectedAccountId && (
          <Card>
            <CardHeader>
              <CardTitle>API — {selectedAccountId}</CardTitle>
              <CardDescription>
                Busque campanhas, insights e ad sets da conta seleccionada.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={loading === "campaigns"}
                onClick={() =>
                  void runWithToken("campaigns", async (t) => {
                    const data = await getCampaigns(t, selectedAccountId);
                    setCampaigns(data);
                    setResult("campaigns", data);
                  })
                }
              >
                {loading === "campaigns" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Buscar Campanhas
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={loading === "insights"}
                onClick={() =>
                  void runWithToken("insights", async (t) => {
                    const data = await getInsights(t, selectedAccountId, 90);
                    setInsights(data);
                    setResult("insights", data);
                  })
                }
              >
                {loading === "insights" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Buscar Insights (90 dias)
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!selectedCampaignId || loading === "adsets"}
                onClick={() =>
                  void runWithToken("adsets", async (t) => {
                    if (!selectedCampaignId) return;
                    const data = await getAdSets(t, selectedCampaignId);
                    setAdSets(data);
                    setResult("adsets", data);
                  })
                }
              >
                {loading === "adsets" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Buscar AdSets
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!selectedAdSetId || loading === "ads"}
                onClick={() =>
                  void runWithToken("ads", async (t) => {
                    if (!selectedAdSetId) return;
                    const data = await getAds(t, selectedAdSetId);
                    setAds(data);
                    setResult("ads", data);
                  })
                }
              >
                {loading === "ads" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Buscar Ads
              </Button>
            </CardContent>
          </Card>
        )}

        {campaigns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Campanhas ({campaigns.length})</CardTitle>
              <CardDescription>
                Seleccione uma campanha para buscar ad sets.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-64 space-y-2 overflow-y-auto">
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCampaign(c)}
                  className={`flex w-full flex-col rounded-md border px-3 py-2 text-left text-sm hover:bg-accent/50 ${
                    selectedCampaignId === c.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.id} · {c.status ?? "—"} · {c.objective ?? "—"}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {adSets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ad Sets ({adSets.length})</CardTitle>
              <CardDescription>
                Seleccione um ad set para buscar ads.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-64 space-y-2 overflow-y-auto">
              {adSets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleSelectAdSet(a)}
                  className={`flex w-full flex-col rounded-md border px-3 py-2 text-left text-sm hover:bg-accent/50 ${
                    selectedAdSetId === a.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <span className="font-medium">{a.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.id} · {a.status ?? "—"}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {(resultJson || insights) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle>Resultado JSON</CardTitle>
                <CardDescription>
                  Resposta raw da Marketing API (via Edge Function).
                </CardDescription>
              </div>
              {resultType && <Badge variant="outline">{resultType}</Badge>}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[min(60vh,480px)] rounded-md border bg-muted/40 p-4">
                <pre className="text-xs leading-relaxed whitespace-pre-wrap break-all font-mono">
                  {resultJson ?? JSON.stringify(insights, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        <Separator />

        <div className="flex justify-center pb-8">
          <Button type="button" variant="outline" onClick={handleClear}>
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar tudo e reconectar
          </Button>
        </div>
      </div>
    </div>
  );
}
