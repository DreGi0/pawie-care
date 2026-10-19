// Runs with `pnpm test` (node --test). Node strips the types of format.ts by itself.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  atLocalTime,
  dayLabel,
  formatDay,
  formatDeadline,
  formatLongDayTime,
  formatMoney,
  formatRange,
  localDate,
  maskDate,
  parseDate,
  maskPhone,
  parsePhone,
  upcomingDays,
} from './format.ts';

test('shows dates in San Salvador time', () => {
  // 02:30 UTC on the 20th is still the 19th at 20:30 in San Salvador.
  assert.equal(localDate('2026-10-20T02:30:00Z'), '2026-10-19');
  assert.equal(formatDay('2026-10-20T02:30:00Z'), 'Lun 19 oct');
  assert.equal(
    formatRange('2026-10-19T15:00:00Z', '2026-10-19T16:00:00Z'),
    'Lun 19 oct · 9:00–10:00',
  );
  assert.equal(formatLongDayTime('2026-10-19T15:00:00Z'), 'el lunes 19 de octubre a las 9:00');
});

test('builds moments in San Salvador time', () => {
  assert.equal(atLocalTime('2026-10-19', 9 * 60 + 30), '2026-10-19T09:30:00-06:00');
  assert.equal(
    new Date(atLocalTime('2026-10-19', 9 * 60)).toISOString(),
    '2026-10-19T15:00:00.000Z',
  );
});

test('lists the next days', () => {
  const now = new Date('2026-10-20T03:00:00Z'); // Mon 19 at 21:00 in San Salvador
  assert.deepEqual(upcomingDays(3, now), ['2026-10-19', '2026-10-20', '2026-10-21']);
  assert.equal(dayLabel('2026-10-19', now), 'Hoy');
  assert.equal(dayLabel('2026-10-20', now), 'Mañana');
  assert.equal(dayLabel('2026-10-21', now), 'Mié 21');
  assert.equal(formatDeadline('2026-10-20T03:30:00Z', now), 'antes de las 21:30');
  assert.equal(formatDeadline('2026-10-20T15:00:00Z', now), 'antes del Mar 20 oct, 9:00');
});

test('reads typed dates', () => {
  assert.equal(maskDate('12032023'), '12/03/2023');
  assert.equal(maskDate('12/0'), '12/0');
  assert.equal(parseDate('12/03/2023'), '2023-03-12');
  assert.equal(parseDate('31/02/2023'), null);
  assert.equal(parseDate('1/3/2023'), null);
});

test('formats money', () => {
  assert.equal(formatMoney(1320), '$13.20');
  assert.equal(formatMoney(1200), '$12.00');
  assert.equal(formatMoney(1200, { short: true }), '$12');
  assert.equal(formatMoney(1250, { short: true }), '$12.50');
});

test('reads typed phones', () => {
  assert.equal(maskPhone('70001234'), '7000 1234');
  assert.equal(maskPhone('700'), '700');
  assert.equal(parsePhone('7000 1234'), '+50370001234');
  assert.equal(parsePhone('1000 1234'), null);
  assert.equal(parsePhone('7000 123'), null);
});
