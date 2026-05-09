import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/** Qualquer papel na agência (para ações ao nível da conta, não por cliente). */
export async function assertUserMemberOfAgency(
  admin: SupabaseClient,
  userId: string,
  agencyId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("agency_id", agencyId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** Membro da agência + escopo de cliente (owner/admin veem todos os clientes). */
export async function assertUserCanAccessClient(
  admin: SupabaseClient,
  userId: string,
  client: { id: string; agency_id: string },
): Promise<boolean> {
  const { data: roles, error: rErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("agency_id", client.agency_id);
  if (rErr || !roles?.length) return false;
  if (roles.some((r) => r.role === "owner" || r.role === "admin")) {
    return true;
  }
  const { data: scope } = await admin
    .from("client_member_scopes")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", client.id)
    .maybeSingle();
  return !!scope;
}
