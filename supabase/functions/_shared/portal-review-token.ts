/** Token de revisão de criativos no portal (HMAC, sem guardar plaintext no DB). */

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function b64url(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signPortalReviewToken(
  clientId: string,
  portalSlug: string,
  expMs: number,
  secret: string,
): Promise<string> {
  const payload = `${clientId}|${portalSlug}|${expMs}`;
  const sig = await hmacSha256Hex(payload, secret);
  const body = `${b64url(new TextEncoder().encode(payload))}.${sig.slice(0, 32)}`;
  return body;
}

export async function verifyPortalReviewToken(
  token: string,
  clientId: string,
  portalSlug: string,
  secret: string,
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [b64, sigFrag] = parts;
  let payload: string;
  try {
    const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
    payload = new TextDecoder().decode(
      Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)),
    );
  } catch {
    return false;
  }
  const segments = payload.split("|");
  if (segments.length !== 3) return false;
  const [cid, slug, expStr] = segments;
  if (cid !== clientId || slug !== portalSlug) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expect = await hmacSha256Hex(payload, secret);
  return expect.startsWith(sigFrag) && sigFrag.length >= 16;
}

export function portalReviewSecret(): string | null {
  const s = Deno.env.get("PORTAL_REVIEW_TOKEN_SECRET")?.trim();
  return s && s.length >= 16 ? s : null;
}
