// RN-PRE-02 and RN-PRE-03 with the values of §15 of the rules. The API doesn't publish them,
// so this is only the estimate of Reservar: the booking stores the real amounts when it's
// created (RN-PRE-07), and Pagar shows those.
const ADDITIONAL_PET_SURCHARGE_BP = 5000;
const OWNER_SERVICE_FEE_BP = 1000;

/** Rounds half up, like the API (RN-PRE-08). */
function applyBasisPoints(cents: number, bp: number): number {
  return Math.floor((cents * bp + 5000) / 10_000);
}

/** The amounts of a booking before creating it, the way the API calculates them. */
export function estimatePrice(unitPriceCents: number, slotCount: number, petCount: number) {
  const slotCents = applyBasisPoints(
    unitPriceCents,
    10_000 + ADDITIONAL_PET_SURCHARGE_BP * (petCount - 1),
  );
  const subtotalCents = slotCents * slotCount;
  const serviceFeeCents = applyBasisPoints(subtotalCents, OWNER_SERVICE_FEE_BP);
  return {
    slotCents,
    subtotalCents,
    serviceFeeCents,
    serviceFeePercent: OWNER_SERVICE_FEE_BP / 100,
    totalCents: subtotalCents + serviceFeeCents,
  };
}
