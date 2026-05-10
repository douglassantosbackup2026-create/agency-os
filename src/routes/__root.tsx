import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { landingHeroScreenshot, seoDefaults } from "@/content/retentio-landing";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { AppErrorBoundary } from "@/components/app-error-boundary";
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

function siteOrigin(): string {
  const raw =
    typeof import.meta.env.VITE_SITE_URL === "string"
      ? import.meta.env.VITE_SITE_URL.trim()
      : "";
  return raw.replace(/\/$/, "");
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => {
      const origin = siteOrigin();
      const ogImage =
        origin !== "" ? `${origin}${landingHeroScreenshot.webp}` : undefined;
      return {
        meta: [
          { charSet: "utf-8" },
          { name: "viewport", content: "width=device-width, initial-scale=1" },
          {
            title: seoDefaults.title,
          },
          {
            name: "description",
            content: seoDefaults.description,
          },
          { name: "theme-color", content: "#f4f3f8" },
          {
            property: "og:title",
            content: seoDefaults.title,
          },
          {
            property: "og:description",
            content: seoDefaults.description,
          },
          { property: "og:type", content: "website" },
          ...(ogImage
            ? ([
                { property: "og:image", content: ogImage },
                { name: "twitter:card", content: "summary_large_image" },
              ] as const)
            : []),
          { title: "Lovable App" },
          { property: "og:title", content: "Lovable App" },
          { name: "twitter:title", content: "Lovable App" },
          { name: "description", content: "Agency OS is a SaaS platform designed as an operational system for performance marketing agencies." },
          { property: "og:description", content: "Agency OS is a SaaS platform designed as an operational system for performance marketing agencies." },
          { name: "twitter:description", content: "Agency OS is a SaaS platform designed as an operational system for performance marketing agencies." },
          { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fbfd06c5-df86-43bd-8a10-5a047e2b1bb9/id-preview-d29176f4--9ee84330-8b5f-4426-81f4-618b5ae00757.lovable.app-1778371800390.png" },
          { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fbfd06c5-df86-43bd-8a10-5a047e2b1bb9/id-preview-d29176f4--9ee84330-8b5f-4426-81f4-618b5ae00757.lovable.app-1778371800390.png" },
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
            href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
          },
        ],
      };
    },
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
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const colorMode = useSyncExternalStore(
    subscribeTheme,
    (): "dark" | "light" =>
      getSnapshotTheme() === "dark" ? "dark" : "light",
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
          <Outlet />
        </AppErrorBoundary>
        <Toaster position="top-right" theme={colorMode} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
