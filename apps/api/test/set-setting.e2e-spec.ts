import { setSettingCommand } from '../src/settings/set-setting.command.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { createTestDatabase, type TestDatabase } from './database.js';

describe('pnpm settings:set', () => {
  let db: TestDatabase;
  let settings: SettingsService;

  beforeAll(async () => {
    db = await createTestDatabase();
    settings = new SettingsService(db.prisma);
    await settings.createMissing({ changedBy: 'seed' });
  });

  afterAll(async () => {
    await db.close();
  });

  /** Runs the command as the script does, capturing what it prints. */
  async function run(...args: string[]) {
    const output = { log: [] as string[], error: [] as string[] };
    const exitCode = await setSettingCommand(args, settings, {
      log: (message) => output.log.push(message),
      error: (message) => output.error.push(message),
    });
    return { exitCode, ...output };
  }

  function lastChange(key: string) {
    return db.prisma.settingChange.findFirst({
      where: { settingKey: key },
      orderBy: { createdAt: 'desc' },
    });
  }

  it('saves a valid value and records the change', async () => {
    const result = await run(
      'services.overnightHours',
      '{"startMinute":1200,"endMinute":480}',
      '--by',
      'Ana',
      '--reason',
      'La pernocta empieza a las 20:00',
    );

    expect(result).toEqual({
      exitCode: 0,
      log: [
        'services.overnightHours: {"endMinute":480,"startMinute":1140} → {"startMinute":1200,"endMinute":480}',
      ],
      error: [],
    });
    expect(await settings.get('services.overnightHours')).toEqual({
      startMinute: 1200,
      endMinute: 480,
    });
    expect(await lastChange('services.overnightHours')).toMatchObject({
      previousValue: { startMinute: 1140, endMinute: 480 },
      newValue: { startMinute: 1200, endMinute: 480 },
      changedBy: 'Ana',
      reason: 'La pernocta empieza a las 20:00',
    });
  });

  it('rejects an invalid value and leaves the setting and its history as they were', async () => {
    const before = await lastChange('pricing.ownerServiceFeeBp');

    const result = await run('pricing.ownerServiceFeeBp', '0.1', '--by', 'Ana');

    expect(result.exitCode).toBe(1);
    expect(result.error).toEqual([
      'No se guardó: pricing.ownerServiceFeeBp debe ser un número entero entre 0 y 10000.',
    ]);
    expect(await settings.get('pricing.ownerServiceFeeBp')).toBe(1000);
    expect(await lastChange('pricing.ownerServiceFeeBp')).toEqual(before);
  });

  it('lists the settings when the key does not exist', async () => {
    const result = await run('pricing.discountBp', '500');

    expect(result.exitCode).toBe(1);
    expect(result.error[0]).toContain('No existe el parámetro pricing.discountBp.');
    expect(result.error[0]).toContain('pricing.ownerServiceFeeBp: Tarifa de servicio al dueño');
  });

  it('asks for JSON', async () => {
    const result = await run('services.overnightHours', '{startMinute:1140,endMinute:480}');

    expect(result.exitCode).toBe(1);
    expect(result.error[0]).toContain('El valor debe estar en JSON');
  });

  it('shows how to use it when arguments are missing or unknown', async () => {
    for (const args of [[], ['bookings.maxPetsPerBooking'], ['a', '1', '--force']]) {
      const result = await run(...args);

      expect(result.exitCode).toBe(1);
      expect(result.error.join('\n')).toContain('Uso: pnpm settings:set');
    }
  });

  it('says so when the value is already the current one', async () => {
    const result = await run('bookings.maxPetsPerBooking', '3');

    expect(result).toMatchObject({
      exitCode: 0,
      log: ['bookings.maxPetsPerBooking ya vale 3. No se cambió nada.'],
    });
  });
});
