// Runs with `pnpm test` (node --test). Real timers with tiny times: mock.timers doesn't cover
// AbortSignal.timeout.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { wakeServer } from './wake-server.ts';

const fast = { baseUrl: 'https://api.test/', slowAfterMs: 10, timeoutMs: 100, retryEveryMs: 5 };

/** A fetch that answers with `statuses` in order, each after `delayMs`. */
function fakeFetch(statuses, delayMs = 0) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push(url);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    if (status === 'network-error') throw new TypeError('fetch failed');
    return new Response(null, { status });
  };
  fn.calls = calls;
  return fn;
}

test('wakeServer: a fast server is ok and never shows the waking text', async () => {
  let slow = 0;
  const fetch = fakeFetch([200]);

  const result = await wakeServer({ ...fast, fetch, onSlow: () => slow++ });

  assert.equal(result, 'ok');
  assert.equal(slow, 0);
  assert.deepEqual(fetch.calls, ['https://api.test/v1/health']);
});

test('wakeServer: a slow server calls onSlow once and then is ok', async () => {
  let slow = 0;
  const fetch = fakeFetch([200], 40);

  const result = await wakeServer({ ...fast, fetch, onSlow: () => slow++ });

  assert.equal(result, 'ok');
  assert.equal(slow, 1);
});

test('wakeServer: a 502 and then a 200 is ok', async () => {
  const fetch = fakeFetch([502, 200]);

  assert.equal(await wakeServer({ ...fast, fetch }), 'ok');
  assert.equal(fetch.calls.length, 2);
});

test('wakeServer: a status below 502 counts as awake, even a 401', async () => {
  assert.equal(await wakeServer({ ...fast, fetch: fakeFetch([401]) }), 'ok');
});

test('wakeServer: a lasting 503 ends as unreachable at the deadline', async () => {
  const fetch = fakeFetch([503]);

  assert.equal(await wakeServer({ ...fast, fetch }), 'unreachable');
  assert.ok(fetch.calls.length > 1);
});

test('wakeServer: a request that never answers ends as unreachable at the deadline', async () => {
  const fetch = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    });

  assert.equal(await wakeServer({ ...fast, fetch }), 'unreachable');
});

test('wakeServer: a network error is unreachable right away', async () => {
  const fetch = fakeFetch(['network-error']);

  assert.equal(await wakeServer({ ...fast, timeoutMs: 1000, fetch }), 'unreachable');
  assert.equal(fetch.calls.length, 1);
});
