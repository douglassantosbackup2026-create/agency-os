import {
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { reportError } from "@/lib/report-error";

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
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        const key = mutation.options.mutationKey;
        reportError(
          `mutation:${key != null ? JSON.stringify(key) : "anonymous"}`,
          error,
        );
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
