/** Helpers partilhados para checkout transparente Mercado Pago (diagnóstico + gestão). */

export const MP_CREDENTIAL_MISMATCH_ERROR =
  "As credenciais do Mercado Pago estão em produção, mas os dados usados parecem de teste. Para testar, configure MERCADOPAGO_ACCESS_TOKEN e MERCADOPAGO_PUBLIC_KEY com credenciais TEST-. Para vender de verdade, use dados reais do comprador.";

export type MpPaymentResponse = {
  id?: number | string;
  status?: string;
  status_detail?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
  date_of_expiration?: string;
  message?: string;
};

export type MpPayerInput = {
  name: string;
  email: string;
  cpf: string;
  phone?: string;
};

export type MpCardInput = {
  token: string;
  payment_method_id: string;
  issuer_id?: string;
  installments?: number;
};

export function digits(s: string): string {
  return s.replace(/\D+/g, "");
}

export function validateCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (slice: number): number => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(cpf[i]) * (slice + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(cpf[9]) && calc(10) === parseInt(cpf[10]);
}

export function validatePayerInput(raw: Record<string, unknown>): {
  ok: true;
  payer: MpPayerInput;
} | { ok: false; error: string } {
  const name = String(raw.name ?? "").trim();
  const email = String(raw.email ?? "").trim().toLowerCase();
  const cpf = digits(String(raw.cpf ?? ""));
  const phone = digits(String(raw.phone ?? ""));

  const errors: string[] = [];
  if (name.length < 2 || name.length > 100) errors.push("nome inválido");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    errors.push("e-mail inválido");
  }
  if (!validateCpf(cpf)) errors.push("CPF inválido");
  if (phone.length < 10 || phone.length > 13) errors.push("telefone inválido");

  if (errors.length > 0) return { ok: false, error: errors.join(", ") };
  return { ok: true, payer: { name, email, cpf, phone } };
}

export function splitPayerName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const [firstName, ...rest] = fullName.split(" ");
  const lastName = rest.join(" ") || firstName;
  return { firstName, lastName };
}

export function isLiveCredentialMismatch(
  mpRes: Response,
  mpJson: MpPaymentResponse,
): boolean {
  return (
    mpRes.status === 401 &&
    String(mpJson.message ?? "")
      .toLowerCase()
      .includes("unauthorized use of live credentials")
  );
}

export function buildMpPaymentPayload(opts: {
  amount: number;
  description: string;
  externalReference: string;
  notificationUrl: string;
  payer: MpPayerInput;
  method: "card" | "pix";
  card?: MpCardInput;
  statementDescriptor?: string;
}): Record<string, unknown> {
  const { firstName, lastName } = splitPayerName(opts.payer.name);
  const base: Record<string, unknown> = {
    transaction_amount: opts.amount,
    description: opts.description,
    external_reference: opts.externalReference,
    notification_url: opts.notificationUrl,
    payer: {
      email: opts.payer.email,
      first_name: firstName,
      last_name: lastName,
      identification: { type: "CPF", number: opts.payer.cpf },
    },
  };

  if (opts.method === "card" && opts.card) {
    return {
      ...base,
      token: opts.card.token,
      payment_method_id: opts.card.payment_method_id,
      issuer_id: opts.card.issuer_id,
      installments: opts.card.installments ?? 1,
      statement_descriptor: opts.statementDescriptor ?? "PAGAMENTO",
    };
  }

  const exp = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  return {
    ...base,
    payment_method_id: "pix",
    date_of_expiration: exp.replace("Z", "-03:00"),
  };
}

export async function postMpPayment(
  idempotencyKey: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; json: MpPaymentResponse } | { ok: false; res: Response; json: MpPaymentResponse }> {
  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) throw new Error("MP token ausente");

  const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  const mpJson = (await mpRes.json()) as MpPaymentResponse;
  if (!mpRes.ok) return { ok: false, res: mpRes, json: mpJson };
  return { ok: true, json: mpJson };
}

export function managementPriceCents(): number {
  const n = parseInt(Deno.env.get("MANAGEMENT_PRICE_CENTS") ?? "199700", 10);
  return Number.isFinite(n) && n > 0 ? n : 199700;
}

export function managementItemTitle(): string {
  const t = Deno.env.get("MANAGEMENT_MP_ITEM_TITLE")?.trim();
  return t || "Gestão de tráfego Meta / Google";
}
