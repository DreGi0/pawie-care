import { InvalidSettingValueError } from '../src/settings/setting-parsers.js';
import { SETTING_KEYS, SETTINGS } from '../src/settings/settings.registry.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { createTestDatabase, type TestDatabase } from './database.js';

describe('SettingsService', () => {
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

  const author = { changedBy: 'test', reason: 'Prueba' };

  function historyOf(key: string, prisma = db.prisma) {
    return prisma.settingChange.findMany({
      where: { settingKey: key },
      orderBy: { createdAt: 'asc' },
    });
  }

  it('creates the missing settings with their initial values, once', async () => {
    const empty = await createTestDatabase();
    const fresh = new SettingsService(empty.prisma);
    try {
      expect(await fresh.createMissing({ changedBy: 'seed' })).toEqual(SETTING_KEYS);
      expect(await fresh.get('bookings.maxPetsPerBooking')).toBe(3);
      expect(await historyOf('bookings.maxPetsPerBooking', empty.prisma)).toMatchObject([
        { previousValue: null, newValue: 3, changedBy: 'seed' },
      ]);
      expect(await fresh.createMissing({ changedBy: 'seed' })).toEqual([]);
    } finally {
      await empty.close();
    }
  });

  it('saves a valid value and records who changed it and what it was', async () => {
    const update = await settings.set('pricing.ownerServiceFeeBp', 1200, author);

    expect(update).toEqual({ previousValue: 1500, value: 1200, changed: true });
    expect(await settings.get('pricing.ownerServiceFeeBp')).toBe(1200);
    expect((await historyOf('pricing.ownerServiceFeeBp')).at(-1)).toMatchObject({
      previousValue: 1500,
      newValue: 1200,
      changedBy: 'test',
      reason: 'Prueba',
    });
  });

  it('rejects an invalid value without saving it', async () => {
    const before = await historyOf('pricing.caregiverCommissionBp');

    await expect(settings.set('pricing.caregiverCommissionBp', 15.5, author)).rejects.toThrow(
      InvalidSettingValueError,
    );
    expect(await settings.get('pricing.caregiverCommissionBp')).toBe(0);
    expect(await historyOf('pricing.caregiverCommissionBp')).toEqual(before);
  });

  it('writes nothing when the value does not change', async () => {
    const before = await historyOf('services.overnightHours');
    const { initialValue } = SETTINGS['services.overnightHours'];

    const update = await settings.set('services.overnightHours', { ...initialValue }, author);

    expect(update.changed).toBe(false);
    expect(await historyOf('services.overnightHours')).toEqual(before);
  });

  it('reads several settings at once, each one validated', async () => {
    const values = await settings.getMany([
      'bookings.maxPetsPerBooking',
      'services.overnightHours',
    ]);

    expect(values).toEqual({
      'bookings.maxPetsPerBooking': 3,
      'services.overnightHours': { startMinute: 1140, endMinute: 480 },
    });
  });

  it('refuses to read a stored value that is no longer valid', async () => {
    await db.prisma.setting.update({
      where: { key: 'payments.gatewayFeeBp' },
      data: { value: '3.5%' },
    });

    await expect(settings.get('payments.gatewayFeeBp')).rejects.toThrow(
      'payments.gatewayFeeBp debe ser un número entero entre 0 y 10000.',
    );
    await expect(settings.getMany(['pricing.vatBp', 'payments.gatewayFeeBp'])).rejects.toThrow(
      'payments.gatewayFeeBp debe ser un número entero entre 0 y 10000.',
    );
  });

  it('refuses to read a setting that was never created', async () => {
    await db.prisma.settingChange.deleteMany({
      where: { settingKey: 'reviews.writingWindowDays' },
    });
    await db.prisma.setting.delete({ where: { key: 'reviews.writingWindowDays' } });

    await expect(settings.get('reviews.writingWindowDays')).rejects.toThrow(
      'Falta el parámetro reviews.writingWindowDays.',
    );
    await expect(settings.getMany(['pricing.vatBp', 'reviews.writingWindowDays'])).rejects.toThrow(
      'Falta el parámetro reviews.writingWindowDays.',
    );
  });
});
