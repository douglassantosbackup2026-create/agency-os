import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { seo, seoOgImage } from "@/content/gestao-trafego";
import { buildFallbackSiteMeta } from "@/lib/site-seo";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { DiagnosisFunnelErrorBoundary } from "@/components/diagnosis-funnel/DiagnosisFunnelErrorBoundary";
import { MetaPixelTracker } from "@/components/meta-pixel-tracker";
import { META_PIXEL_ID, META_PIXEL_INIT_SCRIPT } from "@/lib/meta-pixel";
import { reportError } from "@/lib/report-error";
import { useEffect, useSyncExternalStore } from "react";
import { getSnapshotTheme, subscribeTheme } from "@/lib/theme";

const THEME_INIT_SCRIPT = `(function(){try{var k='theme';var r=document.documentElement;var s=localStorage.getItem(k);var d;if(s==='dark')d=!0;else if(s==='light')d=!1;else d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)r.classList.add('dark');else r.classList.remove('dark');}catch(e){}})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  reportError("TanStackRouter_errorComponent", error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
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

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          httpEquiv: "Content-Security-Policy",
          content:
            "default-src 'self'; script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com https://*.mlstatic.com https://cdn.gpteng.co https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://cdn.gpteng.co data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co https://*.supabase.in https://api.mercadopago.com https://api.mercadolibre.com https://*.mlstatic.com https://graph.facebook.com https://cdn.gpteng.co https://www.facebook.com https://connect.facebook.net; frame-src https://*.mercadopago.com; base-uri 'self'; form-action 'self';",
        },
        { httpEquiv: "X-Content-Type-Options", content: "nosniff" },
        { name: "referrer", content: "strict-origin-when-cross-origin" },
        {
          name: "facebook-domain-verification",
          content: "rqya1e2l4vihrvte9x5kzpscr035rk",
        },
        {
          name: "facebook-domain-verification",
          content: "uf8868fgtby21yorxefxipn5nw1fvf",
        },
        { name: "theme-color", content: "#f4f3f8" },
        ...buildFallbackSiteMeta(seo.title, seo.description, seoOgImage),
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap",
        },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
);

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          // Aplica tema antes da primeira pintura (alinhar com src/lib/theme.ts)
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <script dangerouslySetInnerHTML={{ __html: META_PIXEL_INIT_SCRIPT }} />
        <noscript
          dangerouslySetInnerHTML={{
            __html: `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1" />`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function isDiagnosisFunnelPath(pathname: string): boolean {
  return (
    pathname === "/checkout" ||
    pathname === "/gestao-checkout" ||
    pathname === "/obrigado" ||
    pathname === "/gestao-obrigado" ||
    pathname.startsWith("/diagnostico/")
  );
}

function FunnelAwareOutlet() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const outlet = <Outlet />;
  if (isDiagnosisFunnelPath(pathname)) {
    return <DiagnosisFunnelErrorBoundary>{outlet}</DiagnosisFunnelErrorBoundary>;
  }
  return outlet;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const colorMode = useSyncExternalStore(
    subscribeTheme,
    (): "dark" | "light" => (getSnapshotTheme() === "dark" ? "dark" : "light"),
    (): "light" => "light",
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator))
      return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // ignore SW registration failures
    });
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute("content", colorMode === "dark" ? "#171428" : "#f4f3f8");
  }, [colorMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppErrorBoundary>
          <MetaPixelTracker />
          <FunnelAwareOutlet />
        </AppErrorBoundary>
        <Toaster position="top-right" theme={colorMode} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
