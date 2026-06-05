import { useCallback, useEffect, useRef, useState } from "react";

export type DiagnosisPollTickResult = "continue" | "stop";

export type UseDiagnosisPollOptions = {
  enabled: boolean;
  intervalMs?: number;
  maxConsecutiveErrors?: number;
  maxDurationMs?: number;
  onTick: () => Promise<DiagnosisPollTickResult>;
};

export type UseDiagnosisPollResult = {
  pollError: string | null;
  consecutiveErrors: number;
  isPolling: boolean;
  retryNow: () => void;
};

const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_MAX_ERRORS = 3;
const BACKOFF_CAP_MS = 15000;

function backoffInterval(baseMs: number, consecutiveErrors: number): number {
  if (consecutiveErrors <= 0) return baseMs;
  const factor = Math.min(consecutiveErrors, 4);
  return Math.min(baseMs + factor * 1000, BACKOFF_CAP_MS);
}

export function useDiagnosisPoll({
  enabled,
  intervalMs = DEFAULT_INTERVAL_MS,
  maxConsecutiveErrors = DEFAULT_MAX_ERRORS,
  maxDurationMs,
  onTick,
}: UseDiagnosisPollOptions): UseDiagnosisPollResult {
  const [pollError, setPollError] = useState<string | null>(null);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [tickNonce, setTickNonce] = useState(0);

  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  const retryNow = useCallback(() => {
    setPollError(null);
    setConsecutiveErrors(0);
    setTickNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsPolling(false);
      return;
    }

    let alive = true;
    let timeoutId = 0;
    const startedAt = Date.now();
    let errors = 0;

    const schedule = (delayMs: number) => {
      if (!alive) return;
      timeoutId = window.setTimeout(() => void runTick(), delayMs);
    };

    const runTick = async () => {
      if (!alive) return;
      if (maxDurationMs != null && Date.now() - startedAt > maxDurationMs) {
        setIsPolling(false);
        return;
      }

      setIsPolling(true);
      try {
        const result = await onTickRef.current();
        if (!alive) return;
        errors = 0;
        setConsecutiveErrors(0);
        setPollError(null);
        if (result === "stop") {
          setIsPolling(false);
          return;
        }
        schedule(backoffInterval(intervalMs, 0));
      } catch (e) {
        if (!alive) return;
        errors += 1;
        setConsecutiveErrors(errors);
        const message =
          e instanceof Error
            ? e.message
            : "Não foi possível atualizar o estado.";
        if (errors >= maxConsecutiveErrors) {
          setPollError(message);
        }
        schedule(backoffInterval(intervalMs, errors));
      }
    };

    void runTick();

    return () => {
      alive = false;
      if (timeoutId) window.clearTimeout(timeoutId);
      setIsPolling(false);
    };
  }, [
    enabled,
    intervalMs,
    maxConsecutiveErrors,
    maxDurationMs,
    tickNonce,
  ]);

  return { pollError, consecutiveErrors, isPolling, retryNow };
}
