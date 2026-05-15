const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

function assertEnv(): void {
  if (!url?.trim() || !key?.trim()) {
    throw new Error(
      "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env",
    );
  }
}

function functionsBase(): string {
  assertEnv();
  return `${url!.replace(/\/+$/, "")}/functions/v1`;
}

export async function invokeDiagnosisFunction(
  name: string,
  init?: RequestInit & { query?: Record<string, string> },
): Promise<Response> {
  assertEnv();
  const q = init?.query;
  const qs =
    q && Object.keys(q).length > 0
      ? "?" + new URLSearchParams(q).toString()
      : "";
  return fetch(`${functionsBase()}/${name}${qs}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: key!,
      Authorization: `Bearer ${key}`,
      ...init?.headers,
    },
  });
}
