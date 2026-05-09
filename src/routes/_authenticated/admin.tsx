import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { toast } from "sonner";
import {
  UserPlus,
  Shield,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardHeader, Empty, PageSkeleton } from "./dashboard";
import { timeAgo, initials } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type AiUsageRow = Pick<
  Database["public"]["Tables"]["ai_usage_events"]["Row"],
  | "function_name"
  | "estimated_cost_usd"
  | "prompt_tokens"
  | "completion_tokens"
  | "day"
>;

type FeatureFlagRow = Database["public"]["Tables"]["feature_flags"]["Row"];
type SyncRunRow = Database["public"]["Tables"]["sync_runs"]["Row"];
type IntegrationRow = Pick<
  Database["public"]["Tables"]["integrations"]["Row"],
  "provider" | "status" | "token_expires_at" | "last_sync_at"
>;

type AdminRoleRow = Database["public"]["Tables"]["user_roles"]["Row"] & {
  profiles?: {
    email?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

type ClientMini = Pick<
  Database["public"]["Tables"]["clients"]["Row"],
  "id" | "name"
>;

type ScopeRow = Pick<
  Database["public"]["Tables"]["client_member_scopes"]["Row"],
  "id" | "user_id" | "client_id"
>;

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"] & {
  profiles?: { display_name?: string | null } | null;
};

function exportAuditActionCsv(
  recoByAction: Record<string, number>,
  auditActionsByStatus: Record<string, number>,
  rows: Array<{
    id: string;
    status: string;
    title: string;
    client_id: string | null;
    created_at: string;
  }>,
) {
  const lines: string[] = [];
  lines.push(
    `${csvEscape("tipo")},${csvEscape("chave")},${csvEscape("valor")}`,
  );
  for (const [k, v] of Object.entries(recoByAction)) {
    lines.push(
      `${csvEscape("reco_user_action")},${csvEscape(k)},${csvEscape(String(v))}`,
    );
  }
  for (const [k, v] of Object.entries(auditActionsByStatus)) {
    lines.push(
      `${csvEscape("central_acoes_status")},${csvEscape(k)},${csvEscape(String(v))}`,
    );
  }
  lines.push("");
  lines.push(
    `${csvEscape("id")},${csvEscape("status")},${csvEscape("client_id")},${csvEscape("created_at")},${csvEscape("title")}`,
  );
  for (const r of rows) {
    lines.push(
      `${csvEscape(r.id)},${csvEscape(r.status)},${csvEscape(r.client_id ?? "")},${csvEscape(r.created_at)},${csvEscape(r.title ?? "")}`,
    );
  }
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auditoria-acoes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(cell: string): string {
  const s = String(cell ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) throw redirect({ to: "/login" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", session.user.id)
      .maybeSingle();
    if (!profile?.agency_id) throw redirect({ to: "/dashboard" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("agency_id", profile.agency_id)
      .in("role", ["owner", "admin"]);
    if (!roles?.length) throw redirect({ to: "/dashboard" });
  },
  component: Admin,
});

const DEFAULT_FLAGS = [
  { key: "ai_reports", label: "Relatórios IA" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "client_portal", label: "Portal do cliente" },
  { key: "auto_alerts", label: "Alertas automáticos" },
];

function Admin() {
  const { agency, user } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const [roles, flags, sub, activity] = await Promise.all([
        supabase
          .from("user_roles")
          .select("*, profiles:user_id(email, display_name, avatar_url)")
          .eq("agency_id", agency!.id),
        supabase.from("feature_flags").select("*").eq("agency_id", agency!.id),
        supabase
          .from("subscriptions")
          .select("*")
          .eq("agency_id", agency!.id)
          .maybeSingle(),
        supabase
          .from("activities")
          .select("*, profiles:user_id(display_name)")
          .eq("agency_id", agency!.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      const sinceAi = new Date(Date.now() - 30 * 86400000)
        .toISOString()
        .slice(0, 10);
      const [
        clients,
        scopes,
        syncRuns,
        syncRunErrors,
        aiUsage,
        integrations,
        auditRecoStatuses,
        auditCampaignActions,
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name")
          .eq("agency_id", agency!.id)
          .order("name"),
        supabase
          .from("client_member_scopes")
          .select("id, user_id, client_id")
          .eq("agency_id", agency!.id),
        supabase
          .from("sync_runs")
          .select("*")
          .eq("agency_id", agency!.id)
          .order("created_at", { ascending: false })
          .limit(24),
        supabase
          .from("sync_runs")
          .select("*")
          .eq("agency_id", agency!.id)
          .eq("status", "error")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("ai_usage_events")
          .select(
            "function_name, estimated_cost_usd, prompt_tokens, completion_tokens, day",
          )
          .eq("agency_id", agency!.id)
          .gte("day", sinceAi)
          .order("day", { ascending: false })
          .limit(500),
        supabase
          .from("integrations")
          .select("provider, status, token_expires_at, last_sync_at")
          .eq("agency_id", agency!.id),
        supabase
          .from("campaign_ai_audit_recommendation_status")
          .select("user_action")
          .eq("agency_id", agency!.id)
          .limit(4000),
        supabase
          .from("action_center")
          .select("id, status, title, client_id, created_at")
          .eq("agency_id", agency!.id)
          .eq("source_type", "auditoria_campanhas_ia")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      const recoByAction: Record<string, number> = {};
      for (const row of auditRecoStatuses.data ?? []) {
        const k = String(row.user_action ?? "—");
        recoByAction[k] = (recoByAction[k] ?? 0) + 1;
      }
      const auditActionsByStatus: Record<string, number> = {};
      for (const row of auditCampaignActions.data ?? []) {
        const k = String(row.status ?? "—");
        auditActionsByStatus[k] = (auditActionsByStatus[k] ?? 0) + 1;
      }

      return {
        roles: (roles.data ?? []) as AdminRoleRow[],
        flags: (flags.data ?? []) as FeatureFlagRow[],
        sub: sub.data,
        activity: (activity.data ?? []) as ActivityRow[],
        clients: (clients.data ?? []) as ClientMini[],
        scopes: (scopes.data ?? []) as ScopeRow[],
        syncRuns: (syncRuns.data ?? []) as SyncRunRow[],
        syncRunErrors: (syncRunErrors.data ?? []) as SyncRunRow[],
        aiUsage: (aiUsage.data ?? []) as AiUsageRow[],
        integrations: (integrations.data ?? []) as IntegrationRow[],
        recoByAction,
        auditActionsByStatus,
        auditCampaignActions: auditCampaignActions.data ?? [],
      };
    },
  });

  async function invite() {
    if (!email) return toast.error("Informe o email");
    setInviting(true);
    const { error } = await supabase.functions.invoke("invite-member", {
      body: { email, role },
    });
    setInviting(false);
    if (error) return toast.error(error.message);
    toast.success("Convite enviado.");
    setEmail("");
    refetch();
  }

  async function removeMember(id: string) {
    if (!confirm("Remover membro da agência?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido.");
    refetch();
  }

  async function activateDemoPro() {
    if (!agency) return;
    const { error } = await supabase.from("subscriptions").upsert(
      {
        agency_id: agency.id,
        plan: "pro",
        status: "active",
        max_clients: 50,
        max_alerts: 500,
        current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
      { onConflict: "agency_id" },
    );
    if (error) return toast.error(error.message);
    toast.success("Plano Pro (demo) ativado na base.");
    refetch();
  }

  async function toggleFlag(key: string, current?: FeatureFlagRow) {
    if (current) {
      await supabase
        .from("feature_flags")
        .update({ enabled: !current.enabled })
        .eq("id", current.id);
    } else {
      await supabase
        .from("feature_flags")
        .insert({ agency_id: agency!.id, key, enabled: true });
    }
    refetch();
  }

  async function toggleScope(
    userId: string,
    clientId: string,
    active: boolean,
  ) {
    if (active) {
      const { error } = await supabase
        .from("client_member_scopes")
        .delete()
        .eq("agency_id", agency!.id)
        .eq("user_id", userId)
        .eq("client_id", clientId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("client_member_scopes").insert({
        agency_id: agency!.id,
        user_id: userId,
        client_id: clientId,
      });
      if (error) return toast.error(error.message);
    }
    refetch();
  }

  if (isLoading || !data) return <PageSkeleton />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Membros, permissões, feature flags e atividade da agência.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Membros (${data.roles.length})`} />
          <div className="border-b border-border p-3">
            <div className="flex flex-wrap gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@dominio.com"
                className="h-9 min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 text-sm"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
              <button
                onClick={invite}
                disabled={inviting}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {inviting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}{" "}
                Convidar
              </button>
            </div>
          </div>
          <div className="divide-y divide-border">
            {data.roles.map((r: AdminRoleRow) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-xs font-medium">
                    {initials(r.profiles?.display_name || r.profiles?.email)}
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {r.profiles?.display_name || r.profiles?.email}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.profiles?.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase text-primary">
                    <Shield className="h-3 w-3" /> {r.role}
                  </span>
                  {r.user_id !== user?.id && (
                    <button
                      onClick={() => removeMember(r.id)}
                      className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Feature flags" />
          <div className="divide-y divide-border">
            {DEFAULT_FLAGS.map((f) => {
              const current = data.flags.find(
                (x: FeatureFlagRow) => x.key === f.key,
              );
              const enabled = current?.enabled ?? false;
              return (
                <button
                  key={f.key}
                  onClick={() => toggleFlag(f.key, current)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface"
                >
                  <div>
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {f.key}
                    </div>
                  </div>
                  {enabled ? (
                    <ToggleRight className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Plano & assinatura" />
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <Stat
              label="Plano"
              value={data.sub?.plan?.toUpperCase() ?? "FREE"}
            />
            <Stat label="Status" value={data.sub?.status ?? "trialing"} />
            <Stat
              label="Limite de clientes"
              value={String(data.sub?.max_clients ?? 5)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={activateDemoPro}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Ativar plano Pro (demo local)
            </button>
            <span className="text-[11px] text-muted-foreground">
              Persiste limites em{" "}
              <code className="rounded bg-surface px-1">subscriptions</code>.
              Meio de pagamento não configurado nesta fase; ajustes manuais na
              base ou futura integração.
            </span>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Escopo por carteira de clientes (membros)" />
          <div className="space-y-3 p-4">
            {data.roles
              .filter((r: AdminRoleRow) => r.role === "member")
              .map((member: AdminRoleRow) => (
                <div
                  key={member.id}
                  className="rounded-md border border-border p-3"
                >
                  <div className="mb-2 text-sm font-medium">
                    {member.profiles?.display_name || member.profiles?.email}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {data.clients.map((c: ClientMini) => {
                      const active = data.scopes.some(
                        (s: ScopeRow) =>
                          s.user_id === member.user_id && s.client_id === c.id,
                      );
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() =>
                              toggleScope(member.user_id, c.id, active)
                            }
                          />
                          {c.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            {data.roles.filter((r: AdminRoleRow) => r.role === "member")
              .length === 0 && (
              <Empty label="Convide membros para configurar carteira por cliente." />
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Operações — sync & IA (MVP)" />
          <div className="grid gap-4 border-b border-border p-4 md:grid-cols-2">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Últimos erros de sync (até 50)
              </div>
              {(data.syncRunErrors ?? []).length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Nenhum erro recente em sync_runs.
                </p>
              ) : (
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                  {(data.syncRunErrors ?? [])
                    .slice(0, 25)
                    .map((r: SyncRunRow) => (
                      <li
                        key={r.id}
                        className="rounded border border-border/80 bg-surface px-2 py-1"
                      >
                        <span className="font-medium">{r.provider}</span>
                        {r.error_message
                          ? ` — ${String(r.error_message).slice(0, 160)}`
                          : ""}
                        <span className="block text-[10px] text-muted-foreground">
                          {timeAgo(r.created_at)}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Uso de IA estimado (últimos 30 dias)
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Valores aproximados a partir de tokens retornados pelo gateway;
                só registra chamadas após deploy desta versão.
              </p>
              {(() => {
                const agg = new Map<
                  string,
                  { usd: number; tokens: number; n: number }
                >();
                for (const row of data.aiUsage ?? []) {
                  const fn = String(row.function_name ?? "?");
                  const cur = agg.get(fn) ?? { usd: 0, tokens: 0, n: 0 };
                  cur.usd += Number(row.estimated_cost_usd ?? 0);
                  cur.tokens +=
                    Number(row.prompt_tokens ?? 0) +
                    Number(row.completion_tokens ?? 0);
                  cur.n += 1;
                  agg.set(fn, cur);
                }
                if (agg.size === 0) {
                  return (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Sem eventos de uso registrados.
                    </p>
                  );
                }
                return (
                  <ul className="mt-2 space-y-1 text-xs">
                    {[...agg.entries()].map(([fn, v]) => (
                      <li
                        key={fn}
                        className="flex justify-between gap-2 rounded border border-border/80 px-2 py-1"
                      >
                        <span className="font-mono text-[11px]">{fn}</span>
                        <span className="text-muted-foreground">
                          ~${v.usd.toFixed(4)} · {v.tokens} tok · {v.n} cham.
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Central de Ações — auditoria IA" />
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="max-w-xl text-xs text-muted-foreground">
              Agregados por origem{" "}
              <span className="font-mono">auditoria_campanhas_ia</span> na
              Central de Ações e contagem de estados persistidos em{" "}
              <span className="font-mono">
                campaign_ai_audit_recommendation_status
              </span>
              .
            </p>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-surface"
              onClick={() => {
                exportAuditActionCsv(
                  data.recoByAction,
                  data.auditActionsByStatus,
                  data.auditCampaignActions,
                );
                toast.success("CSV exportado.");
              }}
            >
              Exportar CSV
            </button>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Tarefas (auditoria_campanhas_ia)
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {Object.entries(data.auditActionsByStatus).length === 0 ? (
                  <li className="text-muted-foreground">
                    Sem tarefas registadas.
                  </li>
                ) : (
                  Object.entries(data.auditActionsByStatus).map(([st, n]) => (
                    <li key={st} className="flex justify-between gap-2">
                      <span className="font-mono">{st}</span>
                      <span>{n}</span>
                    </li>
                  ))
                )}
              </ul>
              <div className="mt-2 text-[10px] text-muted-foreground">
                Amostra: {(data.auditCampaignActions ?? []).length} linhas
                recentes.
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Estados persistidos (recomendações)
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {Object.entries(data.recoByAction).length === 0 ? (
                  <li className="text-muted-foreground">Sem registos.</li>
                ) : (
                  Object.entries(data.recoByAction).map(([act, n]) => (
                    <li key={act} className="flex justify-between gap-2">
                      <span className="font-mono">{act}</span>
                      <span>{n}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Admin técnico operacional" />
          <div className="grid gap-3 p-4 md:grid-cols-3">
            <Stat
              label="Sync com erro (amostra recente)"
              value={String(
                (data.syncRuns ?? []).filter(
                  (r: SyncRunRow) => r.status === "error",
                ).length,
              )}
            />
            <Stat
              label="Integrações conectadas"
              value={String(
                (data.integrations ?? []).filter(
                  (i: IntegrationRow) => i.status === "connected",
                ).length,
              )}
            />
            <Stat
              label="Tokens expiram em 7 dias"
              value={String(
                (data.integrations ?? []).filter((i: IntegrationRow) => {
                  if (!i.token_expires_at) return false;
                  const t = new Date(i.token_expires_at).getTime();
                  return t > Date.now() && t < Date.now() + 7 * 86400000;
                }).length,
              )}
            />
          </div>
          <div className="divide-y divide-border border-t border-border">
            {(data.syncRuns ?? []).slice(0, 8).map((r: SyncRunRow) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-4 py-2 text-xs"
              >
                <span>
                  {r.provider} · {r.status}
                  {r.error_message ? ` · ${r.error_message}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {timeAgo(r.created_at)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Atividade recente da agência" />
          {data.activity.length === 0 ? (
            <Empty label="Sem atividade ainda." />
          ) : (
            <div className="divide-y divide-border">
              {data.activity.map((a: ActivityRow) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase text-primary">
                      {a.type}
                    </span>
                    <span className="text-sm">{a.title}</span>
                    {a.profiles?.display_name && (
                      <span className="text-[11px] text-muted-foreground">
                        por {a.profiles.display_name}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(a.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold">{value}</div>
    </div>
  );
}
