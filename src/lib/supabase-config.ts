// Public Supabase config (URL + anon key) — safe to ship in client bundle.
// RLS is the real security boundary; service_role_key never touches this file.
export const FALLBACK_SUPABASE_URL = "https://uvuotaxikuxejfeitlaw.supabase.co";
export const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2dW90YXhpa3V4ZWpmZWl0bGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzk4MjcsImV4cCI6MjA5Mzg1NTgyN30.32xOultMJNFLQ98Nw3VxQR5t5wyEH1NxTyg6K_bMl_s";

export function resolveSupabaseConfig(): { url: string; key: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const envKey = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  )?.trim();
  return {
    url: envUrl || FALLBACK_SUPABASE_URL,
    key: envKey || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function resolveSupabaseUrl(): string {
  return resolveSupabaseConfig().url.replace(/\/+$/, "");
}

export function resolveSupabasePublishableKey(): string {
  return resolveSupabaseConfig().key;
}
