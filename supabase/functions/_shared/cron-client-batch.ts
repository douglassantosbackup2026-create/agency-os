import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/** Filtra lista de clientes ao lote do cursor intra-agência (evita timeout em agências grandes). */
export async function filterClientsByCronBatch(
  admin: SupabaseClient,
  agencyId: string,
  jobKey: string,
  clients: Array<{ id: string }>,
): Promise<Array<{ id: string }>> {
  const limit = Number(Deno.env.get("CRON_CLIENT_BATCH_SIZE") ?? "0");
  if (!limit || limit <= 0 || !agencyId || !clients.length) {
    return clients;
  }

  const { data: batch, error } = await admin.rpc("get_agency_client_batch", {
    p_agency_id: agencyId,
    p_job_key: jobKey,
    p_limit: Math.max(1, Math.min(100, limit)),
  });
  if (error) {
    console.warn("get_agency_client_batch fallback", error.message);
    return clients;
  }

  const raw = batch as { client_ids?: string[] } | null;
  const allowed = new Set(
    (raw?.client_ids ?? []).map((id) => String(id)),
  );
  if (!allowed.size) return clients;
  return clients.filter((c) => allowed.has(String(c.id)));
}
