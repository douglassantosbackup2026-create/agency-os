import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { aiJobPollDone } from "@/lib/resilience-integration-helpers";

const POLL_MS = 3000;
const MAX_ATTEMPTS = 40;

export type AiJobTerminalHandlers = {
  onDone?: (resultRef: string | null) => void;
  onFailed?: (lastError: string | null) => void;
  onTimeout?: () => void;
};

/**
 * Subscreve Realtime em ai_jobs com fallback de polling (3s × 40).
 */
export function useAiJobStatus(
  jobId: string | null | undefined,
  handlers: AiJobTerminalHandlers,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let channel: RealtimeChannel | undefined;

    const finish = (
      status: "done" | "failed" | "timeout",
      row?: { result_ref?: string | null; last_error?: string | null },
    ) => {
      if (cancelled) return;
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (channel) supabase.removeChannel(channel);

      if (status === "done") {
        handlersRef.current.onDone?.(row?.result_ref ?? null);
      } else if (status === "failed") {
        handlersRef.current.onFailed?.(row?.last_error ?? null);
      } else {
        handlersRef.current.onTimeout?.();
      }
    };

    const handleRow = (row: {
      status: string;
      result_ref?: string | null;
      last_error?: string | null;
    }) => {
      const state = aiJobPollDone(row.status);
      if (state === "done") finish("done", row);
      if (state === "failed") finish("failed", row);
    };

    const poll = async () => {
      if (cancelled || attempts >= MAX_ATTEMPTS) {
        if (!cancelled && attempts >= MAX_ATTEMPTS) finish("timeout");
        return;
      }
      attempts += 1;
      const { data: job } = await supabase
        .from("ai_jobs")
        .select("status, result_ref, last_error")
        .eq("id", jobId)
        .maybeSingle();
      if (job) handleRow(job);
      if (!cancelled && attempts < MAX_ATTEMPTS) {
        pollTimer = setTimeout(() => void poll(), POLL_MS);
      } else if (!cancelled && attempts >= MAX_ATTEMPTS) {
        finish("timeout");
      }
    };

    channel = supabase
      .channel(`ai-job:${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ai_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const row = payload.new as {
            status: string;
            result_ref?: string | null;
            last_error?: string | null;
          };
          handleRow(row);
        },
      )
      .subscribe(() => {
        void poll();
      });

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [jobId]);
}
