// No imports on purpose: wake-server.test.mjs runs it with node --test, without React Native.

export type WakeResult = 'ok' | 'unreachable';

export type WakeOptions = {
  /** The API's origin, without /v1. */
  baseUrl: string;
  /** Gives up after this long. Render's free plan takes about 50 s to wake up. */
  timeoutMs?: number;
  /** Calls onSlow if the server hasn't answered by then. */
  slowAfterMs?: number;
  /** Pause before asking again after a 502, 503 or 504. */
  retryEveryMs?: number;
  onSlow?: () => void;
  fetch?: typeof fetch;
};

/**
 * Wakes up the API of the public demo (docs/plan-v0.6.md, etapa Demo pública): Render puts the
 * free plan to sleep and answers 502, 503 or 504 while it wakes. Asks GET /v1/health with its
 * own deadline, apart from the 15 s of customFetch, which would fail the first request.
 *
 * Any status below 502 means the server is up, even a 401. A 502, 503 or 504 is asked again
 * every few seconds until the deadline: the proxy of Render and our API (Redis down) answer
 * the same, so a lasting 503 ends as unreachable. A network error is unreachable right away.
 */
export async function wakeServer({
  baseUrl,
  timeoutMs = 90_000,
  slowAfterMs = 2_000,
  retryEveryMs = 3_000,
  onSlow,
  fetch: doFetch = fetch,
}: WakeOptions): Promise<WakeResult> {
  const deadline = AbortSignal.timeout(timeoutMs);
  const slowTimer = setTimeout(() => onSlow?.(), slowAfterMs);
  try {
    while (!deadline.aborted) {
      const response = await doFetch(`${baseUrl.replace(/\/+$/, '')}/v1/health`, {
        signal: deadline,
      });
      if (response.status < 502) return 'ok';
      await pause(retryEveryMs, deadline);
    }
    return 'unreachable';
  } catch {
    return 'unreachable';
  } finally {
    clearTimeout(slowTimer);
  }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
  });
}
