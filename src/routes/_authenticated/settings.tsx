import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader } from "./dashboard";
import { toast } from "sonner";
import { Database, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({ component: Settings });

const PROVIDERS = [
  { key: "meta_ads", name: "Meta Ads" },
  { key: "google_ads", name: "Google Ads" },
  { key: "tiktok_ads", name: "TikTok Ads" },
  { key: "google_analytics", name: "Google Analytics" },
  { key: "whatsapp", name: "WhatsApp (Evolution)" },
  { key: "openai", name: "OpenAI" },
];

function Settings() {
  const { agency, refreshAgency } = useAuth();
  const [name, setName] = useState(agency?.name ?? "");
  const [color, setColor] = useState(agency?.primary_color ?? "#7c5cff");
  const [logo, setLogo] = useState(agency?.logo_url ?? "");
  const [seeding, setSeeding] = useState(false);

  async function save() {
    const { error } = await supabase.from("agencies").update({ name, primary_color: color, logo_url: logo || null }).eq("id", agency!.id);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas.");
    refreshAgency();
  }

  async function seed() {
    setSeeding(true);
    const { error } = await supabase.functions.invoke("seed-demo-data");
    setSeeding(false);
    if (error) toast.error(error.message);
    else { toast.success("Dados criados."); setTimeout(() => window.location.reload(), 600); }
  }

  return (
    <div className="space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">White-label, integrações e operação.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="White-label" />
          <div className="space-y-3 p-4">
            <Field label="Nome da agência" value={name} onChange={setName} />
            <Field label="Logo (URL)" value={logo} onChange={setLogo} placeholder="https://..." />
            <div>
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cor primária</span>
              <div className="flex items-center gap-3">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-border bg-transparent" />
                <input value={color} onChange={e => setColor(e.target.value)} className="h-9 flex-1 rounded-md border border-border bg-background px-3 font-mono text-sm" />
              </div>
            </div>
            <button onClick={save} className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Salvar</button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Integrações" />
          <div className="divide-y divide-border">
            {PROVIDERS.map(p => (
              <div key={p.key} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{p.name}</span>
                </div>
                <span className="rounded bg-surface px-2 py-0.5 text-[10px] uppercase text-muted-foreground">Em breve</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Dados de demonstração" />
          <div className="flex items-center justify-between p-4">
            <p className="text-sm text-muted-foreground">Cria 8 clientes fictícios com 30 dias de métricas, alertas e atividades para testar a plataforma.</p>
            <button onClick={seed} disabled={seeding} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
              <Database className="h-3.5 w-3.5" /> {seeding ? "Gerando..." : "Gerar dados demo"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60" />
    </label>
  );
}

export const _u = { CheckCircle2 };
