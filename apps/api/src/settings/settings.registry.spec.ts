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
    // §15 already lists the parameters of the later stages (docs/plan-v0.5.md). Remove each
    // rule from here when its stage adds the setting.
    const comesLater = [
      'RN-SER-05', // stage 8
      'RN-EJE-03', // stage 10
      'RN-EJE-06', // stage 10
      'RN-SOP-03', // stage 12a
      'RN-GAR-01', // stage 12b
      'RN-GAR-03', // stage 12b
    ];
    // Replaced by the stage that renames them (§2 of the plan): disputes.resolutionBusinessDays.
    const replacedLater = ['RN-DIS-02'];

    const rulesInRegistry: string[] = SETTING_KEYS.map((key) => SETTINGS[key].rules[0]).filter(
      (rule) => !replacedLater.includes(rule),
    );
    // A row can cite several rules; the setting cites one of them first.
    const rulesInDocument = section15Rows()
      .map(([, , rule]) => rule.split(',').map((id) => id.trim()))
      .filter((ids) => !ids.some((id) => comesLater.includes(id)))
      .map((ids) => ids.find((id) => rulesInRegistry.includes(id)) ?? ids[0]);

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
      ranges.HOME_VISIT.SUPER.suggestedCents = 2500;

      expect(() => parseSettingValue('pricing.priceRanges', ranges)).toThrow(
        new InvalidSettingValueError(
          'pricing.priceRanges.HOME_VISIT.SUPER: debe cumplir minCents ≤ suggestedCents ≤ maxCents.',
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
