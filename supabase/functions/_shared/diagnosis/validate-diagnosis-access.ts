import { diagnosisServiceClient } from "./service.ts";

export async function assertDiagnosisSecret(
  diagnosisId: string,
  secretSlug: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(diagnosisId)) {
    return { ok: false, status: 400, message: "id inválido" };
  }
  if (!/^[0-9a-f]{32}$/i.test(secretSlug)) {
    return { ok: false, status: 400, message: "secret inválido" };
  }
  const sb = diagnosisServiceClient();
  const { data, error } = await sb
    .from("diagnoses")
    .select("id")
    .eq("id", diagnosisId)
    .eq("secret_slug", secretSlug)
    .maybeSingle();
  if (error) {
    console.error(error);
    return { ok: false, status: 500, message: "erro interno" };
  }
  if (!data) return { ok: false, status: 404, message: "não encontrado" };
  return { ok: true };
}
