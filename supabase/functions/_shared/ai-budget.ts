import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export async function aiBudgetExceeded(
  admin: SupabaseClient,
  agencyId: string,
  estimatedTokens = 8000,
): Promise<boolean> {
  const { data, error } = await admin.rpc("check_ai_budget", {
    p_agency_id: agencyId,
    p_estimated_tokens: estimatedTokens,
  });
  if (error) {
    console.warn("check_ai_budget", error.message);
    return false;
  }
  return data === true;
}

export async function diagnosisAiBudgetExceeded(
  admin: SupabaseClient,
  estimatedTokens = 15000,
): Promise<boolean> {
  const { data, error } = await admin.rpc("check_diagnosis_ai_budget", {
    p_estimated_tokens: estimatedTokens,
  });
  if (error) {
    console.warn("check_diagnosis_ai_budget", error.message);
    return false;
  }
  return data === true;
}
