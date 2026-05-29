import { useCallback, useEffect, useRef } from "react";

/**
 * Retorna callback estável que executa fn após `delayMs` sem novas chamadas.
 */
export function useDebouncedCallback<T extends (...args: never[]) => void>(
  fn: T,
  delayMs = 3000,
): T {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fnRef.current(...args);
      }, delayMs);
    }) as T,
    [delayMs],
  );
}
