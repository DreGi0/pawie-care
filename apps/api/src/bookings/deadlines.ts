import type { SettingValue } from '../settings/settings.registry.js';

const HOUR_MS = 60 * 60 * 1000;

/**
 * RN-RES-06: how long the caregiver has to answer depends on how far the service is:
 * the long window with more than 72 h to go, the middle one from 24 h to 72 h (both
 * included) and the short one with less than 24 h. It never ends after the first slot
 * starts.
 */
export function responseDeadline(
  requestedAt: Date,
  firstSlotStartsAt: Date,
  windows: SettingValue<'bookings.caregiverResponseMinutes'>,
): Date {
  const leadMs = firstSlotStartsAt.getTime() - requestedAt.getTime();
  const minutes =
    leadMs > 72 * HOUR_MS
      ? windows.over72h
      : leadMs >= 24 * HOUR_MS
        ? windows.from24hTo72h
        : windows.under24h;
  return earliest(addMinutes(requestedAt, minutes), firstSlotStartsAt);
}

/**
 * RN-RES-07: the owner has the payment window from the moment the booking is waiting
 * for payment, but never past the start of the first slot.
 */
export function paymentDeadline(
  pendingSince: Date,
  firstSlotStartsAt: Date,
  windowMinutes: number,
): Date {
  return earliest(addMinutes(pendingSince, windowMinutes), firstSlotStartsAt);
}

function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}

function earliest(a: Date, b: Date): Date {
  return a <= b ? a : b;
}
