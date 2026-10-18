import { type PriceRange, resolvePrice } from '../caregivers/prices.js';
import type { CareLevel, ServiceCode } from '../generated/prisma/enums.js';
import type { SettingValues } from '../settings/settings.service.js';

/** 10 000 basis points are 100%. */
const WHOLE_BP = 10_000;

/** The rates a booking copies when it's created (RN-PRE-07), in basis points. */
export interface PricingRates {
  /** RN-PRE-02 */
  additionalPetSurchargeBp: number;
  /** RN-PRE-03 */
  ownerServiceFeeBp: number;
  /** RN-PRE-04 */
  caregiverCommissionBp: number;
  /** RN-PRE-06 and RN-PAG-01: copied for the record; no amount of the booking uses them. */
  guaranteeFundBp: number;
  vatBp: number;
  gatewayFeeBp: number;
}

/** The settings that hold the rates and the price ranges (§15). */
export const PRICING_SETTING_KEYS = [
  'pricing.priceRanges',
  'pricing.additionalPetSurchargeBp',
  'pricing.ownerServiceFeeBp',
  'pricing.caregiverCommissionBp',
  'pricing.guaranteeFundBp',
  'pricing.vatBp',
  'payments.gatewayFeeBp',
] as const;

export type PricingSettings = SettingValues<typeof PRICING_SETTING_KEYS>;

export function ratesFrom(settings: PricingSettings): PricingRates {
  return {
    additionalPetSurchargeBp: settings['pricing.additionalPetSurchargeBp'],
    ownerServiceFeeBp: settings['pricing.ownerServiceFeeBp'],
    caregiverCommissionBp: settings['pricing.caregiverCommissionBp'],
    guaranteeFundBp: settings['pricing.guaranteeFundBp'],
    vatBp: settings['pricing.vatBp'],
    gatewayFeeBp: settings['payments.gatewayFeeBp'],
  };
}

/** What each party pays or gets, in cents. Each amount is rounded once. */
export interface BookingAmounts {
  /** What the caregiver charges: the sum of the slots, additional pets included. */
  subtotalCents: number;
  /** RN-PRE-03 */
  ownerServiceFeeCents: number;
  /** What the owner pays: the subtotal plus the service fee. */
  totalCents: number;
  /** RN-PRE-04 */
  caregiverCommissionCents: number;
  /** What the caregiver gets: the subtotal minus the commission. */
  caregiverPayoutCents: number;
}

/**
 * The amounts of a booking (RN-PRE-02 to RN-PRE-04), rounding half up once per amount (RN-PRE-08):
 * - each slot: the caregiver's price for one pet, plus the surcharge for each
 *   additional pet;
 * - the subtotal: the sum of the slots;
 * - the service fee and the commission: a percentage of the subtotal;
 * - the total and the payout: the subtotal plus the fee, and minus the commission.
 */
export function priceBooking<S extends { unitPriceCents: number }>(
  slots: readonly S[],
  petCount: number,
  rates: Pick<
    PricingRates,
    'additionalPetSurchargeBp' | 'ownerServiceFeeBp' | 'caregiverCommissionBp'
  >,
): { slots: (S & { subtotalCents: number })[]; amounts: BookingAmounts } {
  if (slots.length === 0 || !Number.isInteger(petCount) || petCount < 1) {
    throw new RangeError('A booking needs at least one slot and one pet');
  }
  const petsMultiplierBp = WHOLE_BP + rates.additionalPetSurchargeBp * (petCount - 1);
  const priced = slots.map((slot) => ({
    ...slot,
    subtotalCents: applyBasisPoints(slot.unitPriceCents, petsMultiplierBp),
  }));

  const subtotalCents = priced.reduce((sum, slot) => sum + slot.subtotalCents, 0);
  const ownerServiceFeeCents = applyBasisPoints(subtotalCents, rates.ownerServiceFeeBp);
  const caregiverCommissionCents = applyBasisPoints(subtotalCents, rates.caregiverCommissionBp);
  return {
    slots: priced,
    amounts: {
      subtotalCents,
      ownerServiceFeeCents,
      totalCents: subtotalCents + ownerServiceFeeCents,
      caregiverCommissionCents,
      caregiverPayoutCents: subtotalCents - caregiverCommissionCents,
    },
  };
}

/** The caregiver's price for one service at the booking's level. */
export interface CaregiverServicePrice {
  serviceCode: ServiceCode;
  /** What the caregiver set. Null means the suggested price. */
  caregiverPriceCents: number | null;
  /** The range in force for the service and level (RN-PRE-01). */
  range: PriceRange;
}

/**
 * Everything the price of a booking came from, saved in bookings.pricing_snapshot so
 * the amounts can be explained later even if the settings change (RN-PRE-07).
 */
export interface PricingSnapshot {
  version: 1;
  rounding: 'HALF_UP_ONCE_PER_AMOUNT';
  careLevel: CareLevel;
  petCount: number;
  prices: (CaregiverServicePrice & {
    /** caregiverPriceCents, or the suggested one, kept within the range (RN-CUI-17). */
    unitPriceCents: number;
  })[];
  rates: PricingRates;
}

/**
 * Prices the slots of a booking: each slot takes the caregiver's price for its
 * service, so the daytime visits of an overnight stay go at the visit price of the
 * same level (RN-SER-03).
 */
export function quoteBooking<S extends { serviceCode: ServiceCode }>({
  slots,
  careLevel,
  petCount,
  prices,
  rates,
}: {
  slots: readonly S[];
  careLevel: CareLevel;
  petCount: number;
  prices: readonly CaregiverServicePrice[];
  rates: PricingRates;
}): {
  slots: (S & { unitPriceCents: number; subtotalCents: number })[];
  amounts: BookingAmounts;
  snapshot: PricingSnapshot;
} {
  const resolved = prices.map((price) => ({
    ...price,
    unitPriceCents: resolvePrice(price.caregiverPriceCents, price.range),
  }));
  const unitPrices = new Map(resolved.map((price) => [price.serviceCode, price.unitPriceCents]));
  const withUnitPrices = slots.map((slot) => {
    const unitPriceCents = unitPrices.get(slot.serviceCode);
    if (unitPriceCents === undefined) {
      throw new RangeError(`No price for ${slot.serviceCode}`);
    }
    return { ...slot, unitPriceCents };
  });

  return {
    ...priceBooking(withUnitPrices, petCount, rates),
    snapshot: {
      version: 1,
      rounding: 'HALF_UP_ONCE_PER_AMOUNT',
      careLevel,
      petCount,
      prices: resolved,
      rates,
    },
  };
}

/** `cents` × `bp` / 10 000, rounded half up. */
export function applyBasisPoints(cents: number, bp: number): number {
  if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(bp) || cents < 0 || bp < 0) {
    throw new RangeError(`Expected non-negative integers, got ${cents} and ${bp}`);
  }
  const product = cents * bp;
  const quotient = Math.floor(product / WHOLE_BP);
  const remainder = product - quotient * WHOLE_BP;
  return 2 * remainder >= WHOLE_BP ? quotient + 1 : quotient;
}
