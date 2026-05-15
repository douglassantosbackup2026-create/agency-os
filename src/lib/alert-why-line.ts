import type { Database } from "@/integrations/supabase/types";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];

/** Campo único de explicabilidade: DB why_line ou fallback da descrição. */
export function alertWhyLine(
  a: AlertRow & { why_line?: string | null },
): string | null {
  const w = (a as { why_line?: string | null }).why_line;
  if (w?.trim()) return w.trim();
  const desc = a.description?.trim();
  if (desc) {
    const first = desc.split(/(?<=[.!?])\s+/)[0];
    return first.length > 120 ? `${first.slice(0, 117)}…` : first;
  }
  return null;
}
