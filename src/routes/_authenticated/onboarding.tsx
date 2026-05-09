import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader } from "@/components/operational-ui";
import {
  ArrowRight,
  ExternalLink,
  Plug,
  Sparkles,
  UserPlus,
  Loader2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ONBOARDING_CHECKLIST_STEPS } from "@/lib/onboarding-checklist";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const { agency } = useAuth();
  const queryClient = useQueryClient();
  const slugHint = agency?.slug
    ? `/p/${agency.slug}`
    : "/p/seu-slug-do-cliente";

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [quickClientName, setQuickClientName] = useState("");
  const [quickBudget, setQuickBudget] = useState("");
  const [quickMrr, setQuickMrr] = useState("");

  const { data: checklistData, refetch: refetchChecklist } = useQuery({
    queryKey: ["onboarding-checklist", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const [clientsRes, itemsRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name")
          .eq("agency_id", agency!.id)
          .order("name"),
        supabase
          .from("onboarding_checklist_items")
          .select("id, client_id, step_key, status")
          .eq("agency_id", agency!.id),
      ]);
      const clients = (clientsRes.data ?? []) as Array<{
        id: string;
        name: string;
      }>;
      const items = (itemsRes.data ?? []) as Array<{
        id: string;
        client_id: string;
        step_key: string;
        status: "pending" | "done";
      }>;
      return { clients, items };
    },
  });

  async function toggleChecklist(
    clientId: string,
    stepKey: string,
    done: boolean,
  ) {
    if (!agency) return;
    const existing = checklistData?.items.find(
      (i) => i.client_id === clientId && i.step_key === stepKey,
    );
    const payload = {
      agency_id: agency.id,
      client_id: clientId,
      step_key: stepKey,
      title:
        ONBOARDING_CHECKLIST_STEPS.find((s) => s.key === stepKey)?.title ??
        "Etapa onboarding",
      status: done ? "done" : "pending",
      completed_at: done ? new Date().toISOString() : null,
      sort_order: Math.max(
        0,
        ONBOARDING_CHECKLIST_STEPS.findIndex((s) => s.key === stepKey),
      ),
    };
    const op = existing
      ? supabase
          .from("onboarding_checklist_items")
          .update(payload)
          .eq("id", existing.id)
      : supabase.from("onboarding_checklist_items").insert(payload);
    const { error } = await op;
    if (error) {
      toast.error(error.message);
      return;
    }
    refetchChecklist();
    void queryClient.invalidateQueries({
      queryKey: ["layout-nav-meta", agency?.id],
    });
  }

  async function sendInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Informe o email.");
      return;
    }
    setInviting(true);
    const { error } = await supabase.functions.invoke("invite-member", {
      body: { email: inviteEmail.trim(), role: inviteRole },
    });
    setInviting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Convite enviado ou role atualizado.");
      setInviteEmail("");
    }
  }

  async function quickCreateClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!agency) return;
    if (!quickClientName.trim())
      return toast.error("Informe o nome do cliente.");
    const slug =
      quickClientName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6);
    const { data: inserted, error } = await supabase
      .from("clients")
      .insert({
        agency_id: agency.id,
        name: quickClientName.trim(),
        monthly_budget: Number(quickBudget) || 0,
        mrr: Number(quickMrr) || 0,
        status: "onboarding",
        portal_slug: slug,
      })
      .select("id")
      .maybeSingle();
    if (error) return toast.error(error.message);
    toast.success("Cliente criado em modo onboarding rápido.");
    setQuickClientName("");
    setQuickBudget("");
    setQuickMrr("");
    refetchChecklist();

    if (inserted?.id && runDiagnosticAfterCreate) {
      const tid = toast.loading("Rodando diagnóstico de saúde da carteira…");
      const { error: fnErr } = await supabase.functions.invoke(
        "compute-health-scores",
        { body: { agency_id: agency.id } },
      );
      toast.dismiss(tid);
      if (fnErr) toast.error(fnErr.message);
      else {
        toast.success(
          "Indicadores de saúde e briefing atualizados para a agência (inclui o novo cliente quando houver dados).",
        );
        const payload = {
          agency_id: agency.id,
          client_id: inserted.id,
          step_key: "diagnostic_run",
          title:
            ONBOARDING_CHECKLIST_STEPS.find((s) => s.key === "diagnostic_run")?.title ??
            "Diagnóstico inicial de saúde da carteira",
          status: "done" as const,
          completed_at: new Date().toISOString(),
          sort_order: Math.max(
            0,
            ONBOARDING_CHECKLIST_STEPS.findIndex((s) => s.key === "diagnostic_run"),
          ),
        };
        await supabase.from("onboarding_checklist_items").upsert(payload, {
          onConflict: "client_id,step_key",
        });
        refetchChecklist();
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Configuração inicial
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Você já pode usar o Retentio — estes passos deixam o workspace pronto
          para o time e para o cliente final.
        </p>
      </header>

      <Card>
        <CardHeader title="0. Onboarding em 3 minutos" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Cadastre cliente com dados mínimos para começar a operar e gerar
            diagnóstico inicial.
          </p>
          <form
            onSubmit={quickCreateClient}
            className="grid gap-2 sm:grid-cols-4 sm:items-end"
          >
            <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-4">
              <input
                type="checkbox"
                checked={runDiagnosticAfterCreate}
                onChange={(e) => setRunDiagnosticAfterCreate(e.target.checked)}
              />
              Rodar diagnóstico inicial de saúde da carteira (atualiza scores e
              briefing)
            </label>
            <input
              value={quickClientName}
              onChange={(e) => setQuickClientName(e.target.value)}
              placeholder="Nome do cliente"
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground sm:col-span-2"
            />
            <input
              value={quickBudget}
              onChange={(e) => setQuickBudget(e.target.value)}
              placeholder="Budget mensal"
              type="number"
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            />
            <input
              value={quickMrr}
              onChange={(e) => setQuickMrr(e.target.value)}
              placeholder="MRR"
              type="number"
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:col-span-4"
            >
              Criar cliente rápido
            </button>
          </form>
        </div>
      </Card>

      <Card>
        <CardHeader title="1. Marca & portal" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Defina nome, logo e cor primária para o painel white-label e para o
            portal público do cliente.
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            Abrir configurações <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="2. Portal do cliente" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Cada cliente pode ter um{" "}
            <code className="rounded bg-surface px-1 font-mono text-xs">
              portal_slug
            </code>{" "}
            na ficha. O link público segue o formato{" "}
            <code className="rounded bg-surface px-1 font-mono text-xs">
              {slugHint}
            </code>
            .
          </p>
          <Link
            to="/clients"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            Gerenciar clientes <ExternalLink className="h-3 w-3 opacity-70" />
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="3. Convide o time" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Apenas perfis owner/admin conseguem concluir o convite. Em caso de
            erro, faça pela área Admin.
          </p>
          <form
            onSubmit={sendInvite}
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          >
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@equipe.com"
              className="h-10 min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Enviar convite
            </button>
          </form>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Abrir área administrativa para gestão de membros →
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="4. Integrações & dados reais" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Conecte Meta Ads ou Google Analytics com token válido para preencher
            métricas reais — ou use apenas sync simulado para demos.
          </p>
          <Link
            to="/integrations"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <Plug className="h-3.5 w-3.5" />
            Integrações e sincronização
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="5. Explorar com dados demo" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Gere métricas e alertas fictícios para validar dashboards e
            automações.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            Ir ao dashboard <Sparkles className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="Checklist operacional por cliente" />
        <div className="space-y-3 p-4">
          {(checklistData?.clients ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Adicione clientes para acompanhar onboarding e time-to-value.
            </p>
          ) : (
            (checklistData?.clients ?? []).map((client) => {
              const doneCount = ONBOARDING_CHECKLIST_STEPS.filter((step) =>
                checklistData?.items.some(
                  (i) =>
                    i.client_id === client.id &&
                    i.step_key === step.key &&
                    i.status === "done",
                ),
              ).length;
              const pct = Math.round(
                (doneCount / ONBOARDING_CHECKLIST_STEPS.length) * 100,
              );
              return (
                <div
                  key={client.id}
                  className="rounded-md border border-border p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium">{client.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {doneCount}/{ONBOARDING_CHECKLIST_STEPS.length} · {pct}%
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-surface">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {ONBOARDING_CHECKLIST_STEPS.map((step) => {
                      const done = checklistData?.items.some(
                        (i) =>
                          i.client_id === client.id &&
                          i.step_key === step.key &&
                          i.status === "done",
                      );
                      return (
                        <label
                          key={step.key}
                          className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                        >
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={(e) =>
                              toggleChecklist(
                                client.id,
                                step.key,
                                e.target.checked,
                              )
                            }
                          />
                          {step.title}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
