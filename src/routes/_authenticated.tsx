import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  ChevronDown,
  ClipboardList,
  Command,
  Image,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessageSquare,
  Plug,
  Radar,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ONBOARDING_STEP_KEYS } from "@/lib/onboarding-checklist";
import { throwIfSupabaseError } from "@/lib/supabase-result";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OperationClientScopeProvider } from "@/context/operation-client-scope";
import { OperationScopeSelect } from "@/components/operation-scope-select";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthenticatedLayout,
});

type NavItemDef = { to: string; label: string; icon: LucideIcon };

const NAV_GROUPS: { id: string; label: string; items: NavItemDef[] }[] = [
  {
    id: "operation",
    label: "Operação",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/standup", label: "Stand-up", icon: ClipboardList },
      { to: "/clients", label: "Clientes", icon: Users },
      { to: "/actions", label: "Central de Ações", icon: ListTodo },
      { to: "/alerts", label: "Alertas", icon: Bell },
      { to: "/activity", label: "Atividade", icon: Activity },
    ],
  },
  {
    id: "intel",
    label: "Inteligência",
    items: [
      { to: "/ai-review", label: "Revisão IA", icon: ScanSearch },
      { to: "/health", label: "Health Score", icon: ShieldCheck },
      { to: "/reports", label: "Relatórios IA", icon: Sparkles },
      { to: "/competitors", label: "Concorrentes", icon: Radar },
      { to: "/creatives", label: "Criativos", icon: Image },
    ],
  },
  {
    id: "comms",
    label: "Comunicação",
    items: [{ to: "/whatsapp", label: "WhatsApp", icon: MessageSquare }],
  },
  {
    id: "data",
    label: "Dados",
    items: [{ to: "/integrations", label: "Integrações", icon: Plug }],
  },
];

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
  /** `high` para o logo fixo na sidebar (LCP); omitir em menus tipo sheet. */
  imagePriority,
}: {
  agencyName: string;
  logoUrl: string | null;
  size?: "sm" | "md";
  imagePriority?: "high" | "low";
}) {
  const cls =
    size === "sm" ? "h-7 w-7 rounded-md text-xs" : "h-8 w-8 rounded-md text-xs";
  const px = size === "sm" ? 28 : 32;
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        width={px}
        height={px}
        decoding="async"
        loading={imagePriority === "high" ? "eager" : "lazy"}
        fetchPriority={imagePriority === "high" ? "high" : undefined}
        className={`${cls} object-cover`}
      />
    );
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
  showOnboardingLink,
  openAlertsCount,
  showAdminLink,
}: {
  path: string;
  onNavigate?: () => void;
  variant?: "sidebar" | "sheet";
  showOnboardingLink: boolean;
  openAlertsCount: number;
  showAdminLink: boolean;
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
  const groupBorder =
    variant === "sidebar" ? "border-sidebar-border" : "border-border";
  const groupTriggerCls =
    variant === "sidebar"
      ? "text-sidebar-foreground/70 hover:bg-sidebar-accent/40"
      : "text-muted-foreground hover:bg-accent/60";
  return (
    <>
      <nav className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        {showOnboardingLink && (
          <Link
            to="/onboarding"
            onClick={() => onNavigate?.()}
            className={`flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm font-medium transition md:py-2 ${path.startsWith("/onboarding") ? base.active : base.idle}`}
          >
            <Rocket className="h-4 w-4 shrink-0" />
            <span>Começar</span>
          </Link>
        )}
        {NAV_GROUPS.map((group) => (
          <Collapsible key={group.id} defaultOpen className="space-y-0.5">
            <CollapsibleTrigger
              className={`group flex min-h-10 w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide ${groupTriggerCls}`}
            >
              {group.label}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 pt-0.5">
              {group.items.map((item) => {
                const active =
                  item.to === "/clients"
                    ? path === "/clients" || path.startsWith("/clients/")
                    : path.startsWith(item.to);
                const badge =
                  item.to === "/alerts" && openAlertsCount > 0
                    ? openAlertsCount > 99
                      ? "99+"
                      : String(openAlertsCount)
                    : null;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => onNavigate?.()}
                    className={`flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm transition md:py-2 ${active ? base.active : base.idle}`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge && (
                      <span className="rounded-full bg-primary/25 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </nav>
      <div className={`space-y-0.5 border-t px-2 py-2 ${groupBorder}`}>
        {SECONDARY.filter((item) => showAdminLink || item.to !== "/admin").map(
          (item) => {
            const active = path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => onNavigate?.()}
                className={`flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm transition md:py-2 ${active ? base.active : base.idle}`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          },
        )}
      </div>
    </>
  );
}

function AuthenticatedLayout() {
  const { user, agency, agencyLoadError, refreshAgency, signOut } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });

  const {
    data: navMeta,
    isError: navMetaError,
    refetch: refetchNavMeta,
  } = useQuery({
    queryKey: ["layout-nav-meta", agency?.id],
    enabled: !!agency?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const [clientsRes, itemsRes, alertsCountRes] = await Promise.all([
        supabase.from("clients").select("id").eq("agency_id", agency!.id),
        supabase
          .from("onboarding_checklist_items")
          .select("client_id, step_key, status")
          .eq("agency_id", agency!.id),
        supabase
          .from("alerts")
          .select("id", { count: "exact", head: true })
          .eq("agency_id", agency!.id)
          .eq("status", "open"),
      ]);
      throwIfSupabaseError(clientsRes.error, "layout.clients");
      throwIfSupabaseError(itemsRes.error, "layout.onboarding_checklist");
      throwIfSupabaseError(alertsCountRes.error, "layout.alerts_count");
      const clients = (clientsRes.data ?? []) as { id: string }[];
      const items = (itemsRes.data ?? []) as Array<{
        client_id: string;
        step_key: string;
        status: string;
      }>;
      let showOnboardingLink = clients.length === 0;
      if (!showOnboardingLink) {
        outer: for (const c of clients) {
          for (const stepKey of ONBOARDING_STEP_KEYS) {
            const row = items.find(
              (i) => i.client_id === c.id && i.step_key === stepKey,
            );
            if (!row || row.status !== "done") {
              showOnboardingLink = true;
              break outer;
            }
          }
        }
      }
      return {
        showOnboardingLink,
        openAlertsCount: alertsCountRes.count ?? 0,
      };
    },
  });

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
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("agency_id", agency.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error(
          `Não foi possível carregar o seu papel na equipa: ${error.message}`,
        );
        setMemberRole(null);
        return;
      }
      setMemberRole(data?.role ?? null);
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
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          toast.warning(
            "Notificações de novos alertas em tempo real indisponíveis.",
            { duration: 5000 },
          );
        }
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [agency?.id]);

  const displayRole = roleLabel_pt(memberRole ?? undefined);
  const agencyTitle = agency?.name ?? "Retentio";
  const agencySubtitle = agency?.slug ? `${agency.slug}` : "Painel da agência";

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      {(agencyLoadError || navMetaError) && (
        <div className="shrink-0 border-b border-border bg-background px-4 py-3 md:pl-[calc(15rem+1rem)]">
          {agencyLoadError && (
            <Alert variant="destructive" className="mb-2 last:mb-0">
              <AlertTitle>Não foi possível carregar a sua agência</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span className="text-inherit">{agencyLoadError}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 border-destructive/40"
                  onClick={() => void refreshAgency()}
                >
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {navMetaError && (
            <Alert variant="destructive" className="last:mb-0">
              <AlertTitle>Menu auxiliar indisponível</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span className="text-inherit">
                  Contadores e indicadores de onboarding podem estar
                  desatualizados.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 border-destructive/40"
                  onClick={() => void refetchNavMeta()}
                >
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-row">
        <aside className="sticky top-0 z-30 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
          <div className="flex items-center gap-2 px-4 py-4">
            <AgencyBrandMark
              agencyName={agencyTitle}
              logoUrl={agency?.logo_url ?? null}
              imagePriority="high"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {agencyTitle}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {agencySubtitle}
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="mx-3 mb-3 h-10 w-auto justify-start gap-2 border-sidebar-border bg-background/40 text-sm font-normal text-muted-foreground hover:bg-background"
            onClick={() => setPaletteOpen(true)}
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Buscar...</span>
            <kbd className="hidden rounded bg-surface-2 px-1.5 py-1 text-xs sm:inline">
              ⌘K
            </kbd>
          </Button>

          <NavLinks
            path={path}
            variant="sidebar"
            showOnboardingLink={navMeta?.showOnboardingLink ?? true}
            openAlertsCount={navMeta?.openAlertsCount ?? 0}
            showAdminLink={memberRole !== "member"}
          />

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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={signOut}
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
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
                showOnboardingLink={navMeta?.showOnboardingLink ?? true}
                openAlertsCount={navMeta?.openAlertsCount ?? 0}
                showAdminLink={memberRole !== "member"}
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

        <OperationClientScopeProvider>
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
                <OperationScopeSelect />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="hidden h-9 gap-1.5 md:inline-flex"
                  onClick={() => setPaletteOpen(true)}
                >
                  <Command className="h-3.5 w-3.5" /> K
                </Button>
                <Link
                  to="/alerts"
                  className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground"
                >
                  <Bell className="h-4 w-4" />
                  {(navMeta?.openAlertsCount ?? 0) > 0 && (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
                  )}
                </Link>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
              <Outlet />
            </main>
          </div>
        </OperationClientScopeProvider>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function pageTitle(path: string) {
  if (path.startsWith("/onboarding")) return "Começar";
  if (path.startsWith("/dashboard")) return "Hoje · operação";
  if (path.startsWith("/clients/") && path.split("/").length > 2)
    return "Clientes › Ficha";
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
