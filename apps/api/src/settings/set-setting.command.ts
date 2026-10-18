import { userInfo } from 'node:os';
import { parseArgs } from 'node:util';
import { InvalidSettingValueError } from './setting-parsers.js';
import { isSettingKey, SETTING_KEYS, SETTINGS } from './settings.registry.js';
import type { SettingsService } from './settings.service.js';

const USAGE = `Uso: pnpm settings:set <clave> <valor en JSON> [--by <quién>] [--reason <motivo>]

  --by      Quién hace el cambio. Por defecto, el usuario del sistema.
  --reason  Por qué, para el historial.

Ejemplo: pnpm settings:set pricing.ownerServiceFeeBp 1200 --by Ana --reason "Prueba de precios"`;

export interface CommandOutput {
  log(message: string): void;
  error(message: string): void;
}

/**
 * `pnpm settings:set`: validates a new value for a setting, saves it and records the
 * change. Returns the exit code. The messages are for the person running it, in
 * Spanish.
 */
export async function setSettingCommand(
  args: string[],
  settings: SettingsService,
  output: CommandOutput = console,
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: { by: { type: 'string' }, reason: { type: 'string' } },
    });
  } catch (error) {
    output.error(`${(error as Error).message}\n\n${USAGE}`);
    return 1;
  }

  const [key, rawValue, ...extra] = parsed.positionals;
  if (key === undefined || rawValue === undefined || extra.length > 0) {
    output.error(USAGE);
    return 1;
  }
  if (!isSettingKey(key)) {
    const available = SETTING_KEYS.map(
      (name) => `  ${name}: ${SETTINGS[name].description} (${SETTINGS[name].rules.join(', ')})`,
    );
    output.error(`No existe el parámetro ${key}. Estos son los que hay:\n${available.join('\n')}`);
    return 1;
  }

  let value: unknown;
  try {
    value = JSON.parse(rawValue);
  } catch {
    output.error(
      `El valor debe estar en JSON, como 1200 o {"startMinute":1140,"endMinute":480}. Recibí: ${rawValue}\n` +
        `En Windows PowerShell 5.1, escapa las comillas internas: '{\\"startMinute\\":1140,\\"endMinute\\":480}'`,
    );
    return 1;
  }

  try {
    const update = await settings.set(key, value, {
      changedBy: parsed.values.by ?? userInfo().username,
      reason: parsed.values.reason,
    });
    output.log(
      update.changed
        ? `${key}: ${JSON.stringify(update.previousValue)} → ${JSON.stringify(update.value)}`
        : `${key} ya vale ${JSON.stringify(update.value)}. No se cambió nada.`,
    );
    return 0;
  } catch (error) {
    if (error instanceof InvalidSettingValueError) {
      output.error(`No se guardó: ${error.message}`);
      return 1;
    }
    throw error;
  }
}
