import { parseArgs } from 'node:util';
import {
  addDays,
  atMinuteInElSalvador,
  dateInElSalvador,
  formatDateOnly,
  parseDateOnly,
} from '../common/time/calendar.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { CommandOutput } from '../settings/set-setting.command.js';
import { buildPilotReport, formatTable, reportLines } from './pilot-report.js';
import { RETENTION_WINDOW_DAYS, SEED_EMAIL_DOMAIN, VALUE_WINDOW_DAYS } from './pilot-targets.js';

const USAGE = `Uso: pnpm metrics:report [--from <AAAA-MM-DD>] [--to <AAAA-MM-DD>]

Imprime el reporte del piloto (RN-MET-01). Las fechas son días en El Salvador y los dos
extremos cuentan. Sin fechas, usa todo el historial.

Ejemplo: pnpm metrics:report --from 2026-10-01 --to 2026-10-31`;

const NOTES = [
  `No cuentan las cuentas del seed (${SEED_EMAIL_DOMAIN}).`,
  'El número crítico es el de hoy: no depende de las fechas.',
  `Valor solo cuenta a los dueños registrados hace al menos ${VALUE_WINDOW_DAYS} días, y Retención a los que pagaron su primera reserva hace al menos ${RETENTION_WINDOW_DAYS}.`,
];

/**
 * `pnpm metrics:report`: prints the pilot report (RN-MET-01). It only reads. Returns
 * the exit code. The messages are for the person running it, in Spanish.
 */
export async function metricsReportCommand(
  args: string[],
  prisma: PrismaClient,
  output: CommandOutput = console,
  now: Date = new Date(),
): Promise<number> {
  let values;
  try {
    ({ values } = parseArgs({
      args,
      options: { from: { type: 'string' }, to: { type: 'string' } },
    }));
  } catch (error) {
    output.error(`${(error as Error).message}\n\n${USAGE}`);
    return 1;
  }

  const from = values.from === undefined ? undefined : parseDay(values.from);
  const to = values.to === undefined ? undefined : parseDay(values.to);
  if (from === null || to === null) {
    output.error(`Las fechas van como AAAA-MM-DD.\n\n${USAGE}`);
    return 1;
  }
  if (from !== undefined && to !== undefined && from > to) {
    output.error('--from no puede ser posterior a --to.');
    return 1;
  }

  const report = await buildPilotReport(
    prisma,
    {
      from: from && atMinuteInElSalvador(from, 0),
      // --to includes its whole day.
      to: to && atMinuteInElSalvador(addDays(to, 1), 0),
    },
    now,
  );
  output.log(
    [
      `Reporte del piloto, ${rangeName(from, to)}, al ${formatDay(dateInElSalvador(now))}`,
      '',
      ...formatTable(reportLines(report)),
      '',
      ...NOTES,
    ].join('\n'),
  );
  return 0;
}

/** "2026-10-31" to that date, or null if it isn't one. */
function parseDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = parseDateOnly(day);
  // A day that doesn't exist, like 2026-02-30, rolls over to another one.
  return Number.isNaN(date.getTime()) || formatDateOnly(date) !== day ? null : date;
}

function rangeName(from: Date | undefined, to: Date | undefined): string {
  if (from && to) return `del ${formatDay(from)} al ${formatDay(to)}`;
  if (from) return `desde el ${formatDay(from)}`;
  if (to) return `hasta el ${formatDay(to)}`;
  return 'todo el historial';
}

/** A date as it's written in El Salvador: 31/10/2026. */
function formatDay(date: Date): string {
  return formatDateOnly(date).split('-').reverse().join('/');
}
