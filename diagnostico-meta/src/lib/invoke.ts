const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function assertEnv(): void {
  if (!url?.trim() || !anon?.trim()) {
    throw new Error(
      "Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env",
    );
  }
}

export function functionsBase(): string {
  assertEnv();
  return `${url!.replace(/\/+$/, "")}/functions/v1`;
}

export async function invokeFunction(
  name: string,
  init?: RequestInit & { query?: Record<string, string> },
): Promise<Response> {
  assertEnv();
  const q = init?.query;
  const qs =
    q && Object.keys(q).length > 0
      ? "?" + new URLSearchParams(q).toString()
      : "";
  const res = await fetch(`${functionsBase()}/${name}${qs}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: anon!,
      Authorization: `Bearer ${anon}`,
      ...init?.headers,
    },
  });
  return res;
}
