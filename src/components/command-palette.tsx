import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Bell,
  Globe,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Users,
  Settings,
  Plus,
  Database,
  MessageSquare,
  Plug,
  ShieldAlert,
  RefreshCw,
  FileText,
  Sun,
  Moon,
  LogOut,
  CheckSquare,
  Activity as ActivityIcon,
  Image as ImageIcon,
  Radar,
  Stethoscope,
} from "lucide-react";
import { toggleTheme as applyToggleTheme } from "@/lib/theme";
import { invokeWithToast } from "@/lib/supabase-invoke";
import { throwIfSupabaseError } from "@/lib/supabase-result";
import { toast } from "sonner";

type ClientItem = { id: string; name: string };
type ReportPick = { id: string; excerpt: string; clientName: string };

export function CommandPalette({
  open,
  onOpenChange,
  isOwnerOrAdmin = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isOwnerOrAdmin?: boolean;
}) {
  const navigate = useNavigate();
  const { agency, isPlatformAdmin } = useAuth();
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [openAlerts, setOpenAlerts] = useState<ClientItem[]>([]);
  const [recentReports, setRecentReports] = useState<ReportPick[]>([]);

  useEffect(() => {
    if (!open || !agency?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await supabase
          .from("clients")
          .select("id, name")
          .eq("agency_id", agency.id)
          .order("name")
          .limit(30);
        throwIfSupabaseError(res.error, "Busca — clientes");
        if (!cancelled) setClients(res.data ?? []);
      } catch (e) {
        if (!cancelled) {
          setClients([]);
          toast.error(
            e instanceof Error ? e.message : "Erro ao carregar clientes.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, agency?.id]);

  useEffect(() => {
    if (!open || !agency) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await supabase
          .from("alerts")
          .select("id, title")
          .eq("agency_id", agency.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(20);
        throwIfSupabaseError(res.error, "Busca — alertas");
        if (!cancelled)
          setOpenAlerts(
            (res.data ?? []).map((a) => ({ id: a.id, name: a.title })),
          );
      } catch (e) {
        if (!cancelled) {
          setOpenAlerts([]);
          toast.error(
            e instanceof Error ? e.message : "Erro ao carregar alertas.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, agency?.id]);

  useEffect(() => {
    if (!open || !agency?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await supabase
          .from("reports")
          .select("id, executive_summary, clients(name)")
          .eq("agency_id", agency.id)
          .order("created_at", { ascending: false })
          .limit(12);
        throwIfSupabaseError(res.error, "Busca — relatórios");
        if (!cancelled)
          setRecentReports(
            (res.data ?? []).map((r) => {
              const name =
                (r.clients as { name?: string } | null)?.name ?? "Cliente";
              const ex = String(r.executive_summary ?? "").replace(/\s+/g, " ");
              return {
                id: r.id,
                clientName: name,
                excerpt: ex.length > 90 ? `${ex.slice(0, 87)}…` : ex || "—",
              };
            }),
          );
      } catch (e) {
        if (!cancelled) {
          setRecentReports([]);
          toast.error(
            e instanceof Error ? e.message : "Erro ao carregar relatórios.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, agency?.id]);

  const close = () => onOpenChange(false);
  const go = (to: string) => {
    close();
    navigate({ to });
  };

  const seed = async () => {
    close();
    const res = await invokeWithToast(supabase, "seed-demo-data", {
      loading: "Gerando dados de exemplo...",
      success: "Dados criados. Recarregando...",
    });
    if (res.ok) setTimeout(() => window.location.reload(), 800);
  };

  const recomputeHealth = async () => {
    close();
    await invokeWithToast(supabase, "compute-health-scores", {
      loading: "Atualizando indicadores de saúde da carteira...",
      success: "Indicadores e briefing atualizados.",
    });
  };

  const evalAlerts = async () => {
    close();
    await invokeWithToast(supabase, "evaluate-alerts", {
      loading: "Avaliando alertas...",
      success: "Alertas reavaliados.",
    });
  };

  const runDailySummary = async () => {
    close();
    await invokeWithToast(supabase, "whatsapp-summary?period=daily", {
      loading: "Enviando resumos do dia...",
      success: "Resumos enviados.",
    });
  };

  const toggleTheme = () => {
    close();
    applyToggleTheme();
  };

  const signOut = async () => {
    close();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar clientes, ações, navegar..." />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Navegar">
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/clients")}>
            <Users className="mr-2 h-4 w-4" /> Clientes
          </CommandItem>
          <CommandItem onSelect={() => go("/alerts")}>
            <Bell className="mr-2 h-4 w-4" /> Alertas
          </CommandItem>
          <CommandItem onSelect={() => go("/health")}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Health Score
          </CommandItem>
          <CommandItem onSelect={() => go("/reports")}>
            <Sparkles className="mr-2 h-4 w-4" /> Relatórios IA
          </CommandItem>
          <CommandItem onSelect={() => go("/whatsapp")}>
            <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
          </CommandItem>
          <CommandItem onSelect={() => go("/integrations")}>
            <Plug className="mr-2 h-4 w-4" /> Integrações
          </CommandItem>
          <CommandItem onSelect={() => go("/activity")}>
            <ActivityIcon className="mr-2 h-4 w-4" /> Atividade
          </CommandItem>
          <CommandItem onSelect={() => go("/creatives")}>
            <ImageIcon className="mr-2 h-4 w-4" /> Aprovação de criativos
          </CommandItem>
          <CommandItem onSelect={() => go("/competitors")}>
            <Radar className="mr-2 h-4 w-4" /> Concorrentes (MVP)
          </CommandItem>
          <CommandItem onSelect={() => go("/onboarding")}>
            <Sparkles className="mr-2 h-4 w-4" /> Onboarding
          </CommandItem>
          {isPlatformAdmin && (
            <>
              <CommandItem onSelect={() => go("/platform-admin")}>
                <Globe className="mr-2 h-4 w-4" /> Plataforma
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  close();
                  void navigate({ to: "/platform-admin" }).then(() => {
                    window.setTimeout(() => {
                      document
                        .getElementById("diagnostico-funil")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 400);
                  });
                }}
              >
                <Stethoscope className="mr-2 h-4 w-4" /> Funil Diagnóstico
              </CommandItem>
            </>
          )}
          <CommandItem onSelect={() => go("/admin")}>
            <ShieldAlert className="mr-2 h-4 w-4" /> Equipa e auditoria
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <Settings className="mr-2 h-4 w-4" /> Configurações
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => go("/clients?new=1")}>
            <Plus className="mr-2 h-4 w-4" /> Novo cliente
          </CommandItem>
          <CommandItem onSelect={() => go("/reports")}>
            <FileText className="mr-2 h-4 w-4" /> Gerar relatório IA
          </CommandItem>
          <CommandItem onSelect={() => go("/whatsapp")}>
            <MessageSquare className="mr-2 h-4 w-4" /> Enviar WhatsApp
          </CommandItem>
          <CommandItem onSelect={evalAlerts}>
            <CheckSquare className="mr-2 h-4 w-4" /> Reavaliar alertas
          </CommandItem>
          {isOwnerOrAdmin && (
            <>
              <CommandItem onSelect={runDailySummary}>
                <MessageSquare className="mr-2 h-4 w-4" /> Disparar resumos do dia
              </CommandItem>
              <CommandItem onSelect={recomputeHealth}>
                <RefreshCw className="mr-2 h-4 w-4" /> Atualizar visão de saúde da
                carteira
              </CommandItem>
              <CommandItem onSelect={seed}>
                <Database className="mr-2 h-4 w-4" /> Gerar dados de exemplo
              </CommandItem>
            </>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Conta">
          <CommandItem onSelect={toggleTheme}>
            <Sun className="mr-2 h-4 w-4 dark:hidden" />
            <Moon className="mr-2 hidden h-4 w-4 dark:block" /> Alternar tema
          </CommandItem>
          <CommandItem onSelect={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </CommandItem>
        </CommandGroup>
        {openAlerts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Alertas abertos">
              {openAlerts.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`alert-${a.name}-${a.id}`}
                  onSelect={() => go("/alerts")}
                >
                  <Bell className="mr-2 h-4 w-4" /> {a.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {clients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clientes">
              {clients.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`client-${c.name}-${c.id}`}
                  onSelect={() => go(`/clients/${c.id}`)}
                >
                  <Users className="mr-2 h-4 w-4" /> {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {recentReports.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Relatórios recentes">
              {recentReports.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`report-${r.clientName}-${r.excerpt}-${r.id}`}
                  onSelect={() => {
                    close();
                    try {
                      sessionStorage.setItem(
                        "agency-os-highlight-report",
                        r.id,
                      );
                    } catch {
                      /* ignore */
                    }
                    navigate({ to: "/reports" });
                  }}
                >
                  <FileText className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {r.clientName}: {r.excerpt}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
