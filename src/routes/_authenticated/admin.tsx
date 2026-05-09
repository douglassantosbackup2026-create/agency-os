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
      return {
        roles: roles.data ?? [],
        flags: flags.data ?? [],
        sub: sub.data,
        activity: activity.data ?? [],
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

  async function toggleFlag(key: string, current?: any) {
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
            {data.roles.map((r: any) => (
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
              const current = data.flags.find((x: any) => x.key === f.key);
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
          <CardHeader title="Atividade recente da agência" />
          {data.activity.length === 0 ? (
            <Empty label="Sem atividade ainda." />
          ) : (
            <div className="divide-y divide-border">
              {data.activity.map((a: any) => (
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
