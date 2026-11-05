import type { BookingResponse, BookingStatus, ServiceCode } from '@pawie/api-client';

import { formatDay, formatDeadline, formatRange } from './format';

const NAMES: Record<ServiceCode, { name: string; short: string; unit: string }> = {
  WALK: { name: 'Paseo', short: 'Paseo', unit: 'por paseo' },
  HOME_VISIT: { name: 'Visita a domicilio', short: 'Visita', unit: 'por visita' },
  OVERNIGHT_STAY: { name: 'Pernocta', short: 'Pernocta', unit: 'por noche' },
};

/** "Paseo", "Visita a domicilio" or "Pernocta". */
export function serviceName(code: ServiceCode): string {
  return NAMES[code].name;
}

/** "Paseo", "Visita" or "Pernocta", for placas and service blocks. */
export function serviceShortName(code: ServiceCode): string {
  return NAMES[code].short;
}

/** "por paseo", "por visita" or "por noche". */
export function serviceUnit(code: ServiceCode): string {
  return NAMES[code].unit;
}

/** "Luna", "Luna y Mishi", "Luna, Mishi y Toby". */
export function joinNames(names: readonly string[]): string {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/** The first name of a caregiver's display name: "Ana M." is "Ana". */
export function firstName(displayName: string): string {
  return displayName.split(' ')[0] ?? displayName;
}

/** Booked, waiting for an answer or a payment, or happening: Mis visitas shows them first. */
export function isUpcoming(status: BookingStatus): boolean {
  return ['REQUESTED', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'].includes(status);
}

export type StatusTag = {
  tone: 'info' | 'warning' | 'success' | 'error';
  label: string;
};

/** How Mis visitas and the booking's screen name its state. */
export function statusTag(booking: BookingResponse, now = new Date()): StatusTag {
  const name = firstName(booking.caregiver.displayName);
  switch (booking.status) {
    case 'REQUESTED':
      return {
        tone: 'info',
        label: booking.responseDueAt
          ? `${name} responde ${formatDeadline(booking.responseDueAt, now)}`
          : `Esperando a ${name}`,
      };
    case 'PENDING_PAYMENT':
      return {
        tone: 'warning',
        label: booking.paymentDueAt
          ? `Falta pagar ${formatDeadline(booking.paymentDueAt, now)}`
          : 'Falta pagar',
      };
    case 'CONFIRMED':
      return {
        tone: 'success',
        label: {
          WALK: 'Paseo confirmado',
          HOME_VISIT: 'Visita confirmada',
          OVERNIGHT_STAY: 'Pernocta confirmada',
        }[booking.serviceCode],
      };
    case 'IN_PROGRESS':
      return { tone: 'success', label: 'En curso' };
    case 'COMPLETED':
    case 'CLOSED':
      return { tone: 'success', label: 'Completada' };
    case 'REJECTED':
      return { tone: 'error', label: `${name} no pudo aceptarla` };
    case 'EXPIRED':
      return { tone: 'error', label: 'Venció' };
    case 'CANCELLED_BY_OWNER':
      return { tone: 'error', label: 'La cancelaste' };
    case 'CANCELLED_BY_CAREGIVER':
      return { tone: 'error', label: `${name} la canceló` };
    case 'DISPUTED':
      return { tone: 'warning', label: 'En revisión' };
  }
}

/** "Paseo", "Visita a domicilio" or "Pernocta", or "Paseo especial", "Visita especial"... */
export function serviceKind(booking: Pick<BookingResponse, 'serviceCode' | 'careLevel'>): string {
  if (booking.careLevel !== 'SPECIAL') return serviceName(booking.serviceCode);
  return `${serviceShortName(booking.serviceCode)} especial`;
}

/** "Lun 19 oct, de 9:00 a 10:00", or "Noche del Lun 19 oct" for an overnight stay. */
export function formatWhen(
  booking: Pick<BookingResponse, 'serviceCode' | 'startsAt' | 'endsAt'>,
): string {
  return booking.serviceCode === 'OVERNIGHT_STAY'
    ? `Noche del ${formatDay(booking.startsAt)}`
    : formatRange(booking.startsAt, booking.endsAt);
}
