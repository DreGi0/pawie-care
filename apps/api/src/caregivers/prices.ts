export interface PriceRange {
  minCents: number;
  suggestedCents: number;
  maxCents: number;
}

/**
 * The price a caregiver charges for one pet (RN-CUI-17, RN-PRE-01): the suggested one
 * when they didn't set any, kept within the current range, which can change after
 * they set it.
 */
export function resolvePrice(priceCents: number | null, range: PriceRange): number {
  return Math.min(Math.max(priceCents ?? range.suggestedCents, range.minCents), range.maxCents);
}
