import { resolveSupabaseConfig } from "@/lib/supabase-config";

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
