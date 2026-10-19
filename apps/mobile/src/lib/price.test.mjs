// Runs with `pnpm test` (node --test).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { estimatePrice } from './price.ts';

test('estimates like the API', () => {
  assert.deepEqual(estimatePrice(1200, 1, 1), {
    slotCents: 1200,
    subtotalCents: 1200,
    serviceFeeCents: 120,
    serviceFeePercent: 10,
    totalCents: 1320,
  });
  // Two pets: +50% per slot. Two nights: twice the slot. The fee rounds half up.
  const twoPets = estimatePrice(1255, 2, 2);
  assert.equal(twoPets.slotCents, 1883); // 1882.5 rounds up
  assert.equal(twoPets.subtotalCents, 3766);
  assert.equal(twoPets.serviceFeeCents, 377); // 376.6
  assert.equal(twoPets.totalCents, 4143);
});
