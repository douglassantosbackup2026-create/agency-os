import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  redeemMetaTestExchange,
  metaOAuthRedirectUri,
  saveMetaTestToken,
} from "@/lib/meta-api-test";

export const Route = createFileRoute("/test-meta-oauth/callback")({
  beforeLoad: () => {
    const allowHarness =
      import.meta.env.DEV ||
      import.meta.env.VITE_META_TEST_ENABLED === "true";
    if (!allowHarness) {
      throw redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    exchange_code:
      typeof search.exchange_code === "string"
        ? search.exchange_code
        : undefined,
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    error_description:
      typeof search.error_description === "string"
        ? search.error_description
        : undefined,
    oauth_error:
      typeof search.oauth_error === "string" ? search.oauth_error : undefined,
  }),
  component: MetaTestCallbackPage,
});

function MetaTestCallbackPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [message, setMessage] = useState("A processar autorização Meta…");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const oauthError = search.oauth_error ?? search.error;
      if (oauthError) {
        const msg = search.error_description ?? oauthError;
        toast.error(`Meta OAuth recusado: ${msg}`);
        await navigate({
          to: "/test-meta-oauth",
          search: { oauth_error: undefined },
          replace: true,
        });
        return;
      }

      if (search.exchange_code) {
        try {
          setMessage("A obter token de forma segura…");
          const long = await redeemMetaTestExchange(search.exchange_code);
          saveMetaTestToken(long.access_token, long.expires_in);
          if (cancelled) return;
          toast.success("Meta Ads conectado com sucesso.");
          await navigate({
          to: "/test-meta-oauth",
          search: { oauth_error: undefined },
          replace: true,
        });
        } catch (e) {
          if (cancelled) return;
          toast.error(e instanceof Error ? e.message : "Falha no OAuth Meta");
          await navigate({
          to: "/test-meta-oauth",
          search: { oauth_error: undefined },
          replace: true,
        });
        }
        return;
      }

      if (search.code && search.state) {
        try {
          setMessage("A trocar code por access token…");
          const redirectUri = metaOAuthRedirectUri();
          const short = await exchangeCodeForToken(
            search.code,
            redirectUri,
            search.state,
          );

          setMessage("A obter long-lived token (60 dias)…");
          const long = await exchangeForLongLivedToken(short.access_token);

          saveMetaTestToken(
            long.access_token,
            long.expires_in ?? short.expires_in,
          );

          if (cancelled) return;
          toast.success("Meta Ads conectado com sucesso.");
          await navigate({
          to: "/test-meta-oauth",
          search: { oauth_error: undefined },
          replace: true,
        });
        } catch (e) {
          if (cancelled) return;
          const msg = e instanceof Error ? e.message : "Falha no OAuth Meta";
          toast.error(msg);
          await navigate({
          to: "/test-meta-oauth",
          search: { oauth_error: undefined },
          replace: true,
        });
        }
        return;
      }

      toast.error("Callback OAuth incompleto.");
          await navigate({
            to: "/test-meta-oauth",
            search: { oauth_error: undefined },
            replace: true,
          });
    })();

    return () => {
      cancelled = true;
    };
  }, [search, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Callback Meta OAuth</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin shrink-0" />
            <span>{message}</span>
          </div>
          <Alert>
            <AlertTitle>Ambiente de teste</AlertTitle>
            <AlertDescription>
              Não feche esta janela — será redireccionado automaticamente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
