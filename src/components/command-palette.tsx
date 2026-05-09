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
} from "lucide-react";
import { toast } from "sonner";

type ClientItem = { id: string; name: string };
type ReportPick = { id: string; excerpt: string; clientName: string };

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { agency } = useAuth();
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [openAlerts, setOpenAlerts] = useState<ClientItem[]>([]);
  const [recentReports, setRecentReports] = useState<ReportPick[]>([]);

  useEffect(() => {
    if (!open || !agency?.id) return;
    supabase
      .from("clients")
      .select("id, name")
      .eq("agency_id", agency.id)
      .order("name")
      .limit(30)
      .then(({ data }) => {
        setClients(data ?? []);
      });
  }, [open, agency?.id]);

  useEffect(() => {
    if (!open || !agency) return;
    supabase
      .from("alerts")
      .select("id, title")
      .eq("agency_id", agency.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setOpenAlerts((data ?? []).map((a) => ({ id: a.id, name: a.title })));
      });
  }, [open, agency]);

  useEffect(() => {
    if (!open || !agency?.id) return;
    supabase
      .from("reports")
      .select("id, executive_summary, clients(name)")
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data }) => {
        setRecentReports(
          (data ?? []).map((r) => {
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
      });
  }, [open, agency?.id]);

  const close = () => onOpenChange(false);
  const go = (to: string) => {
    close();
    navigate({ to });
  };

  const seed = async () => {
    close();
    const tid = toast.loading("Gerando dados de exemplo...");
    const { error } = await supabase.functions.invoke("seed-demo-data");
    toast.dismiss(tid);
    if (error) toast.error(error.message);
    else toast.success("Dados criados. Recarregando...");
    setTimeout(() => window.location.reload(), 800);
  };

  const recomputeHealth = async () => {
    close();
    const tid = toast.loading(
      "Atualizando indicadores de saúde da carteira...",
    );
    const { error } = await supabase.functions.invoke("compute-health-scores");
    toast.dismiss(tid);
    if (error) toast.error(error.message);
    else toast.success("Indicadores e briefing atualizados.");
  };

  const evalAlerts = async () => {
    close();
    const tid = toast.loading("Avaliando alertas...");
    const { error } = await supabase.functions.invoke("evaluate-alerts");
    toast.dismiss(tid);
    if (error) toast.error(error.message);
    else toast.success("Alertas reavaliados.");
  };

  const runDailySummary = async () => {
    close();
    const tid = toast.loading("Enviando resumos do dia...");
    const { error } = await supabase.functions.invoke(
      "whatsapp-summary?period=daily",
    );
    toast.dismiss(tid);
    if (error) toast.error(error.message);
    else toast.success("Resumos enviados.");
  };

  const toggleTheme = () => {
    close();
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";
    root.classList.toggle("dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore storage */
    }
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
          <CommandItem onSelect={() => go("/admin")}>
            <ShieldAlert className="mr-2 h-4 w-4" /> Admin
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
          <CommandItem onSelect={recomputeHealth}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar visão de saúde da
            carteira
          </CommandItem>
          <CommandItem onSelect={evalAlerts}>
            <CheckSquare className="mr-2 h-4 w-4" /> Reavaliar alertas
          </CommandItem>
          <CommandItem onSelect={runDailySummary}>
            <MessageSquare className="mr-2 h-4 w-4" /> Disparar resumos do dia
          </CommandItem>
          <CommandItem onSelect={seed}>
            <Database className="mr-2 h-4 w-4" /> Gerar dados de exemplo
          </CommandItem>
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
