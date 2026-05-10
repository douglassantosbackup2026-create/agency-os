import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Plug,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { edgeFunctionErrorMessage } from "@/lib/edge-function-error";
import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  Empty,
  PageSkeleton,
} from "@/components/operational-ui";

export const Route = createFileRoute("/_authenticated/platform-admin")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) throw redirect({ to: "/login" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", session.user.id)
      .maybeSingle();
    if (!profile?.is_platform_admin) throw redirect({ to: "/dashboard" });
  },
  component: PlatformAdmin,
});

type OverviewRow = {
  agencies_count: number;
  profiles_with_agency_count: number;
  clients_count: number;
};

type AgencyRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

type OAuthEnvStatus = {
  integration_oauth_state_secret_ok: boolean;
  public_site_url_ok: boolean;
  meta_app_id_ok: boolean;
  meta_app_secret_ok: boolean;
  google_oauth_client_id_ok: boolean;
  google_oauth_client_secret_ok: boolean;
  tiktok_client_or_app_id_ok: boolean;
  tiktok_secret_ok: boolean;
};

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
  ) : (
    <XCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
  );
}

function PlatformAdmin() {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["platform-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [overviewRes, agenciesRes, oauthRes] = await Promise.all([
        supabase.rpc("platform_overview_counts"),
        supabase.rpc("platform_list_agencies_minimal"),
        supabase.functions.invoke("oauth-env-status", { body: {} }),
      ]);

      if (overviewRes.error) throw overviewRes.error;
      if (agenciesRes.error) throw agenciesRes.error;

      const raw = (overviewRes.data ?? [])[0] as
        | OverviewRow
        | undefined;
      const overview = raw
        ? {
            agencies_count: Number(raw.agencies_count),
            profiles_with_agency_count: Number(
              raw.profiles_with_agency_count,
            ),
            clients_count: Number(raw.clients_count),
          }
        : undefined;
      const agencies = (agenciesRes.data ?? []) as AgencyRow[];

      let oauthStatus: OAuthEnvStatus | null = null;
      let oauthFnError: string | null = null;
      if (oauthRes.error) {
        oauthFnError = await edgeFunctionErrorMessage(
          oauthRes.error,
          oauthRes.error.message,
        );
      } else if (oauthRes.data && typeof oauthRes.data === "object") {
        oauthStatus = oauthRes.data as OAuthEnvStatus;
      }

      return { overview, agencies, oauthStatus, oauthFnError };
    },
  });

  if (isLoading)
    return <PageSkeleton preset="compact" />;

  if (error) {
    return (
      <div className="p-6">
        <Empty
          label={(error as Error).message}
          action={
            <Button type="button" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  const overview = data?.overview;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2 text-primary">
          <Globe className="h-6 w-6" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Administração da plataforma
          </h1>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Visão global da instância (todas as agências). Isto é independente de{" "}
          <strong>Equipa e auditoria</strong> no menu, que gere só a tua agência.
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader title="Agências" />
          <div className="p-4 text-3xl font-semibold tabular-nums">
            {overview?.agencies_count ?? "—"}
          </div>
        </Card>
        <Card>
          <CardHeader title="Perfis com agência" />
          <div className="p-4 text-3xl font-semibold tabular-nums">
            {overview?.profiles_with_agency_count ?? "—"}
          </div>
        </Card>
        <Card>
          <CardHeader title="Clientes (total)" />
          <div className="p-4 text-3xl font-semibold tabular-nums">
            {overview?.clients_count ?? "—"}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Agências" />
        <div className="overflow-x-auto p-4">
          {!data?.agencies?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma agência.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 pr-4 font-medium">Slug</th>
                  <th className="pb-2 font-medium">Criada</th>
                </tr>
              </thead>
              <tbody>
                {data.agencies.map((a) => (
                  <tr key={a.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium">{a.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{a.slug}</td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Integrações OAuth (ambiente global)" />
        <div className="space-y-4 p-4 text-sm">
          <p className="text-muted-foreground">
            Os client IDs e secrets das apps Meta / Google / TikTok ficam nas{" "}
            <strong>Secrets das Edge Functions</strong> do projeto Supabase (não
            na base). Cada agência liga as suas contas em{" "}
            <Link
              to="/integrations"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Integrações
            </Link>
            .
          </p>
          {data?.oauthFnError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
              {data.oauthFnError}
            </p>
          ) : data?.oauthStatus ? (
            <ul className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <li className="flex items-center gap-2">
                <StatusDot ok={data.oauthStatus.integration_oauth_state_secret_ok} />
                <span>INTEGRATION_OAUTH_STATE_SECRET (min. 16 chars)</span>
              </li>
              <li className="flex items-center gap-2">
                <StatusDot ok={data.oauthStatus.public_site_url_ok} />
                <span>PUBLIC_SITE_URL ou SITE_URL</span>
              </li>
              <li className="flex items-center gap-2">
                <StatusDot ok={data.oauthStatus.meta_app_id_ok} />
                <span>META_APP_ID</span>
              </li>
              <li className="flex items-center gap-2">
                <StatusDot ok={data.oauthStatus.meta_app_secret_ok} />
                <span>META_APP_SECRET</span>
              </li>
              <li className="flex items-center gap-2">
                <StatusDot ok={data.oauthStatus.google_oauth_client_id_ok} />
                <span>GOOGLE_OAUTH_CLIENT_ID (Ads + GA4)</span>
              </li>
              <li className="flex items-center gap-2">
                <StatusDot ok={data.oauthStatus.google_oauth_client_secret_ok} />
                <span>GOOGLE_OAUTH_CLIENT_SECRET</span>
              </li>
              <li className="flex items-center gap-2">
                <StatusDot ok={data.oauthStatus.tiktok_client_or_app_id_ok} />
                <span>TIKTOK_CLIENT_KEY ou TIKTOK_APP_ID</span>
              </li>
              <li className="flex items-center gap-2">
                <StatusDot ok={data.oauthStatus.tiktok_secret_ok} />
                <span>TIKTOK_APP_SECRET ou TIKTOK_CLIENT_SECRET</span>
              </li>
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar estado…
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href="https://supabase.com/dashboard/project/_/settings/functions"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
            >
              <ExternalLink className="h-3 w-3" />
              Dashboard Supabase — Edge Functions
            </a>
            <span className="text-xs text-muted-foreground self-center">
              (substituir pelo ref do projeto nas configurações)
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Referência" />
        <div className="space-y-2 p-4 text-xs text-muted-foreground">
          <p>
            Lista de variáveis:{" "}
            <code className="rounded bg-surface px-1">
              supabase/functions/integration-oauth/secrets.example
            </code>
          </p>
          <p className="flex items-center gap-2">
            <Plug className="h-3.5 w-3.5" />
            Redirect OAuth:{" "}
            <code className="rounded bg-surface px-1 text-[10px]">
              …/integrations/oauth/callback
            </code>
          </p>
          <p className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" />
            Operador com sessão:{" "}
            <span className="font-mono text-foreground">{user?.email ?? user?.id}</span>
          </p>
        </div>
      </Card>
    </div>
  );
}
