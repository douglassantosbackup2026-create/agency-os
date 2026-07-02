import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type LeadSlotSnapshot = {
  cap: number;
  used: number;
  available: number;
  waitlist_display: number;
};

export type MarkLeadPaidResult =
  | { ok: true; reason: "claimed" | "already_paid" }
  | {
      ok: false;
      reason: "not_found" | "invalid_status" | "slots_full" | "update_failed";
      used?: number;
      cap?: number;
    };

export const LEAD_SLOTS_FULL_MESSAGE =
  "Vagas esgotadas para este mês. Entre em contato pelo WhatsApp.";

export function leadMonthlySlotCap(): number {
  const n = parseInt(Deno.env.get("LEAD_MONTHLY_SLOT_CAP") ?? "3", 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

export function leadWaitlistBase(): number {
  const n = parseInt(Deno.env.get("LEAD_WAITLIST_BASE_COUNT") ?? "28", 10);
  return Number.isFinite(n) && n >= 0 ? n : 28;
}

export function computeWaitlistDisplay(base: number, pendingCount: number): number {
  return base + Math.max(0, pendingCount);
}

export function computeAvailableSlots(cap: number, used: number): number {
  return Math.max(0, cap - used);
}

function parseSnapshot(
  raw: unknown,
  waitlistDisplay: number,
): LeadSlotSnapshot {
  const j = raw as { cap?: number; used?: number; available?: number } | null;
  const cap = leadMonthlySlotCap();
  const used = Number(j?.used ?? 0);
  const available =
    j?.available != null
      ? Number(j.available)
      : computeAvailableSlots(cap, used);
  return {
    cap: Number(j?.cap ?? cap),
    used: Number.isFinite(used) ? used : 0,
    available: Number.isFinite(available) ? available : computeAvailableSlots(cap, used),
    waitlist_display: waitlistDisplay,
  };
}

function parseMarkResult(raw: unknown): MarkLeadPaidResult {
  const j = raw as {
    ok?: boolean;
    reason?: string;
    used?: number;
    cap?: number;
  } | null;
  if (j?.ok === true) {
    return {
      ok: true,
      reason: j.reason === "already_paid" ? "already_paid" : "claimed",
    };
  }
  const reason = j?.reason ?? "update_failed";
  if (reason === "slots_full") {
    return {
      ok: false,
      reason: "slots_full",
      used: j?.used,
      cap: j?.cap,
    };
  }
  if (reason === "not_found") {
    return { ok: false, reason: "not_found" };
  }
  if (reason === "invalid_status") {
    return { ok: false, reason: "invalid_status" };
  }
  return { ok: false, reason: "update_failed" };
}

export async function countLeadWaitlistThisMonth(
  sb: SupabaseClient,
): Promise<number> {
  const { data: monthStart, error: monthErr } = await sb.rpc(
    "lead_month_start_sao_paulo",
  );
  if (monthErr || !monthStart) {
    console.error("countLeadWaitlistThisMonth month start failed", monthErr);
    return 0;
  }

  const { count, error } = await sb
    .from("ecommerce_leads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", monthStart as string)
    .in("status", ["new", "awaiting_payment"]);

  if (error) {
    console.error("countLeadWaitlistThisMonth failed", error);
    return 0;
  }

  return count ?? 0;
}

export async function getLeadSlotSnapshot(
  sb: SupabaseClient,
): Promise<LeadSlotSnapshot> {
  const cap = leadMonthlySlotCap();
  const base = leadWaitlistBase();
  const pending = await countLeadWaitlistThisMonth(sb);
  const waitlistDisplay = computeWaitlistDisplay(base, pending);

  const { data, error } = await sb.rpc("get_ecommerce_lead_slot_snapshot", {
    p_cap: cap,
  });
  if (error) {
    console.error("getLeadSlotSnapshot failed", error);
    return { cap, used: 0, available: cap, waitlist_display: waitlistDisplay };
  }
  return parseSnapshot(data, waitlistDisplay);
}

export async function assertLeadSlotAvailable(
  sb: SupabaseClient,
  leadId: string,
): Promise<{ ok: true } | { ok: false; reason: "slots_full" | "not_found" }> {
  const { data: lead, error } = await sb
    .from("ecommerce_leads")
    .select("id, status")
    .eq("id", leadId)
    .maybeSingle();

  if (error || !lead) {
    return { ok: false, reason: "not_found" };
  }

  if ((lead.status as string) === "paid") {
    return { ok: true };
  }

  const snap = await getLeadSlotSnapshot(sb);
  if (snap.available <= 0) {
    return { ok: false, reason: "slots_full" };
  }

  return { ok: true };
}

export async function markLeadPaidIfSlotAvailable(
  sb: SupabaseClient,
  leadId: string,
  extra: Record<string, string | null | undefined> = {},
): Promise<MarkLeadPaidResult> {
  const cap = leadMonthlySlotCap();
  const paidAt = new Date().toISOString();
  const pExtra: Record<string, string> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (v != null && v !== "") pExtra[k] = v;
  }

  const { data, error } = await sb.rpc("try_mark_ecommerce_lead_paid", {
    p_lead_id: leadId,
    p_cap: cap,
    p_paid_at: paidAt,
    p_extra: pExtra,
  });

  if (error) {
    console.error("markLeadPaidIfSlotAvailable rpc failed", error);
    return { ok: false, reason: "update_failed" };
  }

  return parseMarkResult(data);
}
