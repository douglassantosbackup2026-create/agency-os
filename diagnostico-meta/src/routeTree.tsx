import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { LandingPage } from "./pages/LandingPage";
import { ObrigadoPage } from "./pages/ObrigadoPage";
import { DiagnosticoPage } from "./pages/DiagnosticoPage";

const rootRoute = createRootRoute({
  component: () => (
    <div className="app-root">
      <Outlet />
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

const obrigadoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/obrigado",
  component: ObrigadoPage,
  validateSearch: (search: Record<string, unknown>) => ({
    d: typeof search.d === "string" ? search.d : undefined,
    s: typeof search.s === "string" ? search.s : undefined,
  }),
});

const diagnosticoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/diagnostico/$diagnosisId",
  validateSearch: (search: Record<string, unknown>) => ({
    s: typeof search.s === "string" ? search.s : undefined,
  }),
  component: DiagnosticoPage,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  obrigadoRoute,
  diagnosticoRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
