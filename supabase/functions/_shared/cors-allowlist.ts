// Shared CORS helper com allowlist baseada em PUBLIC_SITE_URL +
// extras via APP_ALLOWED_ORIGINS (CSV). Use em funções chamadas a partir
// do app (não webhooks de terceiros, que precisam de `*`).
const ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type";

function allowedOrigins(): string[] {
  const list: string[] = [];
  const pub = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/+$/, "");
  if (pub) list.push(pub);
  const extra = Deno.env.get("APP_ALLOWED_ORIGINS");
  if (extra) {
    for (const o of extra.split(",")) {
      const t = o.trim().replace(/\/+$/, "");
      if (t) list.push(t);
    }
  }
  return list;
}

export function appCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin")?.replace(/\/+$/, "") ?? "";
  const list = allowedOrigins();
  // Se nenhuma allowlist configurada, fallback aberto (compat retro).
  // Configure PUBLIC_SITE_URL para ativar a restrição.
  const allow =
    list.length === 0
      ? "*"
      : origin && list.includes(origin)
        ? origin
        : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    Vary: "Origin",
  };
}

export function appCorsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: appCors(req) });
  }
  return null;
}

export function appJson(
  req: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...appCors(req), "Content-Type": "application/json" },
  });
}
