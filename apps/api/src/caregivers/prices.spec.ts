import { resolvePrice } from './prices.js';

const VISIT = { minCents: 1000, suggestedCents: 1200, maxCents: 1400 };

describe('resolvePrice', () => {
  it("uses the caregiver's price within the range", () => {
    expect(resolvePrice(1300, VISIT)).toBe(1300);
  });

  it('uses the suggested price when the caregiver set none (RN-CUI-17)', () => {
    expect(resolvePrice(null, VISIT)).toBe(1200);
  });

  it('keeps an old price within a range that changed since', () => {
    expect(resolvePrice(900, VISIT)).toBe(1000);
    expect(resolvePrice(1600, VISIT)).toBe(1400);
  });
});
