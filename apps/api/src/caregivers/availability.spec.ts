import { overlaps, scheduleCovers, type WeeklyWindow } from './availability.js';

const sv = (dateTime: string) => new Date(`${dateTime}-06:00`);
const slot = (from: string, to: string) => ({ startsAt: sv(from), endsAt: sv(to) });

// 2026-11-16 is a Monday.
const DAYS: WeeklyWindow[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMinute: 7 * 60,
  endMinute: 19 * 60,
}));
const NIGHTS: WeeklyWindow[] = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  startMinute: 19 * 60,
  endMinute: 32 * 60,
}));

describe('scheduleCovers', () => {
  it('covers a visit inside a day window, and not one past it', () => {
    expect(scheduleCovers(DAYS, slot('2026-11-16T09:00', '2026-11-16T10:00'))).toBe(true);
    expect(scheduleCovers(DAYS, slot('2026-11-16T18:30', '2026-11-16T19:30'))).toBe(false);
  });

  it('only covers the weekdays it has', () => {
    expect(scheduleCovers(DAYS, slot('2026-11-21T09:00', '2026-11-21T10:00'))).toBe(false);
  });

  it('covers an overnight with a window that crosses midnight', () => {
    expect(scheduleCovers(NIGHTS, slot('2026-11-16T19:00', '2026-11-17T08:00'))).toBe(true);
    expect(scheduleCovers(NIGHTS, slot('2026-11-17T02:00', '2026-11-17T03:00'))).toBe(true);
  });

  it('joins windows that touch', () => {
    expect(scheduleCovers([...DAYS, ...NIGHTS], slot('2026-11-16T18:30', '2026-11-16T19:30'))).toBe(
      true,
    );
    expect(scheduleCovers([...DAYS, ...NIGHTS], slot('2026-11-17T07:30', '2026-11-17T08:30'))).toBe(
      true,
    );
  });

  it('crosses from Sunday night into Monday morning', () => {
    const sundayNight: WeeklyWindow[] = [{ weekday: 7, startMinute: 19 * 60, endMinute: 32 * 60 }];

    expect(scheduleCovers(sundayNight, slot('2026-11-22T19:00', '2026-11-23T08:00'))).toBe(true);
    expect(scheduleCovers(sundayNight, slot('2026-11-23T19:00', '2026-11-24T08:00'))).toBe(false);
  });

  it('covers nothing without windows', () => {
    expect(scheduleCovers([], slot('2026-11-16T09:00', '2026-11-16T10:00'))).toBe(false);
  });
});

describe('overlaps', () => {
  it('ignores ranges that only touch', () => {
    expect(
      overlaps(
        slot('2026-11-16T09:00', '2026-11-16T10:00'),
        slot('2026-11-16T10:00', '2026-11-16T11:00'),
      ),
    ).toBe(false);
    expect(
      overlaps(
        slot('2026-11-16T09:00', '2026-11-16T10:00'),
        slot('2026-11-16T09:59', '2026-11-16T11:00'),
      ),
    ).toBe(true);
  });
});
