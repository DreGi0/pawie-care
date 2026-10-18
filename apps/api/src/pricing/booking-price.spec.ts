import { CareLevel, ServiceCode } from '../generated/prisma/enums.js';
import {
  applyBasisPoints,
  type PricingRates,
  priceBooking,
  quoteBooking,
} from './booking-price.js';

// The initial values of §15.
const RATES: PricingRates = {
  additionalPetSurchargeBp: 5000,
  ownerServiceFeeBp: 1000,
  caregiverCommissionBp: 1500,
  guaranteeFundBp: 200,
  vatBp: 1300,
  gatewayFeeBp: 350,
};

const visit = (unitPriceCents: number) => ({ unitPriceCents });

describe('priceBooking', () => {
  it('reproduces the example of RN-PRE: a $17 Special visit', () => {
    const { amounts } = priceBooking([visit(1700)], 1, RATES);

    // The owner pays $18.70 and the caregiver gets $14.45.
    expect(amounts).toEqual({
      subtotalCents: 1700,
      ownerServiceFeeCents: 170,
      totalCents: 1870,
      caregiverCommissionCents: 255,
      caregiverPayoutCents: 1445,
    });
  });

  it('adds 50% of the caregiver’s price for each additional pet (RN-PRE-02)', () => {
    expect(priceBooking([visit(1300)], 2, RATES).slots).toEqual([
      { unitPriceCents: 1300, subtotalCents: 1950 },
    ]);
    expect(priceBooking([visit(1300)], 3, RATES).slots).toEqual([
      { unitPriceCents: 1300, subtotalCents: 2600 },
    ]);
  });

  it('rounds half up, once per amount', () => {
    // Each slot: 1235 × 1.5 = 1852.5 → 1853. The fee comes from the subtotal, 3706 ×
    // 10% = 370.6 → 371, not from adding up the fee of each slot (185 + 185).
    const { slots, amounts } = priceBooking([visit(1235), visit(1235)], 2, RATES);

    expect(slots.map(({ subtotalCents }) => subtotalCents)).toEqual([1853, 1853]);
    expect(amounts).toEqual({
      subtotalCents: 3706,
      ownerServiceFeeCents: 371,
      totalCents: 4077,
      // 3706 × 15% = 555.9 → 556
      caregiverCommissionCents: 556,
      caregiverPayoutCents: 3150,
    });
  });

  it('keeps total = subtotal + fee and payout = subtotal − commission', () => {
    for (const unitPriceCents of [1000, 1001, 1333, 1705, 4499]) {
      for (const petCount of [1, 2, 3]) {
        const { amounts } = priceBooking([visit(unitPriceCents)], petCount, RATES);

        expect(amounts.totalCents).toBe(amounts.subtotalCents + amounts.ownerServiceFeeCents);
        expect(amounts.caregiverPayoutCents).toBe(
          amounts.subtotalCents - amounts.caregiverCommissionCents,
        );
      }
    }
  });

  it('needs at least one slot and one pet', () => {
    expect(() => priceBooking([], 1, RATES)).toThrow(RangeError);
    expect(() => priceBooking([visit(1200)], 0, RATES)).toThrow(RangeError);
  });
});

describe('quoteBooking', () => {
  const { HOME_VISIT, OVERNIGHT_STAY } = ServiceCode;
  const ranges = {
    [OVERNIGHT_STAY]: { minCents: 2000, suggestedCents: 2500, maxCents: 3000 },
    [HOME_VISIT]: { minCents: 1000, suggestedCents: 1200, maxCents: 1400 },
  };

  it('prices the daytime visits of a stay at the visit price (RN-SER-03), and saves why', () => {
    const quote = quoteBooking({
      slots: [{ serviceCode: OVERNIGHT_STAY }, { serviceCode: HOME_VISIT }],
      careLevel: CareLevel.STANDARD,
      petCount: 2,
      prices: [
        { serviceCode: OVERNIGHT_STAY, caregiverPriceCents: 2800, range: ranges[OVERNIGHT_STAY] },
        // Set before the range went down: kept within the range (RN-CUI-17).
        { serviceCode: HOME_VISIT, caregiverPriceCents: 1500, range: ranges[HOME_VISIT] },
      ],
      rates: RATES,
    });

    expect(quote.slots).toEqual([
      { serviceCode: OVERNIGHT_STAY, unitPriceCents: 2800, subtotalCents: 4200 },
      { serviceCode: HOME_VISIT, unitPriceCents: 1400, subtotalCents: 2100 },
    ]);
    expect(quote.amounts).toMatchObject({ subtotalCents: 6300, totalCents: 6930 });
    expect(quote.snapshot).toEqual({
      version: 1,
      rounding: 'HALF_UP_ONCE_PER_AMOUNT',
      careLevel: 'STANDARD',
      petCount: 2,
      prices: [
        {
          serviceCode: OVERNIGHT_STAY,
          caregiverPriceCents: 2800,
          range: ranges[OVERNIGHT_STAY],
          unitPriceCents: 2800,
        },
        {
          serviceCode: HOME_VISIT,
          caregiverPriceCents: 1500,
          range: ranges[HOME_VISIT],
          unitPriceCents: 1400,
        },
      ],
      rates: RATES,
    });
  });

  it('uses the suggested price when the caregiver set none', () => {
    const quote = quoteBooking({
      slots: [{ serviceCode: HOME_VISIT }],
      careLevel: CareLevel.STANDARD,
      petCount: 1,
      prices: [{ serviceCode: HOME_VISIT, caregiverPriceCents: null, range: ranges[HOME_VISIT] }],
      rates: RATES,
    });

    expect(quote.slots[0].unitPriceCents).toBe(1200);
  });

  it('refuses a slot whose service has no price', () => {
    expect(() =>
      quoteBooking({
        slots: [{ serviceCode: OVERNIGHT_STAY }],
        careLevel: CareLevel.STANDARD,
        petCount: 1,
        prices: [],
        rates: RATES,
      }),
    ).toThrow(RangeError);
  });
});

describe('applyBasisPoints', () => {
  it('rounds exact halves up', () => {
    expect(applyBasisPoints(1705, 1000)).toBe(171);
    expect(applyBasisPoints(1704, 1000)).toBe(170);
    expect(applyBasisPoints(1, 5000)).toBe(1);
  });

  it('only takes non-negative integers', () => {
    expect(() => applyBasisPoints(10.5, 1000)).toThrow(RangeError);
    expect(() => applyBasisPoints(-100, 1000)).toThrow(RangeError);
  });
});
