/**
 * Meta Conversions API (CAPI) — server-side Purchase events.
 *
 * Complementa o Pixel client-side enviando o mesmo evento via servidor,
 * recuperando ~20-40% de conversões perdidas (iOS, bloqueadores, ITP).
 *
 * Configurar via secrets:
 *   META_CAPI_ACCESS_TOKEN  (obrigatório — System User token do Events Manager)
 *   META_PIXEL_ID           (opcional — default 1014878304387575)
 *   META_CAPI_TEST_CODE     (opcional — para validar no Test Events tab)
 */

const PIXEL_ID = Deno.env.get("META_PIXEL_ID") ?? "1014878304387575";
const ACCESS_TOKEN = Deno.env.get("META_CAPI_ACCESS_TOKEN") ?? "";
const TEST_CODE = Deno.env.get("META_CAPI_TEST_CODE") ?? "";

export type CapiPurchaseInput = {
  eventId: string;                 // dedupe com Pixel client-side
  eventSourceUrl?: string | null;
  valueBrl: number;                // em reais
  currency?: string;               // default BRL
  email?: string | null;
  phone?: string | null;           // E.164 ou dígitos
  firstName?: string | null;
  externalId?: string | null;      // ex.: diagnosis_id
  contentName?: string;            // ex.: "Diagnóstico Meta Ads"
  clientIp?: string | null;
  userAgent?: string | null;
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const normEmail = (v: string) => v.trim().toLowerCase();
const normPhone = (v: string) => v.replace(/\D+/g, "");
const normName = (v: string) => v.trim().toLowerCase();

export async function sendMetaPurchase(input: CapiPurchaseInput): Promise<{ ok: boolean; error?: string }> {
  if (!ACCESS_TOKEN) return { ok: false, error: "META_CAPI_ACCESS_TOKEN not configured" };

  const userData: Record<string, unknown> = {};
  if (input.email) userData.em = [await sha256Hex(normEmail(input.email))];
  if (input.phone) userData.ph = [await sha256Hex(normPhone(input.phone))];
  if (input.firstName) userData.fn = [await sha256Hex(normName(input.firstName))];
  if (input.externalId) userData.external_id = [await sha256Hex(input.externalId)];
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;

  const event = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: "website",
    event_source_url: input.eventSourceUrl ?? undefined,
    user_data: userData,
    custom_data: {
      currency: input.currency ?? "BRL",
      value: Number(input.valueBrl.toFixed(2)),
      content_name: input.contentName,
    },
  };

  const body: Record<string, unknown> = { data: [event] };
  if (TEST_CODE) body.test_event_code = TEST_CODE;

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `CAPI ${res.status}: ${txt.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 300) };
  }
}
