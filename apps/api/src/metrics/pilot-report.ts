import { CONFIRMED_STATUSES } from '../bookings/booking-status.js';
import { REQUIRED_DOCUMENTS } from '../caregivers/setup-steps.js';
import { addDays } from '../common/time/calendar.js';
import {
  BookingStatus,
  CaregiverStatus,
  type Prisma,
  type PrismaClient,
  Role,
} from '../generated/prisma/client.js';
import {
  CRITICAL_NUMBER_THRESHOLDS,
  GROWTH_TARGET_BP,
  PILOT_DISTRICTS,
  RETENTION_TARGET_BP,
  RETENTION_WINDOW_DAYS,
  SEED_EMAIL_DOMAIN,
  SUPPLY_TARGET_BP,
  VALUE_TARGET_BP,
  VALUE_WINDOW_DAYS,
} from './pilot-targets.js';

// RN-MET-01: the pilot report. It only reads.

/**
 * Instants the report looks at: `from` included and `to` excluded. Each metric filters
 * its group by when it entered: caregivers by when they turned on caregiver mode,
 * owners by when they signed up, and retention by the owner's first payment. Without
 * them, all the history.
 */
export interface ReportRange {
  from?: Date;
  to?: Date;
}

/** A percentage as the figures it comes from. */
export interface Ratio {
  numerator: number;
  denominator: number;
}

export interface PilotReport {
  /** RN-MET-02: as of now. Pausing and the schedule keep no history, so the range doesn't apply. */
  criticalNumber: number;
  /** RN-MET-03: caregivers at each step of FUNNEL_STEPS. */
  funnel: readonly number[];
  /** RN-MET-05 */
  supply: Ratio;
  /** RN-MET-04 */
  value: Ratio;
  /** RN-MET-07 */
  retention: Ratio;
}

/** RN-MET-01: the seed's test accounts don't count. */
const NOT_SEED = {
  NOT: { email: { endsWith: SEED_EMAIL_DOMAIN } },
} satisfies Prisma.UserWhereInput;

/** RN-MET-03: each step counts only the caregivers who also meet the ones before. */
const FUNNEL_STEPS: readonly { name: string; where: Prisma.CaregiverProfileWhereInput }[] = [
  // RN-CTA-06: turning on caregiver mode creates the profile.
  { name: 'Perfiles creados', where: {} },
  {
    name: 'Con documentos completos',
    where: { AND: REQUIRED_DOCUMENTS.map((kind) => ({ documents: { some: { kind } } })) },
  },
  { name: 'Con el curso aprobado', where: { welcomeCoursePassedAt: { not: null } } },
  { name: 'Aprobados', where: { status: CaregiverStatus.APPROVED } },
];

export async function buildPilotReport(
  prisma: PrismaClient,
  range: ReportRange,
  now: Date,
): Promise<PilotReport> {
  const [criticalNumber, funnel, owners, payments] = await Promise.all([
    countVerifiedActiveCaregivers(prisma),
    countFunnel(prisma, range),
    // RN-MET-01: only the owners who already had the whole 15 days.
    prisma.user.findMany({
      where: {
        ...NOT_SEED,
        roles: { has: Role.OWNER },
        createdAt: { gte: range.from, lt: range.to, lte: addDays(now, -VALUE_WINDOW_DAYS) },
      },
      select: { id: true, createdAt: true },
    }),
    paymentsByOwner(prisma),
  ]);

  // RN-MET-01: only the owners whose first payment already had the whole 60 days.
  const retentionDeadline = addDays(now, -RETENTION_WINDOW_DAYS);
  const retentionGroup = [...payments.values()].filter(
    ([first]) =>
      first <= retentionDeadline &&
      (range.from === undefined || first >= range.from) &&
      (range.to === undefined || first < range.to),
  );

  return {
    criticalNumber,
    funnel,
    supply: { numerator: funnel[FUNNEL_STEPS.length - 1], denominator: funnel[0] },
    value: firstPaymentWithin(
      owners.map(({ id, createdAt }) => ({ signedUpAt: createdAt, payments: payments.get(id) })),
      VALUE_WINDOW_DAYS,
    ),
    retention: repeatPaymentWithin(retentionGroup, RETENTION_WINDOW_DAYS),
  };
}

/** RN-MET-02 */
function countVerifiedActiveCaregivers(prisma: PrismaClient): Promise<number> {
  return prisma.caregiverProfile.count({
    where: {
      user: NOT_SEED,
      // RN-CUI-03, RN-CUI-02
      status: CaregiverStatus.APPROVED,
      welcomeCoursePassedAt: { not: null },
      // RN-CUI-20
      isPaused: false,
      // RN-CUI-04
      availability: { some: {} },
      districts: { some: { district: { slug: { in: [...PILOT_DISTRICTS] } } } },
    },
  });
}

/** RN-MET-03 */
function countFunnel(prisma: PrismaClient, { from, to }: ReportRange): Promise<number[]> {
  return Promise.all(
    FUNNEL_STEPS.map((_, step) =>
      prisma.caregiverProfile.count({
        where: {
          user: NOT_SEED,
          createdAt: { gte: from, lt: to },
          AND: FUNNEL_STEPS.slice(0, step + 1).map(({ where }) => where),
        },
      }),
    ),
  );
}

/**
 * RN-MET-01: when each owner paid each of their paid bookings, oldest first. A booking
 * is paid when its status is one of CONFIRMED_STATUSES, and it was paid when it
 * reached CONFIRMED.
 */
