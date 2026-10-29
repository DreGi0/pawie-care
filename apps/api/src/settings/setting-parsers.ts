/**
 * Validators for the values of the settings, which arrive as untrusted JSON from the
 * database or the settings:set script. A parser returns the value with its type, or
 * throws InvalidSettingValueError. The messages are in Spanish because the script shows
 * them to whoever is changing a setting.
 */
export type SettingParser<T> = (value: unknown, path: string) => T;

export class InvalidSettingValueError extends Error {
  override readonly name = 'InvalidSettingValueError';
}

export function integer({ min, max }: { min: number; max: number }): SettingParser<number> {
  return (value, path) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      throw new InvalidSettingValueError(
        `${path} debe ser un número entero entre ${min} y ${max}.`,
      );
    }
    return value;
  };
}

/** A percentage in basis points: 1500 is 15%. */
export const basisPoints = integer({ min: 0, max: 10_000 });

/** A time of day in minutes since midnight, America/El_Salvador. */
export const minuteOfDay = integer({ min: 0, max: 24 * 60 - 1 });

/** A text that isn't blank. */
export const text: SettingParser<string> = (value, path) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new InvalidSettingValueError(`${path} debe ser un texto.`);
  }
  return value;
};

/** A list whose items all pass `item`. */
export function list<T>(item: SettingParser<T>): SettingParser<T[]> {
  return (value, path) => {
    if (!Array.isArray(value)) {
      throw new InvalidSettingValueError(`${path} debe ser una lista.`);
    }
    return value.map((entry, index) => item(entry, `${path}[${index}]`));
  };
}

/** An object with exactly these properties. */
export function object<Shape extends Record<string, SettingParser<unknown>>>(
  shape: Shape,
): SettingParser<{ [K in keyof Shape]: ReturnType<Shape[K]> }> {
  const keys = Object.keys(shape);
  return (value, path) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new InvalidSettingValueError(
        `${path} debe ser un objeto con las propiedades ${keys.join(', ')}.`,
      );
    }
    const extra = Object.keys(value).filter((key) => !Object.hasOwn(shape, key));
    if (extra.length > 0) {
      throw new InvalidSettingValueError(`${path} no admite la propiedad ${extra.join(', ')}.`);
    }
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      keys.map((key) => [key, shape[key](record[key], `${path}.${key}`)]),
    ) as { [K in keyof Shape]: ReturnType<Shape[K]> };
  };
}

/** Adds a check that involves the whole value, such as the order of two properties. */
export function refine<T>(
  parse: SettingParser<T>,
  isValid: (value: T) => boolean,
  message: string,
): SettingParser<T> {
  return (value, path) => {
    const parsed = parse(value, path);
    if (!isValid(parsed)) {
      throw new InvalidSettingValueError(`${path}: ${message}`);
    }
    return parsed;
  };
}
