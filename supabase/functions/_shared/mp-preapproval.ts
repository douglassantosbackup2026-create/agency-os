/**
 * Helpers para Preapproval (assinaturas) do Mercado Pago.
 * https://www.mercadopago.com.br/developers/pt/reference/subscriptions/_preapproval/post
 */

export type MpPreapprovalResponse = {
  id?: string;
  status?: string;
  next_payment_date?: string;
  payer_email?: string;
  payer_id?: number | string;
  auto_recurring?: {
    transaction_amount?: number;
    frequency?: number;
    frequency_type?: string;
    currency_id?: string;
  };
  card_id?: string | number;
  message?: string;
};

export type MpAuthorizedPaymentResponse = {
  id?: number | string;
  preapproval_id?: string;
  status?: string;
  transaction_amount?: number;
  currency_id?: string;
  payment_method_id?: string;
  payment?: { id?: number | string; status?: string };
  debit_date?: string;
  date_created?: string;
};

export type MpPreapprovalInput = {
  reason: string;
  externalReference: string;
  payerEmail: string;
  cardTokenId: string;
  amount: number;
  notificationUrl: string;
  backUrl: string;
  frequency?: number;
  frequencyType?: "months" | "days";
  currency?: string;
};

export async function createMpPreapproval(
  input: MpPreapprovalInput,
): Promise<{ ok: true; json: MpPreapprovalResponse } | { ok: false; res: Response; json: MpPreapprovalResponse }> {
  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) throw new Error("MP token ausente");

  const payload = {
    reason: input.reason,
    external_reference: input.externalReference,
    payer_email: input.payerEmail,
    card_token_id: input.cardTokenId,
    back_url: input.backUrl,
    notification_url: input.notificationUrl,
    status: "authorized" as const,
    auto_recurring: {
      frequency: input.frequency ?? 1,
      frequency_type: input.frequencyType ?? "months",
      transaction_amount: input.amount,
      currency_id: input.currency ?? "BRL",
    },
  };

  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `preapproval:${input.externalReference}`,
    },
    body: JSON.stringify(payload),
  });

  const json = (await res.json()) as MpPreapprovalResponse;
  if (!res.ok) return { ok: false, res, json };
  return { ok: true, json };
}

export async function fetchMpPreapproval(
  preapprovalId: string,
): Promise<MpPreapprovalResponse | null> {
  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) return null;
  const res = await fetch(
    `https://api.mercadopago.com/preapproval/${preapprovalId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  return (await res.json()) as MpPreapprovalResponse;
}

export async function fetchMpAuthorizedPayment(
  authorizedPaymentId: string,
): Promise<MpAuthorizedPaymentResponse | null> {
  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) return null;
  const res = await fetch(
    `https://api.mercadopago.com/authorized_payments/${authorizedPaymentId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  return (await res.json()) as MpAuthorizedPaymentResponse;
}

export async function cancelMpPreapproval(
  preapprovalId: string,
): Promise<{ ok: true; json: MpPreapprovalResponse } | { ok: false; status: number; json: MpPreapprovalResponse }> {
  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) throw new Error("MP token ausente");
  const res = await fetch(
    `https://api.mercadopago.com/preapproval/${preapprovalId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as MpPreapprovalResponse;
  if (!res.ok) return { ok: false, status: res.status, json };
  return { ok: true, json };
}
