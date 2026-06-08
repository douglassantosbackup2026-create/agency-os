function allowedDiagnosisOrigins(): string[] {
  const list: string[] = [];
  const pub = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/+$/, "");
  if (pub) list.push(pub);
  const site = Deno.env.get("SITE_URL")?.replace(/\/+$/, "");
  if (site) list.push(site);
  const extra = Deno.env.get("APP_ALLOWED_ORIGINS");
  if (extra) {
    for (const o of extra.split(",")) {
      const t = o.trim().replace(/\/+$/, "");
      if (t) list.push(t);
    }
  }
  return list;
}

export function diagnosisCorsHeaders(req: Request): Record<string, string> {
  const list = allowedDiagnosisOrigins();
  const origin = req.headers.get("origin")?.replace(/\/+$/, "") ?? "";
  const allow =
    list.length === 0 ? "*" : list.includes(origin) ? origin : list[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-cron-secret",
    Vary: "Origin",
  };
}

/** @deprecated use diagnosisCorsHeaders(req) — kept for static imports during migration */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

export function jsonResponse(
  body: unknown,
  status = 200,
  req?: Request,
): Response {
  const headers = req ? diagnosisCorsHeaders(req) : corsHeaders;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: diagnosisCorsHeaders(req) });
  }
  return null;
}
