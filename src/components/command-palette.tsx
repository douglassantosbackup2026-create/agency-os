import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { Bell, LayoutDashboard, ShieldCheck, Sparkles, Users, Settings, Plus, Database } from "lucide-react";
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

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  const seed = async () => {
    onOpenChange(false);
    const tid = toast.loading("Gerando dados de exemplo...");
    const { error } = await supabase.functions.invoke("seed-demo-data");
    toast.dismiss(tid);
    if (error) toast.error(error.message);
    else toast.success("Dados criados. Recarregando...");
    setTimeout(() => window.location.reload(), 800);
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
          <CommandItem onSelect={() => go("/settings")}><Settings className="mr-2 h-4 w-4" /> Configurações</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => go("/clients?new=1")}><Plus className="mr-2 h-4 w-4" /> Novo cliente</CommandItem>
          <CommandItem onSelect={seed}><Database className="mr-2 h-4 w-4" /> Gerar dados de exemplo</CommandItem>
        </CommandGroup>
        {clients.length > 0 && (
          <CommandGroup heading="Clientes">
            {clients.map(c => (
              <CommandItem key={c.id} onSelect={() => go(`/clients/${c.id}`)}>
                <Users className="mr-2 h-4 w-4" /> {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
