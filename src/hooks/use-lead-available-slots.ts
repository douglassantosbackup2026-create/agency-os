import { useCallback, useEffect, useState } from "react";
import { callDiagnosisApi } from "@/lib/diagnosis-api";
import {
  computeAvailableSlots,
  LEAD_FUNNEL_MONTHLY_CAP,
  LEAD_WAITLIST_BASE,
  type LeadSlotsSnapshot,
} from "@/content/gestao-lead-slots";

const DEFAULT_SNAPSHOT: LeadSlotsSnapshot = {
  cap: LEAD_FUNNEL_MONTHLY_CAP,
  used: 0,
  available: LEAD_FUNNEL_MONTHLY_CAP,
  waitlist_display: LEAD_WAITLIST_BASE,
};

function normalizeSnapshot(raw: Partial<LeadSlotsSnapshot> | null | undefined): LeadSlotsSnapshot {
  const cap = Number(raw?.cap ?? LEAD_FUNNEL_MONTHLY_CAP);
  const used = Number.isFinite(Number(raw?.used)) ? Number(raw?.used) : 0;
  const available =
    raw?.available != null && Number.isFinite(Number(raw.available))
      ? Number(raw.available)
      : computeAvailableSlots(cap, used);
  const waitlistDisplay =
    raw?.waitlist_display != null && Number.isFinite(Number(raw.waitlist_display))
      ? Number(raw.waitlist_display)
      : LEAD_WAITLIST_BASE;
  return { cap, used, available, waitlist_display: waitlistDisplay };
}

export function useLeadAvailableSlots(enabled = true) {
  const [slots, setSlots] = useState<LeadSlotsSnapshot>(DEFAULT_SNAPSHOT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const data = await callDiagnosisApi<LeadSlotsSnapshot>("lead-available-slots", {
        signal: controller.signal,
      });
      setSlots(normalizeSnapshot(data));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar vagas");
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refetch();
  }, [enabled, refetch]);

  return { slots, loading, error, refetch };
}

export function applyLeadSlotsFromStatus(
  current: LeadSlotsSnapshot,
  statusSlots?: Partial<LeadSlotsSnapshot> | null,
): LeadSlotsSnapshot {
  if (!statusSlots) return current;
  return normalizeSnapshot(statusSlots);
}
