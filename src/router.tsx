import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";
import { reportError } from "@/lib/report-error";
import { Button } from "@/components/ui/button";

function DefaultErrorComponent({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  reportError("router:defaultErrorComponent", error);
  const router = useRouter();
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "Não foi possível carregar esta tela."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            className="h-11 px-6"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Tentar novamente
          </Button>
          <Button variant="outline" asChild className="h-11">
            <Link to="/">Início</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function DefaultNotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Página não encontrada</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          O recurso que você procura não existe ou foi movido.
        </p>
        <Button asChild className="mt-6 h-11">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}

type MutationMeta = {
  /** Quando true, suprime o toast global de erro (a mutation trata o feedback). */
  suppressErrorToast?: boolean;
  /** Mensagem amigável a ser exibida em vez de error.message. */
  errorMessage?: string;
};

type QueryMeta = {
  /** Quando true, suprime o toast global de erro (a tela mostra QueryErrorState). */
  suppressErrorToast?: boolean;
  errorMessage?: string;
};

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportError(`query:${JSON.stringify(query.queryKey)}`, error);
        const meta = query.options.meta as QueryMeta | undefined;
        if (meta?.suppressErrorToast) return;
        const message =
          meta?.errorMessage ??
          (error instanceof Error && error.message
            ? error.message
            : "Não foi possível carregar os dados.");
        toast.error(message);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        const key = mutation.options.mutationKey;
        reportError(
          `mutation:${key != null ? JSON.stringify(key) : "anonymous"}`,
          error,
        );
        const meta = mutation.options.meta as MutationMeta | undefined;
        if (meta?.suppressErrorToast) return;
        const message =
          meta?.errorMessage ??
          (error instanceof Error && error.message
            ? error.message
            : "Não foi possível concluir a ação. Tente novamente.");
        toast.error(message);
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
    defaultNotFoundComponent: DefaultNotFoundComponent,
  });

  return router;
};
