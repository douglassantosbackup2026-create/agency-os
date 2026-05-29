const DEV_FALLBACK_SUPABASE_URL = "https://uvuotaxikuxejfeitlaw.supabase.co";
const DEV_FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2dW90YXhpa3V4ZWpmZWl0bGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzk4MjcsImV4cCI6MjA5Mzg1NTgyN30.32xOultMJNFLQ98Nw3VxQR5t5wyEH1NxTyg6K_bMl_s";

function resolveSupabaseConfig(): { url: string; key: string } {
  const isProd = import.meta.env.PROD;
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const envKey = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  )?.trim();
  const url = envUrl || (!isProd ? DEV_FALLBACK_SUPABASE_URL : "");
  const key = envKey || (!isProd ? DEV_FALLBACK_SUPABASE_PUBLISHABLE_KEY : "");
  if (!url || !key) {
    throw new Error(
      "VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórios em produção.",
    );
  }
  return { url, key };
}

function functionsBase(): string {
  const { url } = resolveSupabaseConfig();
  return `${url.replace(/\/+$/, "")}/functions/v1`;
}

export async function invokeDiagnosisFunction(
  name: string,
  init?: RequestInit & { query?: Record<string, string> },
): Promise<Response> {
  const { key } = resolveSupabaseConfig();
  const q = init?.query;
  const qs =
    q && Object.keys(q).length > 0
      ? "?" + new URLSearchParams(q).toString()
      : "";
  return fetch(`${functionsBase()}/${name}${qs}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...init?.headers,
    },
  });
}
