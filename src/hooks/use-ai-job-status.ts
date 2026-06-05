import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { aiJobPollDone } from "@/lib/resilience-integration-helpers";
import { reportPanelError } from "@/lib/report-error";

const POLL_MS = 3000;
const MAX_ATTEMPTS = 40;
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

export type AiJobTerminalHandlers = {
  onDone?: (resultRef: string | null) => void;
  onFailed?: (lastError: string | null) => void;
  onTimeout?: () => void;
  /** Falhas consecutivas ao consultar ai_jobs (rede/RLS). */
  onPollError?: (message: string) => void;
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
    let consecutivePollErrors = 0;
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
      const { data: job, error } = await supabase
        .from("ai_jobs")
        .select("status, result_ref, last_error")
        .eq("id", jobId)
        .maybeSingle();

      if (error) {
        consecutivePollErrors += 1;
        reportPanelError("ai_job_poll", { jobId, error: error.message });
        if (consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          const msg = `Não foi possível acompanhar o job de IA: ${error.message}`;
          handlersRef.current.onPollError?.(msg);
          finish("failed", { last_error: msg });
          return;
        }
      } else {
        consecutivePollErrors = 0;
        if (job) handleRow(job);
      }

      if (cancelled) return;
      if (attempts < MAX_ATTEMPTS) {
        const backoff =
          consecutivePollErrors > 0
            ? POLL_MS + consecutivePollErrors * 1000
            : POLL_MS;
        pollTimer = setTimeout(() => void poll(), backoff);
      } else {
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
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reportPanelError("ai_job_realtime", { jobId, status });
        }
        void poll();
      });

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [jobId]);
}
