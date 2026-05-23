// Shared helper used by mercadopago-webhook and process-diagnosis-payment
// to create (or link) a Supabase Auth account for the diagnosis buyer
// right after payment is approved, and issue a one-shot magiclink token
// the frontend can consume on /obrigado to log in and set a password.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type DiagnosisRow = {
  id: string;
  payer_email: string | null;
  payer_name: string | null;
  payer_cpf: string | null;
  payer_phone: string | null;
  buyer_user_id: string | null;
};

const TOKEN_TTL_MS = 30 * 60 * 1000;

async function findUserIdByEmail(
  sb: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data } = await sb
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function getPublicSiteUrl(): Promise<string> {
  const explicit = Deno.env.get("PUBLIC_SITE_URL");
  if (explicit) return explicit.replace(/\/+$/, "");
  return "";
}

export async function ensureBuyerAccountAndToken(
  sb: SupabaseClient,
  diagnosis: DiagnosisRow,
): Promise<{ user_id: string | null; auto_login_token: string | null }> {
  if (!diagnosis.payer_email) {
    return { user_id: null, auto_login_token: null };
  }
  const email = diagnosis.payer_email.trim().toLowerCase();

  let userId = diagnosis.buyer_user_id;

  if (!userId) {
    userId = await findUserIdByEmail(sb, email);
  }

  if (!userId) {
    const { data: created, error } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        account_type: "diagnosis_buyer",
        display_name: diagnosis.payer_name ?? undefined,
        phone: diagnosis.payer_phone ?? undefined,
        cpf: diagnosis.payer_cpf ?? undefined,
      },
    });

    if (error || !created?.user) {
      // Race with parallel webhook retry — re-lookup.
      userId = await findUserIdByEmail(sb, email);
      if (!userId) {
        console.error("ensureBuyerAccount: createUser failed", error);
        return { user_id: null, auto_login_token: null };
      }
    } else {
      userId = created.user.id;
    }
  }

  if (diagnosis.buyer_user_id !== userId) {
    const { error: upErr } = await sb
      .from("diagnoses")
      .update({ buyer_user_id: userId })
      .eq("id", diagnosis.id);
    if (upErr) console.error("ensureBuyerAccount: link diagnosis failed", upErr);
  }

  // Issue a magiclink token the client can verify with verifyOtp.
  let tokenHash: string | null = null;
  try {
    const siteUrl = await getPublicSiteUrl();
    const { data: link, error: linkErr } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: siteUrl
        ? { redirectTo: `${siteUrl}/obrigado?d=${diagnosis.id}` }
        : undefined,
    });
    if (linkErr) {
      console.error("ensureBuyerAccount: generateLink failed", linkErr);
    } else {
      tokenHash =
        (link?.properties as { hashed_token?: string } | undefined)
          ?.hashed_token ?? null;
    }
  } catch (e) {
    console.error("ensureBuyerAccount: generateLink threw", e);
  }

  if (tokenHash) {
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    const { error: secErr } = await sb
      .from("diagnosis_secrets")
      .upsert(
        {
          diagnosis_id: diagnosis.id,
          auto_login_token: tokenHash,
          auto_login_expires_at: expiresAt,
        },
        { onConflict: "diagnosis_id" },
      );
    if (secErr) {
      console.error("ensureBuyerAccount: persist token failed", secErr);
      tokenHash = null;
    }
  }

  return { user_id: userId, auto_login_token: tokenHash };
}

export async function fetchBuyerDiagnosis(
  sb: SupabaseClient,
  diagnosisId: string,
): Promise<DiagnosisRow | null> {
  const { data } = await sb
    .from("diagnoses")
    .select(
      "id, payer_email, payer_name, payer_cpf, payer_phone, buyer_user_id",
    )
    .eq("id", diagnosisId)
    .maybeSingle();
  return (data as DiagnosisRow | null) ?? null;
}
