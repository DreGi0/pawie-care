import { addDays, addMonths, ageOn, dateInElSalvador, isoInElSalvador } from './calendar.js';

const date = (value: string) => new Date(`${value}T00:00:00Z`);

describe('calendar', () => {
  describe('dateInElSalvador', () => {
    it('is still the previous day in El Salvador until 06:00 UTC', () => {
      expect(dateInElSalvador(new Date('2026-10-18T05:59:59Z'))).toEqual(date('2026-10-17'));
      expect(dateInElSalvador(new Date('2026-10-18T06:00:00Z'))).toEqual(date('2026-10-18'));
    });
  });

  describe('isoInElSalvador', () => {
    it('writes the instant in El Salvador time, dropping the milliseconds', () => {
      expect(isoInElSalvador(new Date('2026-10-18T05:30:59.999Z'))).toBe(
        '2026-10-17T23:30:59-06:00',
      );
      expect(new Date(isoInElSalvador(new Date('2026-10-18T21:00:00Z')))).toEqual(
        new Date('2026-10-18T21:00:00Z'),
      );
    });
  });

  describe('addMonths and addDays', () => {
    it('move across months and years', () => {
      expect(addMonths(date('2026-10-17'), 12)).toEqual(date('2027-10-17'));
      expect(addMonths(date('2026-03-15'), -5)).toEqual(date('2025-10-15'));
      expect(addDays(date('2027-01-01'), -1)).toEqual(date('2026-12-31'));
    });
  });

  // RN-CTA-02
  describe('ageOn', () => {
    it('counts a year once the birthday arrives', () => {
      expect(ageOn(date('2008-10-17'), date('2026-10-16'))).toBe(17);
      expect(ageOn(date('2008-10-17'), date('2026-10-17'))).toBe(18);
      expect(ageOn(date('2008-10-18'), date('2026-10-17'))).toBe(17);
      expect(ageOn(date('2008-12-31'), date('2026-01-01'))).toBe(17);
    });

    it('turns a leap-day birthday into March 1 in other years', () => {
      expect(ageOn(date('2008-02-29'), date('2026-02-28'))).toBe(17);
      expect(ageOn(date('2008-02-29'), date('2026-03-01'))).toBe(18);
    });
  });
});
