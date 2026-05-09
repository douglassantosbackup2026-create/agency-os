import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { toast } from "sonner";
import { Send, MessageSquare, Plus, Trash2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardHeader, Empty, PageSkeleton } from "./dashboard";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/whatsapp")({ component: WhatsApp });

const DEFAULT_TEMPLATES = [
  { name: "Resumo diário", type: "daily", body: "Olá {{cliente}}! Resumo de hoje: ROAS {{roas}}x, investimento {{spend}}. Tudo certo por aqui." },
  { name: "Alerta crítico", type: "alert", body: "⚠️ {{cliente}}, identificamos uma queda relevante de ROAS. Já estamos investigando." },
  { name: "Resumo semanal", type: "weekly", body: "Boa noite {{cliente}}! Semana fechou com ROAS médio {{roas}}x e {{conv}} conversões." },
];

function WhatsApp() {
  const { agency } = useAuth();
  const [tab, setTab] = useState<"send" | "templates" | "logs">("send");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [clientId, setClientId] = useState("");
  const [sending, setSending] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplBody, setTplBody] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const [logs, templates, clients] = await Promise.all([
        supabase.from("whatsapp_logs").select("*, clients(name)").eq("agency_id", agency!.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("whatsapp_templates").select("*").eq("agency_id", agency!.id).order("created_at"),
        supabase.from("clients").select("id, name, contact_phone").eq("agency_id", agency!.id).order("name"),
      ]);
      return { logs: logs.data ?? [], templates: templates.data ?? [], clients: clients.data ?? [] };
    },
  });

  async function send() {
    if (!recipient || !message) return toast.error("Preencha destinatário e mensagem.");
    setSending(true);
    const { error } = await supabase.functions.invoke("send-whatsapp", {
      body: { recipient, message, client_id: clientId || null },
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Mensagem enviada.");
    setMessage(""); setRecipient(""); setClientId("");
    refetch();
  }

  async function saveTemplate() {
    if (!tplName || !tplBody) return toast.error("Preencha nome e corpo.");
    const { error } = await supabase.from("whatsapp_templates").insert({
      agency_id: agency!.id, name: tplName, body: tplBody, type: "custom",
    });
    if (error) return toast.error(error.message);
    toast.success("Template salvo.");
    setTplName(""); setTplBody("");
    refetch();
  }

  async function seedDefaults() {
    const rows = DEFAULT_TEMPLATES.map(t => ({ ...t, agency_id: agency!.id }));
    const { error } = await supabase.from("whatsapp_templates").insert(rows);
    if (error) return toast.error(error.message);
    toast.success("Templates padrão criados.");
    refetch();
  }

  async function deleteTpl(id: string) {
    const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refetch();
  }

  function useTemplate(body: string) {
    setMessage(body); setTab("send");
  }

  if (isLoading || !data) return <PageSkeleton />;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Envie alertas, resumos e mensagens diretas via Evolution API.</p>
      </header>

      <div className="flex gap-1 border-b border-border">
        {[
          { k: "send", l: "Enviar" },
          { k: "templates", l: `Templates (${data.templates.length})` },
          { k: "logs", l: `Histórico (${data.logs.length})` },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)} className={`px-3 py-2 text-xs font-medium transition ${tab === t.k ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === "send" && (
        <Card>
          <CardHeader title="Nova mensagem" />
          <div className="space-y-3 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cliente (opcional)</span>
                <select value={clientId} onChange={e => {
                  setClientId(e.target.value);
                  const c = data.clients.find(x => x.id === e.target.value);
                  if (c?.contact_phone) setRecipient(c.contact_phone);
                }} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                  <option value="">—</option>
                  {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Telefone</span>
                <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="55119..." className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-sm" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Mensagem</span>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} className="w-full rounded-md border border-border bg-background p-3 text-sm" />
            </label>
            <button onClick={send} disabled={sending} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar
            </button>
            {!import.meta.env.VITE_EVOLUTION_CONFIGURED && (
              <p className="text-[11px] text-amber-500">⚠️ Sem EVOLUTION_API_URL configurada — envios são simulados (status "sent" mas não saem de fato).</p>
            )}
          </div>
        </Card>
      )}

      {tab === "templates" && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Novo template" />
            <div className="space-y-3 p-4">
              <input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Nome (ex: Alerta crítico)" className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
              <textarea value={tplBody} onChange={e => setTplBody(e.target.value)} rows={3} placeholder="Olá {{cliente}}, ..." className="w-full rounded-md border border-border bg-background p-3 text-sm" />
              <div className="flex gap-2">
                <button onClick={saveTemplate} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"><Plus className="h-3 w-3" /> Salvar</button>
                {data.templates.length === 0 && <button onClick={seedDefaults} className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs">Importar templates padrão</button>}
              </div>
            </div>
          </Card>
          <Card>
            {data.templates.length === 0 ? <Empty label="Nenhum template ainda." /> : (
              <div className="divide-y divide-border">
                {data.templates.map(t => (
                  <div key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm font-medium">{t.name}</span>
                        <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{t.type}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{t.body}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => useTemplate(t.body)} className="rounded px-2 py-1 text-[11px] text-primary hover:bg-primary/10">Usar</button>
                      <button onClick={() => deleteTpl(t.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "logs" && (
        <Card>
          {data.logs.length === 0 ? <Empty label="Nenhuma mensagem enviada ainda." /> : (
            <div className="divide-y divide-border">
              {data.logs.map((l: any) => (
                <div key={l.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${l.status === "sent" ? "bg-emerald-500/10 text-emerald-500" : l.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{l.status}</span>
                      <span className="text-xs font-medium">{l.clients?.name ?? l.recipient}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(l.created_at)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{l.message}</p>
                  {l.error && <p className="mt-1 text-[11px] text-destructive">{l.error}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </motion.div>
  );
}
