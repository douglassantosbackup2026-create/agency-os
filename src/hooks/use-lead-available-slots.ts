import { useCallback, useEffect, useState } from "react";
import { callDiagnosisApi } from "@/lib/diagnosis-api";
import {
  computeAvailableSlots,
  LEAD_FUNNEL_MONTHLY_CAP,
  type LeadSlotsSnapshot,
} from "@/content/gestao-lead-slots";

const DEFAULT_SNAPSHOT: LeadSlotsSnapshot = {
  cap: LEAD_FUNNEL_MONTHLY_CAP,
  used: 0,
  available: LEAD_FUNNEL_MONTHLY_CAP,
};

function normalizeSnapshot(raw: Partial<LeadSlotsSnapshot> | null | undefined): LeadSlotsSnapshot {
  const cap = Number(raw?.cap ?? LEAD_FUNNEL_MONTHLY_CAP);
  const used = Number.isFinite(Number(raw?.used)) ? Number(raw?.used) : 0;
  const available =
    raw?.available != null && Number.isFinite(Number(raw.available))
      ? Number(raw.available)
      : computeAvailableSlots(cap, used);
  return { cap, used, available };
}

export function useLeadAvailableSlots(enabled = true) {
  const [slots, setSlots] = useState<LeadSlotsSnapshot>(DEFAULT_SNAPSHOT);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await callDiagnosisApi<LeadSlotsSnapshot>("lead-available-slots");
      setSlots(normalizeSnapshot(data));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar vagas");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
