const enc = new TextEncoder();

export async function hmacSign(
  message: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signOAuthState(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const json = JSON.stringify(payload);
  const b64 = btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sig = await hmacSign(b64, secret);
  return `${b64}.${sig}`;
}

export async function verifyOAuthState(
  state: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const i = state.lastIndexOf(".");
  if (i < 0) return null;
  const b64 = state.slice(0, i);
  const sig = state.slice(i + 1);
  const expect = await hmacSign(b64, secret);
  if (sig !== expect) return null;
  const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as Record<string, unknown>;
}
