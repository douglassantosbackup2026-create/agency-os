import type { PostgrestError } from "@supabase/supabase-js";

/** Falha a query do React Query se o PostgREST devolver `error` (evita mascarar falhas como listas vazias). */
export function throwIfSupabaseError(
  error: PostgrestError | null,
  context?: string,
): asserts error is null {
  if (!error) return;
  const msg = context ? `${context}: ${error.message}` : error.message;
  throw new Error(msg);
}
