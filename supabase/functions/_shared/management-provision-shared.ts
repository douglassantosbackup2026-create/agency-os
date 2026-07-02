import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const PROVISION_CHECKLIST_STEPS: { key: string; title: string; sort: number }[] = [
  { key: "platform_access", title: "Solicitar acessos às plataformas", sort: 0 },
  { key: "budget_goal", title: "Configurar budget e meta do cliente", sort: 1 },
  { key: "portal_sent", title: "Enviar link do portal ao cliente", sort: 2 },
  { key: "first_report", title: "Gerar primeiro relatório IA", sort: 3 },
  { key: "diagnostic_run", title: "Diagnóstico inicial de saúde da carteira", sort: 4 },
];

export async function getFunnelAgencyId(
  admin: SupabaseClient,
): Promise<string | null> {
  const { data } = await admin
    .from("retentio_ops_config")
    .select("diagnosis_funnel_agency_id")
    .eq("id", 1)
    .maybeSingle();
  return (data as { diagnosis_funnel_agency_id?: string | null } | null)
    ?.diagnosis_funnel_agency_id ?? null;
}

export async function assertOperator(
  admin: SupabaseClient,
  userId: string,
  agencyId: string,
): Promise<boolean> {
  const { data: profile } = await admin
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.is_platform_admin) return true;

  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("agency_id", agencyId);
  return (roles ?? []).some((r) => r.role === "owner" || r.role === "admin");
}

export function publicSiteUrl(): string {
  return (
    Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/+$/, "") ||
    "https://agencyopus.live"
  );
}
