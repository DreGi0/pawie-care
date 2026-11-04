// Dates and money as the app shows them. Dates are always in San Salvador's time
// (America/El_Salvador), whatever the phone's time zone is.

// El Salvador has no daylight saving time, so its offset never changes.
const OFFSET = '-06:00';
const OFFSET_MS = 6 * 60 * 60 * 1000;

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** San Salvador's wall clock, read with the getUTC* methods. */
function wallClock(date: Date | string): Date {
  return new Date(new Date(date).getTime() - OFFSET_MS);
}

/** "Lun 19 oct". */
export function formatDay(date: Date | string): string {
  const d = wallClock(date);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "9:00". */
export function formatTime(date: Date | string): string {
  const d = wallClock(date);
  return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** "Lun 19 oct, 9:00". */
export function formatDayTime(date: Date | string): string {
  return `${formatDay(date)}, ${formatTime(date)}`;
}

/** "Lun 19 oct, de 9:00 a 10:00". */
export function formatRange(start: Date | string, end: Date | string): string {
  return `${formatDay(start)}, de ${formatTime(start)} a ${formatTime(end)}`;
}

/** "el lunes 19 de octubre a las 9:00". */
export function formatLongDayTime(date: Date | string): string {
  const d = wallClock(date);
  const hour = d.getUTCHours() === 1 ? 'a la' : 'a las';
  return `el ${DAYS_LONG[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS_LONG[d.getUTCMonth()]} ${hour} ${formatTime(date)}`;
}

/** "Lunes 2 de noviembre". */
export function formatLongDay(date: Date | string): string {
  const d = wallClock(date);
  const day = DAYS_LONG[d.getUTCDay()];
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${d.getUTCDate()} de ${MONTHS_LONG[d.getUTCMonth()]}`;
}

/** "antes de las 17:30" if it's today in San Salvador, "antes del Mar 20 oct, 17:30" if not. */
export function formatDeadline(date: Date | string, now = new Date()): string {
  return localDate(date) === localDate(now)
    ? `antes de las ${formatTime(date)}`
    : `antes del ${formatDayTime(date)}`;
}

/** The day in San Salvador, as an ISO date: "2026-10-19". */
export function localDate(date: Date | string): string {
  return wallClock(date).toISOString().slice(0, 10);
}

/** A moment in San Salvador: ("2026-10-19", 9 × 60) is "2026-10-19T09:00:00-06:00". */
export function atLocalTime(day: string, minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${day}T${hh}:${mm}:00${OFFSET}`;
}

/** The next `count` days in San Salvador, starting today, as ISO dates. */
export function upcomingDays(count: number, now = new Date()): string[] {
  const today = Date.parse(`${localDate(now)}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(today + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
}

/** Whole days from now until `date`, rounding up: 12 hours left are 1 day. Never below 0. */
export function daysUntil(date: Date | string, now = new Date()): number {
  const ms = new Date(date).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/** For a list of days: "Hoy", "Mañana" or "Mié 21". */
export function dayLabel(day: string, now = new Date()): string {
  const [today, tomorrow] = upcomingDays(2, now);
  if (day === today) return 'Hoy';
  if (day === tomorrow) return 'Mañana';
  const d = new Date(`${day}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
}

/** Turns what the person types into DD/MM/AAAA, adding the slashes. */
export function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

/** "12/03/2023" is "2023-03-12". Null if it's not a real date. */
export function parseDate(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null;
}

/** 1320 is "$13.20". With `short`, whole amounts drop the cents: 1200 is "$12". */
export function formatMoney(cents: number, { short = false } = {}): string {
  const text = (cents / 100).toFixed(2);
  return `$${short && text.endsWith('.00') ? text.slice(0, -3) : text}`;
}

/** Turns what the person types into "7000 0000". */
export function maskPhone(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits;
}

/** "7000 0000" is "+50370000000". Null if it isn't a Salvadoran number of 8 digits. */
export function parsePhone(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  return /^[267]\d{7}$/.test(digits) ? `+503${digits}` : null;
}

/** A day without a time, as the API sends birth dates: "2026-11-03" is "3 nov 2026". */
export function formatDate(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-').map(Number);
  return `${dd} ${MONTHS[mm - 1]} ${yyyy}`;
}

/**
 * Two days, both included: "del 3 al 12 nov 2026", "del 28 oct al 3 nov 2026". Without an end,
 * "desde el 3 nov 2026".
 */
export function formatDateSpan(from: string, to: string | null): string {
  if (to === null) return `desde el ${formatDate(from)}`;
  const [fromYear, fromMonth, fromDay] = from.split('-');
  const [toYear, toMonth] = to.split('-');
  const start =
    fromYear !== toYear
      ? formatDate(from)
      : fromMonth !== toMonth
        ? `${Number(fromDay)} ${MONTHS[Number(fromMonth) - 1]}`
        : String(Number(fromDay));
  return `del ${start} al ${formatDate(to)}`;
}

/** "2023-03-12" is "12/03/2023", as the date fields show it. The inverse of parseDate. */
export function toDateInput(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

/** Minutes since midnight as a time of day: 420 is "7:00". */
export function formatMinute(minute: number): string {
  return `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`;
}

/** Turns what the person types into HH:MM, adding the colon. */
export function maskTime(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

/** "07:30" or "7:30" is 450 minutes since midnight. Null if it isn't a time of day. */
export function parseTime(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** 450 is "07:30", as the time fields show it. The inverse of parseTime. */
export function toTimeInput(minute: number): string {
  return formatMinute(minute).padStart(5, '0');
}

/** "del 3 al 12 nov" is "Del 3 al 12 nov", to start a line. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "+50322220000" is "+503 2222 0000". Any other number stays as it is. */
export function formatPhone(phone: string): string {
  const match = /^\+503(\d{8})$/.exec(phone.replace(/\s/g, ''));
  return match ? `+503 ${maskPhone(match[1])}` : phone;
}
