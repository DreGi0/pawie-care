import { UnprocessableEntityException } from '@nestjs/common';
import {
  addDays,
  atMinuteInElSalvador,
  dateInElSalvador,
  parseDateOnly,
} from '../common/time/calendar.js';
import { ServiceCode } from '../generated/prisma/enums.js';
import type { ScheduleRequest } from './schedule.dto.js';

export interface PlannedSlot {
  serviceCode: ServiceCode;
  startsAt: Date;
  endsAt: Date;
}

/** The settings planSlots needs (§15). */
export interface ScheduleRules {
  homeVisitMinutes: number;
  overnightStartMinute: number;
  overnightEndMinute: number;
  minLeadTimeMinutes: number;
}

/**
 * Turns the nights and visits the owner asked for into slots, sorted by start, and
 * checks that they make sense:
 * - a home visit booking has visits and no nights; an overnight booking has nights,
 *   and its visits fall during the stay (RN-SER-03);
 * - the slots don't overlap, since each one blocks its own time (RN-CUI-15);
 * - the first one starts at least the minimum lead time from now (RN-RES-05).
 */
export function planSlots(
  { serviceCode, nights = [], visits = [] }: ScheduleRequest,
  rules: ScheduleRules,
  now: Date,
): PlannedSlot[] {
  if (serviceCode === ServiceCode.HOME_VISIT) {
    if (nights.length > 0) {
      throw invalidSchedule('Una visita a domicilio no lleva noches.');
    }
    if (visits.length === 0) {
      throw invalidSchedule('Elige cuándo empieza cada visita.');
    }
  } else if (nights.length === 0) {
    throw invalidSchedule('Elige al menos una noche.');
  }
  if (new Set(nights).size !== nights.length) {
    throw invalidSchedule('Elegiste la misma noche dos veces.');
  }

  const nightSlots = nights.map((night) => {
    const date = parseDateOnly(night);
    return {
      serviceCode: ServiceCode.OVERNIGHT_STAY,
      startsAt: atMinuteInElSalvador(date, rules.overnightStartMinute),
      endsAt: atMinuteInElSalvador(addDays(date, 1), rules.overnightEndMinute),
    };
  });
  const visitSlots = visits.map((visit) => {
    const startsAt = new Date(visit);
    return {
      serviceCode: ServiceCode.HOME_VISIT,
      startsAt,
      endsAt: new Date(startsAt.getTime() + rules.homeVisitMinutes * 60_000),
    };
  });

  if (nightSlots.length > 0 && visitSlots.length > 0) {
    const stayStart = Math.min(...nightSlots.map(({ startsAt }) => startsAt.getTime()));
    const stayEnd = Math.max(...nightSlots.map(({ endsAt }) => endsAt.getTime()));
    if (
      visitSlots.some(
        ({ startsAt, endsAt }) => startsAt.getTime() < stayStart || endsAt.getTime() > stayEnd,
      )
    ) {
      throw invalidSchedule('Las visitas de una pernocta van durante los días de la estadía.');
    }
  }

  const slots = [...nightSlots, ...visitSlots].toSorted(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
  for (let i = 1; i < slots.length; i++) {
    if (slots[i].startsAt < slots[i - 1].endsAt) {
      throw invalidSchedule(
        'Dos de los horarios se cruzan. Cada visita y cada noche van por separado.',
      );
    }
  }

  const earliest = new Date(now.getTime() + rules.minLeadTimeMinutes * 60_000);
  if (slots[0].startsAt < earliest) {
    throw new UnprocessableEntityException({
      errorCode: 'TOO_SOON',
      message: `Hay que pedir el servicio con al menos ${formatLeadTime(rules.minLeadTimeMinutes)} de anticipación.`,
    });
  }
  return slots;
}

/** The dates a service covers in El Salvador, both inclusive, as care levels use them (RN-MAS-05). */
export function serviceDates(slots: readonly PlannedSlot[]): { from: Date; to: Date } {
  return {
    from: dateInElSalvador(slots[0].startsAt),
    // A slot that ends exactly at midnight doesn't reach the next day.
    to: dateInElSalvador(new Date(Math.max(...slots.map(({ endsAt }) => endsAt.getTime())) - 1)),
  };
}

function formatLeadTime(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
}

function invalidSchedule(message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ errorCode: 'INVALID_SCHEDULE', message });
}