async function paymentsByOwner(prisma: PrismaClient): Promise<Map<string, Date[]>> {
  const bookings = await prisma.booking.findMany({
    where: { owner: NOT_SEED, status: { in: [...CONFIRMED_STATUSES] } },
    select: {
      ownerId: true,
      statusChanges: {
        where: { toStatus: BookingStatus.CONFIRMED },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const payments = new Map<string, Date[]>();
  for (const { ownerId, statusChanges } of bookings) {
    // BookingStateMachine records every change, so a paid booking always has one.
    if (statusChanges.length === 0) continue;
    payments.set(ownerId, [...(payments.get(ownerId) ?? []), statusChanges[0].createdAt]);
  }
  for (const dates of payments.values()) dates.sort((a, b) => a.getTime() - b.getTime());
  return payments;
}

/**
 * RN-MET-04: of the owners, how many paid their first booking within `days` of signing
 * up. Day `days` itself still counts.
 */
export function firstPaymentWithin(
  owners: readonly { signedUpAt: Date; payments: readonly Date[] | undefined }[],
  days: number,
): Ratio {
  return {
    numerator: owners.filter(
      ({ signedUpAt, payments }) =>
        payments !== undefined && payments[0] <= addDays(signedUpAt, days),
    ).length,
    denominator: owners.length,
  };
}

/**
 * RN-MET-07: of the owners who paid (each as their payments, oldest first), how many
 * paid another booking within `days` of the first. Day `days` itself still counts.
 */
export function repeatPaymentWithin(owners: readonly (readonly Date[])[], days: number): Ratio {
  return {
    numerator: owners.filter(
      ([first, second]) => second !== undefined && second <= addDays(first, days),
    ).length,
    denominator: owners.length,
  };
}

/** One row of the report's table, as printed. */
export interface ReportLine {
  metric: string;
  value: string;
  target: string;
  status: string;
}

export function reportLines(report: PilotReport): ReportLine[] {
  return [
    criticalNumberLine(report.criticalNumber),
    ...funnelLines(report.funnel),
    rateLine('Oferta (RN-MET-05)', report.supply, SUPPLY_TARGET_BP),
    rateLine('Valor (RN-MET-04)', report.value, VALUE_TARGET_BP),
    // RN-MET-06 needs the referrals, which come with the events of stage 11.
    {
      metric: 'Crecimiento (RN-MET-06)',
      value: 'sin datos todavía',
      target: formatBasisPoints(GROWTH_TARGET_BP),
      status: '—',
    },
    rateLine('Retención (RN-MET-07)', report.retention, RETENTION_TARGET_BP),
  ];
}

/** RN-MET-02: below red is a fourth band, because red is the minimum acceptable. */
export function criticalNumberStatus(count: number): string {
  const { red, green, superGreen } = CRITICAL_NUMBER_THRESHOLDS;
  if (count >= superGreen) return 'súper verde';
  if (count >= green) return 'verde';
  if (count >= red) return 'rojo';
  return 'bajo el mínimo';
}

function criticalNumberLine(count: number): ReportLine {
  const { red, green, superGreen } = CRITICAL_NUMBER_THRESHOLDS;
  return {
    metric: 'Número crítico (RN-MET-02)',
    value: String(count),
    target: `${red} / ${green} / ${superGreen}`,
    status: criticalNumberStatus(count),
  };
}

/** Each step with its % of the step before. The funnel has no target. */
function funnelLines(funnel: readonly number[]): ReportLine[] {
  return funnel.map((count, step) => {
    const previous = step === 0 ? 0 : funnel[step - 1];
    return {
      metric: `Embudo ${step + 1}. ${FUNNEL_STEPS[step].name}`,
      value:
        previous === 0
          ? String(count)
          : `${count} (${formatPercent({ numerator: count, denominator: previous })})`,
      target: '',
      status: '',
    };
  });
}

/**
 * A hypothesis against its target. "Cumple" and "no cumple", not colors, so they don't
 * read as the bands of the critical number.
 */
function rateLine(metric: string, ratio: Ratio, targetBp: number): ReportLine {
  const target = formatBasisPoints(targetBp);
  if (ratio.denominator === 0) return { metric, value: 'sin datos', target, status: '—' };
  return {
    metric,
    value: `${formatPercent(ratio)} (${ratio.numerator}/${ratio.denominator})`,
    target,
    status: ratio.numerator * 10_000 >= targetBp * ratio.denominator ? 'cumple' : 'no cumple',
  };
}

/** To one decimal, rounded down, so it never shows a target it doesn't reach. */
function formatPercent({ numerator, denominator }: Ratio): string {
  const tenths = Math.floor((numerator * 1000) / denominator);
  return `${tenths % 10 === 0 ? tenths / 10 : (tenths / 10).toFixed(1)}%`;
}

function formatBasisPoints(bp: number): string {
  return `${bp / 100}%`;
}

/** The lines as a table with a header, its columns padded to fit. */
export function formatTable(lines: readonly ReportLine[]): string[] {
  const columns = ['metric', 'value', 'target', 'status'] as const;
  const header: ReportLine = {
    metric: 'Métrica',
    value: 'Valor',
    target: 'Meta',
    status: 'Estado',
  };
  const rows = [header, ...lines];
  const widths = columns.map((column) => Math.max(...rows.map((row) => row[column].length)));
  const format = (row: ReportLine) =>
    columns
      .map((column, i) => row[column].padEnd(widths[i]))
      .join('  ')
      .trimEnd();
  const rule = widths.map((width) => '─'.repeat(width)).join('  ');
  return [format(header), rule, ...lines.map(format)];
}
