import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export async function assertPlatformAdmin(
  authHeader: string | null,
): Promise<
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; status: number; message: string }
> {
  if (!authHeader) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: u } = await userClient.auth.getUser();
  if (!u.user) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await admin
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", u.user.id)
    .maybeSingle();

  if (!profile?.is_platform_admin) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return { ok: true, userId: u.user.id, admin };
}
