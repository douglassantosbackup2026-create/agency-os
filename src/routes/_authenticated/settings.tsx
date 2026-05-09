import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader } from "./dashboard";
import { toast } from "sonner";
import { Database, Upload, Loader2, Globe } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings")({ component: Settings });

function Settings() {
  const { agency, refreshAgency } = useAuth();
  const [name, setName] = useState(agency?.name ?? "");
  const [color, setColor] = useState(agency?.primary_color ?? "#7c5cff");
  const [logo, setLogo] = useState(agency?.logo_url ?? "");
  const [domain, setDomain] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function save() {
    const { error } = await supabase.from("agencies").update({
      name, primary_color: color, logo_url: logo || null,
      custom_domain: domain || null,
    }).eq("id", agency!.id);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas.");
    refreshAgency();
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    const path = `${agency!.id}/logo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data } = supabase.storage.from("branding").getPublicUrl(path);
    setLogo(data.publicUrl);
    setUploading(false);
    toast.success("Logo carregado.");
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
        <p className="mt-0.5 text-sm text-muted-foreground">White-label, domínio e operação.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="White-label" />
          <div className="space-y-3 p-4">
            <Field label="Nome da agência" value={name} onChange={setName} />
            <div>
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Logo</span>
              <div className="flex items-center gap-3">
                {logo && <img src={logo} alt="logo" className="h-12 w-12 rounded-md border border-border object-cover" />}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs hover:bg-surface-2">
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {uploading ? "Carregando..." : "Upload"}
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                </label>
                {logo && <button onClick={() => setLogo("")} className="text-xs text-muted-foreground hover:text-destructive">Remover</button>}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cor primária</span>
              <div className="flex items-center gap-3">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-border bg-transparent" />
                <input value={color} onChange={e => setColor(e.target.value)} className="h-9 flex-1 rounded-md border border-border bg-background px-3 font-mono text-sm" />
              </div>
            </div>
            <Field label="Domínio personalizado" value={domain} onChange={setDomain} placeholder="painel.suaagencia.com" />
            <button onClick={save} className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Salvar</button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Acesso rápido" />
          <div className="divide-y divide-border">
            <Link to="/integrations" className="flex items-center justify-between px-4 py-3 hover:bg-surface">
              <div>
                <div className="text-sm font-medium">Integrações</div>
                <div className="text-[11px] text-muted-foreground">Meta, Google, TikTok, GA4</div>
              </div>
              <span className="text-xs text-muted-foreground">→</span>
            </Link>
            <Link to="/whatsapp" className="flex items-center justify-between px-4 py-3 hover:bg-surface">
              <div>
                <div className="text-sm font-medium">WhatsApp</div>
                <div className="text-[11px] text-muted-foreground">Templates, envios e histórico</div>
              </div>
              <span className="text-xs text-muted-foreground">→</span>
            </Link>
            <Link to="/admin" className="flex items-center justify-between px-4 py-3 hover:bg-surface">
              <div>
                <div className="text-sm font-medium">Administração</div>
                <div className="text-[11px] text-muted-foreground">Membros, flags, plano</div>
              </div>
              <span className="text-xs text-muted-foreground">→</span>
            </Link>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Portal do cliente" />
          <div className="space-y-2 p-4 text-sm text-muted-foreground">
            <p>Cada cliente com <code className="rounded bg-surface px-1 py-0.5 text-[11px]">portal_slug</code> ganha um portal público em <code className="rounded bg-surface px-1 py-0.5 text-[11px]">/p/&lt;slug&gt;</code> com tema da sua agência.</p>
            <p>Configure o slug na tela de cada cliente. Ex: <code className="rounded bg-surface px-1 py-0.5 text-[11px]">/p/acme</code>.</p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Dados de demonstração" />
          <div className="flex items-center justify-between p-4">
            <p className="text-sm text-muted-foreground">Cria 8 clientes fictícios com 30 dias de métricas, alertas e atividades.</p>
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
