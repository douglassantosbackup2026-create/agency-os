import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function putMetaTestExchange(
  accessToken: string,
  expiresIn: number,
): Promise<string> {
  const code = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const { error } = await admin().from("oauth_exchange_codes").insert({
    code,
    purpose: "meta_test",
    access_token: accessToken,
    expires_in: expiresIn,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return code;
}

export async function takeMetaTestExchange(code: string): Promise<{
  access_token: string;
  expires_in: number;
} | null> {
  const sb = admin();
  const { data, error } = await sb
    .from("oauth_exchange_codes")
    .select("access_token, expires_in, expires_at")
    .eq("code", code)
    .eq("purpose", "meta_test")
    .maybeSingle();
  if (error || !data) return null;
  await sb.from("oauth_exchange_codes").delete().eq("code", code);
  if (new Date(String(data.expires_at)).getTime() < Date.now()) return null;
  return {
    access_token: String(data.access_token),
    expires_in: Number(data.expires_in ?? 0),
  };
}
