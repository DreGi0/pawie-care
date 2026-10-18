// Calendar dates (PostgreSQL `date`, which Prisma maps to a Date at 00:00 UTC) as seen
// in El Salvador, where the business runs (docs/arquitectura.md §4.6).

/** El Salvador is UTC−6 all year: it has no daylight saving time. */
const EL_SALVADOR_UTC_OFFSET_MS = -6 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The date in El Salvador at that instant. */
export function dateInElSalvador(instant: Date): Date {
  const local = new Date(instant.getTime() + EL_SALVADOR_UTC_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** Months ahead or back. A day that doesn't exist in the target month rolls over. */
export function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Whole years from `birthDate` to `today`. Someone born on February 29 turns a year older on March 1. */
export function ageOn(birthDate: Date, today: Date): number {
  const years = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayPassed =
    today.getUTCMonth() > birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() &&
      today.getUTCDate() >= birthDate.getUTCDate());
  return birthdayPassed ? years : years - 1;
}

/** "2026-10-17" to the Date Prisma uses for a `date` column. */
export function parseDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** A `date` column back to "2026-10-17". */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
