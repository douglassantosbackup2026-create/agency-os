import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { Bell, LayoutDashboard, ShieldCheck, Sparkles, Users, Settings, Plus, Database, MessageSquare, Plug, ShieldAlert, RefreshCw, FileText, Sun, Moon, LogOut, CheckSquare } from "lucide-react";
import { toast } from "sonner";

type ClientItem = { id: string; name: string };

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientItem[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase.from("clients").select("id, name").order("name").limit(20).then(({ data }) => {
      setClients(data ?? []);
    });
  }, [open]);

  const close = () => onOpenChange(false);
  const go = (to: string) => { close(); navigate({ to }); };

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
    const tid = toast.loading("Recalculando health scores...");
    const { error } = await supabase.functions.invoke("compute-health-scores");
    toast.dismiss(tid);
    error ? toast.error(error.message) : toast.success("Health scores atualizados.");
  };

  const evalAlerts = async () => {
    close();
    const tid = toast.loading("Avaliando alertas...");
    const { error } = await supabase.functions.invoke("evaluate-alerts");
    toast.dismiss(tid);
    error ? toast.error(error.message) : toast.success("Alertas reavaliados.");
  };

  const runDailySummary = async () => {
    close();
    const tid = toast.loading("Disparando resumos diários...");
    const { error } = await supabase.functions.invoke("whatsapp-summary?period=daily");
    toast.dismiss(tid);
    error ? toast.error(error.message) : toast.success("Resumos enviados.");
  };

  const toggleTheme = () => {
    close();
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";
    root.classList.toggle("dark");
    try { localStorage.setItem("theme", next); } catch {}
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
          <CommandItem onSelect={() => go("/dashboard")}><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</CommandItem>
          <CommandItem onSelect={() => go("/clients")}><Users className="mr-2 h-4 w-4" /> Clientes</CommandItem>
          <CommandItem onSelect={() => go("/alerts")}><Bell className="mr-2 h-4 w-4" /> Alertas</CommandItem>
          <CommandItem onSelect={() => go("/health")}><ShieldCheck className="mr-2 h-4 w-4" /> Health Score</CommandItem>
          <CommandItem onSelect={() => go("/reports")}><Sparkles className="mr-2 h-4 w-4" /> Relatórios IA</CommandItem>
          <CommandItem onSelect={() => go("/whatsapp")}><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp</CommandItem>
          <CommandItem onSelect={() => go("/integrations")}><Plug className="mr-2 h-4 w-4" /> Integrações</CommandItem>
          <CommandItem onSelect={() => go("/admin")}><ShieldAlert className="mr-2 h-4 w-4" /> Admin</CommandItem>
          <CommandItem onSelect={() => go("/settings")}><Settings className="mr-2 h-4 w-4" /> Configurações</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => go("/clients?new=1")}><Plus className="mr-2 h-4 w-4" /> Novo cliente</CommandItem>
          <CommandItem onSelect={() => go("/reports")}><FileText className="mr-2 h-4 w-4" /> Gerar relatório IA</CommandItem>
          <CommandItem onSelect={() => go("/whatsapp")}><MessageSquare className="mr-2 h-4 w-4" /> Enviar WhatsApp</CommandItem>
          <CommandItem onSelect={recomputeHealth}><RefreshCw className="mr-2 h-4 w-4" /> Recalcular health scores</CommandItem>
          <CommandItem onSelect={evalAlerts}><CheckSquare className="mr-2 h-4 w-4" /> Reavaliar alertas</CommandItem>
          <CommandItem onSelect={runDailySummary}><MessageSquare className="mr-2 h-4 w-4" /> Disparar resumos do dia</CommandItem>
          <CommandItem onSelect={seed}><Database className="mr-2 h-4 w-4" /> Gerar dados de exemplo</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Conta">
          <CommandItem onSelect={toggleTheme}><Sun className="mr-2 h-4 w-4 dark:hidden" /><Moon className="mr-2 hidden h-4 w-4 dark:block" /> Alternar tema</CommandItem>
          <CommandItem onSelect={signOut}><LogOut className="mr-2 h-4 w-4" /> Sair</CommandItem>
        </CommandGroup>
        {clients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clientes">
              {clients.map(c => (
                <CommandItem key={c.id} onSelect={() => go(`/clients/${c.id}`)}>
                  <Users className="mr-2 h-4 w-4" /> {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
