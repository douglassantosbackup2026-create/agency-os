/** Throttle e circuit-breaker para chamadas à Meta Graph API. */

export function metaFetchDelayMs(): number {
  return Math.max(
    0,
    Number(Deno.env.get("META_FETCH_DELAY_MS") ?? "300") || 300,
  );
}

export function metaFetchMaxRetries(): number {
  return Math.max(
    1,
    Number(Deno.env.get("META_FETCH_MAX_RETRIES") ?? "2") || 2,
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isMetaRateLimitError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("request limit reached") ||
    m.includes("application request limit") ||
    m.includes("(#17)") ||
    m.includes("(#4)") ||
    m.includes("(#613)")
  );
}

export class MetaGraphCircuitBreaker {
  private tripped = false;

  isOpen(): boolean {
    return this.tripped;
  }

  recordError(message: string): void {
    if (isMetaRateLimitError(message)) this.tripped = true;
  }

  trip(): void {
    this.tripped = true;
  }
}

export type MetaGraphSession = {
  breaker: MetaGraphCircuitBreaker;
  delayMs: number;
  beforeFetch: () => Promise<void>;
  recordError: (message: string) => void;
  skipOptional: () => boolean;
};

export function createMetaGraphSession(): MetaGraphSession {
  const breaker = new MetaGraphCircuitBreaker();
  const delayMs = metaFetchDelayMs();
  let lastFetchAt = 0;

  return {
    breaker,
    delayMs,
    async beforeFetch() {
      if (breaker.isOpen()) {
        throw new Error("Meta Graph circuit open (rate limit)");
      }
      const now = Date.now();
      const wait = Math.max(0, delayMs - (now - lastFetchAt));
      if (wait > 0) await sleep(wait);
      lastFetchAt = Date.now();
    },
    recordError(message: string) {
      breaker.recordError(message);
    },
    skipOptional() {
      return breaker.isOpen();
    },
  };
}

export async function metaGraphFetchJson<
  T extends { error?: { message: string } },
>(url: URL, session: MetaGraphSession): Promise<T> {
  await session.beforeFetch();
  const r = await fetch(url.toString());
  const j = (await r.json()) as T;
  const msg = j.error?.message;
  if (msg) {
    session.recordError(msg);
    throw new Error(msg);
  }
  return j;
}
