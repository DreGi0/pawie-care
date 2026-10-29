import {
  integer,
  InvalidSettingValueError,
  list,
  object,
  refine,
  text,
} from './setting-parsers.js';

describe('setting parsers', () => {
  describe('integer', () => {
    const percent = integer({ min: 0, max: 100 });

    it('accepts integers within the bounds', () => {
      expect(percent(0, 'x')).toBe(0);
      expect(percent(100, 'x')).toBe(100);
    });

    it.each([-1, 101, 2.5, '50', null, undefined, Number.NaN])('rejects %s', (value) => {
      expect(() => percent(value, 'pricing.fee')).toThrow(
        new InvalidSettingValueError('pricing.fee debe ser un número entero entre 0 y 100.'),
      );
    });
  });

  describe('list', () => {
    const codes = list(text);

    it('accepts a list, empty or not, of texts', () => {
      expect(codes([], 'c')).toEqual([]);
      expect(codes(['FIRST_AID'], 'c')).toEqual(['FIRST_AID']);
    });

    it('names the item that fails', () => {
      expect(() => codes(['FIRST_AID', ' '], 'c')).toThrow(
        new InvalidSettingValueError('c[1] debe ser un texto.'),
      );
    });

    it.each([null, 'FIRST_AID', { length: 0 }])('rejects %j, which is not a list', (value) => {
      expect(() => codes(value, 'c')).toThrow(
        new InvalidSettingValueError('c debe ser una lista.'),
      );
    });
  });

  describe('object', () => {
    const window = object({
      start: integer({ min: 0, max: 10 }),
      end: integer({ min: 0, max: 10 }),
    });

    it('returns exactly the declared properties', () => {
      expect(window({ end: 5, start: 1 }, 'w')).toEqual({ start: 1, end: 5 });
    });

    it('names the property that fails', () => {
      expect(() => window({ start: 1 }, 'w')).toThrow('w.end debe ser un número entero');
    });

    it('rejects properties it does not declare', () => {
      expect(() => window({ start: 1, end: 2, middle: 3 }, 'w')).toThrow(
        'w no admite la propiedad middle.',
      );
    });

    it.each([null, [], 3, 'x'])('rejects %j, which is not an object', (value) => {
      expect(() => window(value, 'w')).toThrow(
        'w debe ser un objeto con las propiedades start, end.',
      );
    });
  });

  describe('refine', () => {
    const even = refine(integer({ min: 0, max: 10 }), (value) => value % 2 === 0, 'debe ser par.');

    it('adds a check after parsing', () => {
      expect(even(4, 'n')).toBe(4);
      expect(() => even(3, 'n')).toThrow('n: debe ser par.');
      expect(() => even(11, 'n')).toThrow('n debe ser un número entero entre 0 y 10.');
    });
  });
});
