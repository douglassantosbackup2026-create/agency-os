/** Origem do frontend (sem path). Evita PUBLIC_SITE_URL com /test-meta-oauth duplicado nos redirects. */
export function normalizePublicSiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;
    return new URL(withProto).origin;
  } catch {
    return trimmed
      .replace(/\/+$/, "")
      .replace(/\/test-meta-oauth.*$/i, "");
  }
}

export function metaTestHarnessPageUrl(
  siteRaw: string,
  params?: Record<string, string>,
): string {
  const origin = normalizePublicSiteUrl(siteRaw) || "http://localhost:5173";
  const u = new URL("/test-meta-oauth", origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      u.searchParams.set(key, value);
    }
  }
  return u.toString();
}

export function metaTestHarnessCallbackUrl(siteRaw: string): string {
  const origin = normalizePublicSiteUrl(siteRaw) || "http://localhost:5173";
  return new URL("/test-meta-oauth/callback", origin).toString();
}
