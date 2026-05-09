import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute(
  "/_authenticated/integrations/oauth/callback",
)({
  component: OAuthCallback,
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    error_description:
      typeof search.error_description === "string"
        ? search.error_description
        : undefined,
  }),
});

function OAuthCallback() {
  const navigate = useNavigate();
  const { code, state, error, error_description } = Route.useSearch();
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    async function run() {
      if (error) {
        toast.error(error_description ?? error);
        navigate({ to: "/integrations" });
        return;
      }
      if (!code || !state) {
        toast.error("Parâmetros OAuth em falta.");
        navigate({ to: "/integrations" });
        return;
      }
      const { data, error: fnErr } = await supabase.functions.invoke(
        "integration-oauth",
        {
          body: { action: "exchange", code, state },
        },
      );
      const apiErr =
        data &&
        typeof data === "object" &&
        "error" in data &&
        (data as { error?: string }).error;
      if (fnErr) toast.error(fnErr.message);
      else if (apiErr) toast.error(String(apiErr));
      else toast.success("Conta conectada via OAuth.");
      navigate({ to: "/integrations" });
      setBusy(false);
    }
    run();
  }, [code, state, error, error_description, navigate]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p>{busy ? "A finalizar ligação com o provedor…" : "Redirecionando…"}</p>
    </div>
  );
}
