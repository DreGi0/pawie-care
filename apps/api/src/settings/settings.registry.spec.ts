import { readFileSync } from 'node:fs';
import { InvalidSettingValueError } from './setting-parsers.js';
import { isSettingKey, parseSettingValue, SETTING_KEYS, SETTINGS } from './settings.registry.js';

const RULES_DOCUMENT = new URL('../../../../docs/reglas-de-negocio.md', import.meta.url);

/** Rows of the table in §15, as [parameter, initial value, rule]. */
function section15Rows(): string[][] {
  const document = readFileSync(RULES_DOCUMENT, 'utf8');
  const section = document.slice(document.indexOf('## 15.'), document.indexOf('## 16.'));
  return section
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .slice(2) // header and separator
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
}

describe('settings registry', () => {
  it('has one setting per parameter of §15, citing its rule first', () => {
    const rulesInDocument = section15Rows().map(([, , rule]) => rule);
    const rulesInRegistry = SETTING_KEYS.map((key) => SETTINGS[key].rules[0]);

    expect(rulesInDocument.length).toBeGreaterThan(20);
    expect(rulesInRegistry.toSorted()).toEqual(rulesInDocument.toSorted());
  });

  it.each(SETTING_KEYS)('%s starts with a valid initial value', (key) => {
    const { initialValue } = SETTINGS[key];

    expect(parseSettingValue(key, initialValue)).toEqual(initialValue);
  });

  it.each(SETTING_KEYS)('%s cites rules by their ID and describes itself', (key) => {
    const { rules, description } = SETTINGS[key];

    for (const rule of rules) {
      expect(rule).toMatch(/^RN-[A-Z]{3}-\d{2}$/);
    }
    expect(description.length).toBeGreaterThan(2);
  });

  it('recognizes its keys', () => {
    expect(isSettingKey('pricing.ownerServiceFeeBp')).toBe(true);
    expect(isSettingKey('pricing.unknown')).toBe(false);
    expect(isSettingKey('toString')).toBe(false);
  });

  describe('validators', () => {
    it('rejects a price range out of order (RN-PRE-01)', () => {
      const ranges = structuredClone(SETTINGS['pricing.priceRanges'].initialValue);
      ranges.HOME_VISIT.SPECIAL.suggestedCents = 2500;

      expect(() => parseSettingValue('pricing.priceRanges', ranges)).toThrow(
        new InvalidSettingValueError(
          'pricing.priceRanges.HOME_VISIT.SPECIAL: debe cumplir minCents ≤ suggestedCents ≤ maxCents.',
        ),
      );
    });

    it('requires a price range for every service and level', () => {
      const { HOME_VISIT } = SETTINGS['pricing.priceRanges'].initialValue;

      expect(() => parseSettingValue('pricing.priceRanges', { HOME_VISIT })).toThrow(
        'pricing.priceRanges.OVERNIGHT_STAY debe ser un objeto',
      );
    });

    it('requires the overnight to end the next day (RN-SER-02)', () => {
      expect(() =>
        parseSettingValue('services.overnightHours', { startMinute: 480, endMinute: 1140 }),
      ).toThrow('endMinute debe ser menor que startMinute');
    });

    it('keeps percentages in basis points', () => {
      expect(() => parseSettingValue('pricing.caregiverCommissionBp', 0.15)).toThrow(
        InvalidSettingValueError,
      );
      expect(() => parseSettingValue('pricing.caregiverCommissionBp', 10_001)).toThrow(
        InvalidSettingValueError,
      );
    });
  });
});
