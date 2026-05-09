import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Activity,
  Bell,
  Command,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Plug,
  Rocket,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { initials } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/onboarding", label: "Começar", icon: Rocket },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/alerts", label: "Alertas", icon: Bell },
  { to: "/health", label: "Health Score", icon: ShieldCheck },
  { to: "/reports", label: "Relatórios IA", icon: Sparkles },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/integrations", label: "Integrações", icon: Plug },
  { to: "/activity", label: "Atividade", icon: Activity },
] as const;

const SECONDARY = [
  { to: "/admin", label: "Administração", icon: Shield },
  { to: "/settings", label: "Configurações", icon: Settings },
] as const;

function AuthenticatedLayout() {
  const { user, agency, signOut } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!agency?.id) return;
    const ch = supabase
      .channel(`layout-alerts:${agency.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
          filter: `agency_id=eq.${agency.id}`,
        },
        (payload) => {
          const row = payload.new as { title?: string };
          toast.info(row.title ?? "Novo alerta", { duration: 6000 });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [agency?.id]);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="sticky top-0 z-30 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-bold">
            R
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {agency?.name ?? "Retentio"}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              retentio.app
            </div>
          </div>
        </div>

        <button
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-sidebar-border bg-background/40 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-background transition"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Buscar...</span>
          <kbd className="hidden rounded bg-surface-2 px-1.5 py-0.5 text-[10px] sm:inline">
            ⌘K
          </kbd>
        </button>

        <nav className="flex-1 space-y-0.5 px-2">
          {NAV.map((item) => {
            const active = path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-0.5 border-t border-sidebar-border px-2 py-2">
          {SECONDARY.map((item) => {
            const active = path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-xs font-medium">
              {initials(user?.user_metadata?.display_name || user?.email)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">
                {user?.user_metadata?.display_name || user?.email}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                Owner
              </div>
            </div>
            <button
              onClick={signOut}
              className="rounded p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              title="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPaletteOpen(true)}
              className="md:hidden"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4" />
            </button>
            <div className="text-sm text-muted-foreground">
              {pageTitle(path)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-2 transition md:inline-flex"
            >
              <Command className="h-3 w-3" /> K
            </button>
            <Link
              to="/alerts"
              className="rounded-md p-2 text-muted-foreground hover:bg-surface hover:text-foreground transition"
            >
              <Bell className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function pageTitle(path: string) {
  if (path.startsWith("/onboarding")) return "Começar";
  if (path.startsWith("/dashboard")) return "Dashboard operacional";
  if (path.startsWith("/clients")) return "Clientes";
  if (path.startsWith("/alerts")) return "Central de alertas";
  if (path.startsWith("/health")) return "Health Score";
  if (path.startsWith("/reports")) return "Relatórios IA";
  if (path.startsWith("/whatsapp")) return "WhatsApp";
  if (path.startsWith("/integrations")) return "Integrações";
  if (path.startsWith("/activity")) return "Feed operacional";
  if (path.startsWith("/admin")) return "Administração";
  if (path.startsWith("/settings")) return "Configurações";
  return "";
}
