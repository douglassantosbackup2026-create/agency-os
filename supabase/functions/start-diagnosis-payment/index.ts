import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";

function priceCents(): number {
  return parseInt(Deno.env.get("DIAGNOSIS_PRICE_CENTS") ?? "3700", 10);
}

function digits(s: string): string {
  return s.replace(/\D+/g, "");
}

function validateCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (slice: number): number => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(cpf[i]) * (slice + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(cpf[9]) && calc(10) === parseInt(cpf[10]);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const ip = publicClientIp(req);
  const sbRl = diagnosisServiceClient();
  if (await publicRateLimitExceeded(sbRl, `diagnosis-start:${ip}`)) {
    return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429);
  }

  const publicKey = Deno.env.get("MERCADOPAGO_PUBLIC_KEY");
  if (!publicKey) {
    return jsonResponse(
      { error: "MERCADOPAGO_PUBLIC_KEY não configurado" },
      500,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const payerRaw = (body.payer ?? {}) as Record<string, unknown>;
  const name = String(payerRaw.name ?? "").trim();
  const email = String(payerRaw.email ?? "").trim().toLowerCase();
  const cpf = digits(String(payerRaw.cpf ?? ""));
  const phone = digits(String(payerRaw.phone ?? ""));

  const errors: string[] = [];
  if (name.length < 2 || name.length > 100) errors.push("nome inválido");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160)
    errors.push("e-mail inválido");
  if (!validateCpf(cpf)) errors.push("CPF inválido");
  if (phone.length < 10 || phone.length > 13) errors.push("telefone inválido");

  if (errors.length > 0) {
    return jsonResponse({ error: errors.join(", ") }, 400);
  }

  const sb = diagnosisServiceClient();
  const { data: row, error: insErr } = await sb
    .from("diagnoses")
    .insert({
      status: "awaiting_payment",
      amount_cents: priceCents(),
      currency: "BRL",
      payer_name: name,
      payer_email: email,
      payer_cpf: cpf,
      payer_phone: phone,
    })
    .select("id, secret_slug, amount_cents")
    .single();

  if (insErr || !row) {
    console.error(insErr);
    return jsonResponse({ error: "Falha ao criar diagnóstico" }, 500);
  }

  return jsonResponse({
    diagnosis_id: row.id,
    secret_slug: row.secret_slug,
    amount_cents: row.amount_cents,
    mp_public_key: publicKey,
  });
});
