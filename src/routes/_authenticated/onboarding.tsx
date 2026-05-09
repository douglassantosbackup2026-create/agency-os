import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader } from "@/components/operational-ui";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Plug,
  Sparkles,
  UserPlus,
  Loader2,
  Zap,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ONBOARDING_CHECKLIST_STEPS } from "@/lib/onboarding-checklist";
import { throwIfSupabaseError } from "@/lib/supabase-result";
import { QueryErrorState } from "@/components/query-error-state";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const SETUP_STEPS = [
  { num: 1, label: "Primeiro cliente" },
  { num: 2, label: "Integração" },
  { num: 3, label: "Marca & portal" },
  { num: 4, label: "Time" },
  { num: 5, label: "Explorar" },
] as const;

function SetupStepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {SETUP_STEPS.map((step, idx) => {
        const done = step.num < current;
        const active = step.num === current;
        return (
          <div key={step.num} className="flex items-center gap-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "border-2 border-primary text-primary"
                      : "border border-border text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.num}
              </span>
              <span
                className={`hidden text-xs sm:inline ${
                  active
                    ? "font-medium text-foreground"
                    : done
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < SETUP_STEPS.length - 1 && (
              <div
                className={`h-px w-4 shrink-0 ${done ? "bg-primary" : "bg-border"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AhaMomentCallout({ clientName }: { clientName: string }) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4">
      <div className="flex items-start gap-3">
        <Zap className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="font-medium text-foreground">
            {clientName} foi adicionado ao cockpit!
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            O Health Score está sendo calculado. Conecte uma integração no
            próximo passo para ver dados reais de performance.
          </p>
          <Link
            to="/dashboard"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Ver no cockpit agora <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Onboarding() {
  const { agency, user } = useAuth();
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
  const [runDiagnosticAfterCreate, setRunDiagnosticAfterCreate] =
    useState(true);
  const [firstCreatedClientName, setFirstCreatedClientName] = useState<
    string | null
  >(null);

  const {
    data: checklistData,
    isError: checklistError,
    error: checklistErr,
    refetch: refetchChecklist,
  } = useQuery({
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
      throwIfSupabaseError(clientsRes.error, "onboarding.clients");
      throwIfSupabaseError(itemsRes.error, "onboarding.checklist_items");
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

  const { data: tourProfile } = useQuery({
    queryKey: ["profile-product-tour", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("has_completed_product_tour")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { has_completed_product_tour: boolean } | null;
    },
  });

  async function completeProductTour() {
    if (!user?.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({ has_completed_product_tour: true })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Tour marcado como concluído.");
      void queryClient.invalidateQueries({
        queryKey: ["profile-product-tour", user.id],
      });
    }
  }

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
    const createdName = quickClientName.trim();
    toast.success("Cliente criado em modo onboarding rápido.");
    setFirstCreatedClientName(createdName);
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

  if (checklistError) {
    return (
      <div className="p-6">
        <QueryErrorState
          title="Não foi possível carregar o checklist"
          message={
            checklistErr instanceof Error
              ? checklistErr.message
              : String(checklistErr ?? "Erro")
          }
          onRetry={() => void refetchChecklist()}
        />
      </div>
    );
  }

  const currentStep = firstCreatedClientName ? 2 : 1;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Configuração inicial
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Siga os passos para deixar seu cockpit pronto em menos de 10 minutos.
        </p>
        <div className="mt-4">
          <SetupStepper current={currentStep} />
        </div>
      </header>

      {firstCreatedClientName && (
        <AhaMomentCallout clientName={firstCreatedClientName} />
      )}

      <Card>
        <CardHeader title="Passo 1 · Adicione seu primeiro cliente" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Cadastre com dados mínimos agora. Você completa integrações e metas
            no próximo passo — o cockpit já aparece no dashboard.
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
              Calcular Health Score inicial após criar (recomendado)
            </label>
            <input
              value={quickClientName}
              onChange={(e) => setQuickClientName(e.target.value)}
              placeholder="Nome do cliente *"
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:col-span-4"
            >
              Criar cliente e ir para o cockpit
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </Card>

      <Card>
        <CardHeader title="Passo 2 · Conecte 1 integração" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Você não precisa conectar tudo agora.{" "}
            <strong className="font-medium text-foreground">
              Uma integração já é suficiente
            </strong>{" "}
            para o Retentio mostrar dados reais de performance no cockpit.
          </p>
          <p className="text-xs">
            Sugerido: comece com Meta Ads ou Google Analytics. Demais canais
            você conecta depois, no seu ritmo.
          </p>
          <Link
            to="/integrations"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <Plug className="h-3.5 w-3.5" />
            Conectar integração agora
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="Passo 3 · Marca & portal white-label" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Defina nome, logo e cor primária da agência. Isso aparece no portal
            público do cliente — o link que você envia para ele ver a
            performance.
          </p>
          {agency?.slug && (
            <p className="text-xs">
              Link do portal:{" "}
              <code className="rounded bg-surface px-1 font-mono">
                {slugHint}
              </code>
            </p>
          )}
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            Abrir configurações <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="Passo 4 · Convide o time" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Membros recebem acesso ao cockpit e podem gerenciar clientes
            conforme o papel (member, admin, owner).
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
            Gerenciar membros na área Admin →
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="Passo 5 · Explore o cockpit" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Abra o dashboard e veja o cockpit em ação. Se ainda não conectou
            integração real, explore com dados de demonstração — tudo funciona
            da mesma forma.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              Ir ao dashboard <Sparkles className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/clients"
              className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Ver clientes <ExternalLink className="h-3 w-3 opacity-70" />
            </Link>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Tour do produto (~3 min)" />
        <div className="space-y-3 p-4 text-sm">
          {tourProfile?.has_completed_product_tour ? (
            <p className="text-muted-foreground">
              Concluíste o tour guiado. Podes repetir os passos abaixo quando
              quiseres.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Abre cada passo na ordem: cockpit → alerta → ação → feed. No fim,
              marca como concluído.
            </p>
          )}
          <ol className="list-decimal space-y-2 pl-5 text-xs">
            <li>
              <Link className="font-medium text-primary hover:underline" to="/clients">
                Abrir cockpit (lista de clientes)
              </Link>
            </li>
            <li>
              <Link className="font-medium text-primary hover:underline" to="/alerts">
                Abrir um alerta na Central de alertas
              </Link>
            </li>
            <li>
              <Link className="font-medium text-primary hover:underline" to="/actions">
                Virar em ação ou rever a Central de Ações
              </Link>
            </li>
            <li>
              <Link className="font-medium text-primary hover:underline" to="/activity">
                Ver o feed de atividade
              </Link>
            </li>
          </ol>
          {!tourProfile?.has_completed_product_tour && (
            <button
              type="button"
              onClick={() => void completeProductTour()}
              className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            >
              Marcar tour como concluído
            </button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Checklist operacional por cliente" />
        <div className="space-y-3 p-4">
          {(checklistData?.clients ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Adicione clientes no passo 1 para acompanhar progresso de
              onboarding e time-to-value.
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
                          <span>
                            <span className="text-foreground">{step.title}</span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                              {step.impact}
                            </span>
                          </span>
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
