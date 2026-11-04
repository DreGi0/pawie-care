// Runs with `pnpm test` (node --test). Node strips the types of format.ts by itself.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  atLocalTime,
  dayLabel,
  daysUntil,
  formatDate,
  formatDateSpan,
  formatDay,
  formatDeadline,
  formatLongDay,
  formatLongDayTime,
  formatMinute,
  formatMoney,
  formatPhone,
  formatRange,
  localDate,
  maskDate,
  maskTime,
  parseDate,
  parseTime,
  maskPhone,
  parsePhone,
  toDateInput,
  toTimeInput,
  upcomingDays,
} from './format.ts';

test('shows dates in San Salvador time', () => {
  // 02:30 UTC on the 20th is still the 19th at 20:30 in San Salvador.
  assert.equal(localDate('2026-10-20T02:30:00Z'), '2026-10-19');
  assert.equal(formatDay('2026-10-20T02:30:00Z'), 'Lun 19 oct');
  assert.equal(
    formatRange('2026-10-19T15:00:00Z', '2026-10-19T16:00:00Z'),
    'Lun 19 oct, de 9:00 a 10:00',
  );
  assert.equal(formatLongDayTime('2026-10-19T15:00:00Z'), 'el lunes 19 de octubre a las 9:00');
  assert.equal(formatLongDay('2026-11-03T03:00:00Z'), 'Lunes 2 de noviembre');
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

test('counts the days that are left, rounding up', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  assert.equal(daysUntil('2026-11-03T12:00:00Z', now), 15);
  assert.equal(daysUntil('2026-10-20T00:00:00Z', now), 1);
  assert.equal(daysUntil('2026-10-19T11:00:00Z', now), 0);
});

test('shows days without a time, and spans of them', () => {
  assert.equal(formatDate('2026-11-03'), '3 nov 2026');
  assert.equal(formatDateSpan('2026-11-03', '2026-11-12'), 'del 3 al 12 nov 2026');
  assert.equal(formatDateSpan('2026-10-28', '2026-11-03'), 'del 28 oct al 3 nov 2026');
  assert.equal(formatDateSpan('2026-12-28', '2027-01-03'), 'del 28 dic 2026 al 3 ene 2027');
  assert.equal(formatDateSpan('2026-11-03', null), 'desde el 3 nov 2026');
  assert.equal(toDateInput('2023-03-12'), '12/03/2023');
  assert.equal(parseDate(toDateInput('2023-03-12')), '2023-03-12');
});

test('reads and writes times of day in minutes since midnight', () => {
  assert.equal(formatMinute(420), '7:00');
  assert.equal(formatMinute(1095), '18:15');
  assert.equal(maskTime('0730'), '07:30');
  assert.equal(maskTime('7'), '7');
  assert.equal(parseTime('07:30'), 450);
  assert.equal(parseTime('7:30'), 450);
  assert.equal(parseTime('23:59'), 1439);
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('7:3'), null);
  assert.equal(toTimeInput(450), '07:30');
  assert.equal(parseTime(toTimeInput(1080)), 1080);
});

test('shows Salvadoran phones in groups of four', () => {
  assert.equal(formatPhone('+50322220000'), '+503 2222 0000');
  assert.equal(formatPhone('+503 2222 0000'), '+503 2222 0000');
  assert.equal(formatPhone('+15551234567'), '+15551234567');
});
