import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";

type InvokeOpts<B> = {
  body?: B;
  loading?: string;
  success?: string;
  /** Se false, não mostra toast de sucesso (útil quando o caller trata a mensagem). */
  silentSuccess?: boolean;
  /** Sem toasts; só invoca (ex.: signup em background). */
  silent?: boolean;
};

export async function invokeWithToast<B extends Record<string, unknown>>(
  supabase: SupabaseClient,
  functionName: string,
  opts: InvokeOpts<B> = {},
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  if (opts.silent) {
    const { data, error } = await supabase.functions.invoke(functionName, {
      ...(opts.body !== undefined ? { body: opts.body } : {}),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  }
  const tid = opts.loading ? toast.loading(opts.loading) : undefined;
  const { data, error } = await supabase.functions.invoke(functionName, {
    ...(opts.body !== undefined ? { body: opts.body } : {}),
  });
  if (tid !== undefined) toast.dismiss(tid);
  if (error) {
    toast.error(error.message);
    return { ok: false, error: error.message };
  }
  if (!opts.silentSuccess && opts.success) toast.success(opts.success);
  return { ok: true, data };
}
