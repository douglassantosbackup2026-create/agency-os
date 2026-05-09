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
  ListTodo,
  LogOut,
  Menu,
  MessageSquare,
  Plug,
  Rocket,
  ScanSearch,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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
  { to: "/actions", label: "Central de Ações", icon: ListTodo },
  { to: "/alerts", label: "Alertas", icon: Bell },
  { to: "/ai-review", label: "Revisão IA", icon: ScanSearch },
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

function roleLabel_pt(role: string | undefined): string | null {
  if (!role) return null;
  if (role === "owner") return "Proprietário";
  if (role === "admin") return "Administrador";
  if (role === "member") return "Membro";
  return role;
}

function AgencyBrandMark({
  agencyName,
  logoUrl,
  size = "md",
}: {
  agencyName: string;
  logoUrl: string | null;
  size?: "sm" | "md";
}) {
  const cls =
    size === "sm"
      ? "h-7 w-7 rounded-md text-[11px]"
      : "h-8 w-8 rounded-md text-xs";
  if (logoUrl) {
    return <img src={logoUrl} alt="" className={`${cls} object-cover`} />;
  }
  return (
    <div
      className={`grid ${cls} place-items-center bg-primary font-bold text-primary-foreground`}
    >
      {initials(agencyName || "Ag")}
    </div>
  );
}

function NavLinks({
  path,
  onNavigate,
  variant = "sidebar",
}: {
  path: string;
  onNavigate?: () => void;
  variant?: "sidebar" | "sheet";
}) {
  const base =
    variant === "sidebar"
      ? {
          active: "bg-sidebar-accent text-sidebar-accent-foreground",
          idle: "text-sidebar-foreground hover:bg-sidebar-accent/60 bg-transparent",
        }
      : {
          active: "bg-accent text-accent-foreground",
          idle: "text-foreground hover:bg-accent/80 bg-transparent",
        };
  return (
    <>
      <nav className="flex-1 space-y-0.5 px-2">
        {NAV.map((item) => {
          const active = path.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => onNavigate?.()}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm transition md:py-2 ${active ? base.active : base.idle}`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div
        className={`space-y-0.5 border-t px-2 py-2 ${variant === "sidebar" ? "border-sidebar-border" : "border-border"}`}
      >
        {SECONDARY.map((item) => {
          const active = path.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => onNavigate?.()}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm transition md:py-2 ${active ? base.active : base.idle}`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function AuthenticatedLayout() {
  const { user, agency, signOut } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [memberRole, setMemberRole] = useState<string | null>(null);
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
    if (!user?.id || !agency?.id) {
      setMemberRole(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("agency_id", agency.id)
        .maybeSingle();
      if (!cancelled) setMemberRole(data?.role ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, agency?.id]);

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

  const displayRole = roleLabel_pt(memberRole ?? undefined);
  const agencyTitle = agency?.name ?? "Retentio";
  const agencySubtitle = agency?.slug ? `${agency.slug}` : "Painel da agência";

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="sticky top-0 z-30 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <AgencyBrandMark
            agencyName={agencyTitle}
            logoUrl={agency?.logo_url ?? null}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{agencyTitle}</div>
            <div className="truncate text-xs text-muted-foreground">
              {agencySubtitle}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-sidebar-border bg-background/40 px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-background"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Buscar...</span>
          <kbd className="hidden rounded bg-surface-2 px-1.5 py-0.5 text-[10px] sm:inline">
            ⌘K
          </kbd>
        </button>

        <NavLinks path={path} variant="sidebar" />

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-xs font-medium">
              {initials(user?.user_metadata?.display_name || user?.email)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">
                {user?.user_metadata?.display_name || user?.email}
              </div>
              {displayRole && (
                <div className="truncate text-xs text-muted-foreground">
                  {displayRole}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              title="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="flex w-[min(100vw-2rem,20rem)] flex-col p-0"
        >
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <div className="flex items-center gap-3 pr-8">
              <AgencyBrandMark
                agencyName={agencyTitle}
                logoUrl={agency?.logo_url ?? null}
                size="sm"
              />
              <div className="min-w-0">
                <SheetTitle className="truncate text-base font-semibold">
                  {agencyTitle}
                </SheetTitle>
                <p className="truncate text-xs text-muted-foreground">
                  {agencySubtitle}
                </p>
              </div>
            </div>
          </SheetHeader>
          <div className="flex flex-1 flex-col overflow-y-auto py-2">
            <NavLinks
              path={path}
              variant="sheet"
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-medium">
                {initials(user?.user_metadata?.display_name || user?.email)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {user?.user_metadata?.display_name || user?.email}
                </div>
                {displayRole && (
                  <div className="text-xs text-muted-foreground">
                    {displayRole}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setMobileNavOpen(false);
                  signOut();
                }}
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-5">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              aria-label="Abrir menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              aria-label="Buscar"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
            <div className="truncate text-sm text-muted-foreground">
              {pageTitle(path)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-surface-2 md:inline-flex"
            >
              <Command className="h-3 w-3" /> K
            </button>
            <Link
              to="/alerts"
              className="rounded-md p-2 text-muted-foreground transition hover:bg-surface hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
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
  if (path.startsWith("/actions")) return "Central de Ações";
  if (path.startsWith("/alerts")) return "Central de alertas";
  if (path.startsWith("/ai-review")) return "Revisão IA";
  if (path.startsWith("/health")) return "Health Score";
  if (path.startsWith("/reports")) return "Relatórios IA";
  if (path.startsWith("/whatsapp")) return "WhatsApp";
  if (path.startsWith("/integrations")) return "Integrações";
  if (path.startsWith("/activity")) return "Feed operacional";
  if (path.startsWith("/admin")) return "Administração";
  if (path.startsWith("/settings")) return "Configurações";
  return "";
}
