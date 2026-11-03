import {
  addDays,
  atMinuteInElSalvador,
  dateInElSalvador,
  isoWeekday,
} from '../common/time/calendar.js';

export interface WeeklyWindow {
  /** ISO day of the week: 1 is Monday. */
  weekday: number;
  startMinute: number;
  /** Past 1440 when the window ends the next day. */
  endMinute: number;
}

export interface TimeRange {
  startsAt: Date;
  endsAt: Date;
}

/**
 * Whether the weekly schedule covers the whole slot. Windows that touch or overlap
 * count as one, so an overnight from 19:00 to 08:00 followed by a day window from
 * 08:00 covers a slot across 08:00.
 */
export function scheduleCovers(windows: readonly WeeklyWindow[], slot: TimeRange): boolean {
  // A window can start the day before the slot and end on it, so start one day back.
  const first = addDays(dateInElSalvador(slot.startsAt), -1);
  const last = dateInElSalvador(slot.endsAt);
  const ranges: TimeRange[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) {
    const weekday = isoWeekday(day);
    for (const window of windows) {
      if (window.weekday === weekday) {
        ranges.push({
          startsAt: atMinuteInElSalvador(day, window.startMinute),
          endsAt: atMinuteInElSalvador(day, window.endMinute),
        });
      }
    }
  }

  let coveredUntil = slot.startsAt;
  for (const range of ranges.toSorted((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    if (range.startsAt > coveredUntil) {
      break;
    }
    if (range.endsAt > coveredUntil) {
      coveredUntil = range.endsAt;
    }
    if (coveredUntil >= slot.endsAt) {
      return true;
    }
  }
  return coveredUntil >= slot.endsAt;
}

/** Whether two time ranges share any time. Touching at one end doesn't count. */
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * RN-CUI-04: why a weekly schedule can't be saved, or null. Each window ends after it
 * starts and lasts at most a day, as the CHECK on caregiver_availability asks, and two
 * windows of the same day can't overlap. Windows that touch are fine: scheduleCovers
 * joins them.
 */
export function scheduleProblem(windows: readonly WeeklyWindow[]): string | null {
  if (
    windows.some(
      ({ startMinute, endMinute }) => endMinute <= startMinute || endMinute > startMinute + 1440,
    )
  ) {
    return 'Cada horario tiene que terminar después de empezar, y durar hasta 24 horas.';
  }
  const sorted = windows.toSorted((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
  const overlap = sorted.some(
    (window, index) =>
      index > 0 &&
      window.weekday === sorted[index - 1].weekday &&
      window.startMinute < sorted[index - 1].endMinute,
  );
  return overlap ? 'Dos horarios del mismo día se cruzan. Únelos en uno solo.' : null;
}
