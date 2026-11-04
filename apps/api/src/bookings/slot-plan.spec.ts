import { ServiceCode } from '../generated/prisma/enums.js';
import { planSlots, type ScheduleRules, serviceDates } from './slot-plan.js';

const RULES: ScheduleRules = {
  homeVisitMinutes: 60,
  walkMinutes: 45,
  overnightStartMinute: 19 * 60,
  overnightEndMinute: 8 * 60,
  minLeadTimeMinutes: 120,
};
const NOW = new Date('2026-11-01T12:00:00-06:00');
const sv = (dateTime: string) => new Date(`${dateTime}-06:00`);

function errorOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    return (error as { getResponse(): unknown }).getResponse();
  }
  throw new Error('Expected planSlots to fail');
}

describe('planSlots', () => {
  it('turns each night into 19:00 to 08:00 of the next day (RN-SER-02)', () => {
    const slots = planSlots(
      { serviceCode: ServiceCode.OVERNIGHT_STAY, nights: ['2026-11-21', '2026-11-20'] },
      RULES,
      NOW,
    );

    expect(slots).toEqual([
      {
        serviceCode: 'OVERNIGHT_STAY',
        startsAt: sv('2026-11-20T19:00'),
        endsAt: sv('2026-11-21T08:00'),
      },
      {
        serviceCode: 'OVERNIGHT_STAY',
        startsAt: sv('2026-11-21T19:00'),
        endsAt: sv('2026-11-22T08:00'),
      },
    ]);
  });

  it('gives each visit the full visit time (RN-SER-01)', () => {
    const slots = planSlots(
      {
        serviceCode: ServiceCode.HOME_VISIT,
        visits: ['2026-11-20T09:00:00-06:00', '2026-11-20T17:30:00-06:00'],
      },
      RULES,
      NOW,
    );

    expect(slots.map(({ startsAt, endsAt }) => [startsAt, endsAt])).toEqual([
      [sv('2026-11-20T09:00'), sv('2026-11-20T10:00')],
      [sv('2026-11-20T17:30'), sv('2026-11-20T18:30')],
    ]);
  });

  it('adds daytime visits to a stay as visit slots (RN-SER-03)', () => {
    const slots = planSlots(
      {
        serviceCode: ServiceCode.OVERNIGHT_STAY,
        nights: ['2026-11-20', '2026-11-21'],
        visits: ['2026-11-21T12:00:00-06:00'],
      },
      RULES,
      NOW,
    );

    expect(slots.map(({ serviceCode }) => serviceCode)).toEqual([
      'OVERNIGHT_STAY',
      'HOME_VISIT',
      'OVERNIGHT_STAY',
    ]);
  });

  it('rejects visits outside the stay, and slots that overlap (RN-CUI-15)', () => {
    const stay = { serviceCode: ServiceCode.OVERNIGHT_STAY, nights: ['2026-11-20'] };

    expect(
      errorOf(() => planSlots({ ...stay, visits: ['2026-11-25T12:00:00-06:00'] }, RULES, NOW)),
    ).toMatchObject({
      errorCode: 'INVALID_SCHEDULE',
    });
    expect(
      errorOf(() =>
        planSlots(
          { ...stay, nights: ['2026-11-20', '2026-11-21'], visits: ['2026-11-21T07:30:00-06:00'] },
          RULES,
          NOW,
        ),
      ),
    ).toMatchObject({
      errorCode: 'INVALID_SCHEDULE',
      message:
        'Dos de los horarios se cruzan. Cada paseo, cada visita y cada noche van por separado.',
    });
    expect(
      errorOf(() =>
        planSlots(
          {
            serviceCode: ServiceCode.HOME_VISIT,
            visits: ['2026-11-20T09:00:00-06:00', '2026-11-20T09:30:00-06:00'],
          },
          RULES,
          NOW,
        ),
      ),
    ).toMatchObject({ errorCode: 'INVALID_SCHEDULE' });
  });

  describe('walks (RN-SER-05)', () => {
    const walk = (...walks: string[]) => ({
      serviceCode: ServiceCode.WALK,
      walks: walks.map((time) => `2026-11-20T${time}:00-06:00`),
    });

    it('gives each walk the walk time, and several fit in a day', () => {
      const slots = planSlots(walk('17:00', '07:00'), RULES, NOW);

      expect(slots).toEqual([
        { serviceCode: 'WALK', startsAt: sv('2026-11-20T07:00'), endsAt: sv('2026-11-20T07:45') },
        { serviceCode: 'WALK', startsAt: sv('2026-11-20T17:00'), endsAt: sv('2026-11-20T17:45') },
      ]);
    });

    it('lets a walk start right when the previous one ends, but not before (RN-CUI-15)', () => {
      expect(planSlots(walk('07:00', '07:45'), RULES, NOW)).toHaveLength(2);
      expect(errorOf(() => planSlots(walk('07:00', '07:44'), RULES, NOW))).toMatchObject({
        errorCode: 'INVALID_SCHEDULE',
      });
      expect(errorOf(() => planSlots(walk('07:00', '07:00'), RULES, NOW))).toMatchObject({
        errorCode: 'INVALID_SCHEDULE',
      });
    });

    it('takes the walk time from the rules', () => {
      const [slot] = planSlots(walk('07:00'), { ...RULES, walkMinutes: 30 }, NOW);

      expect(slot.endsAt).toEqual(sv('2026-11-20T07:30'));
    });

    it('has only walks, and walks only go in a walk booking', () => {
      expect(errorOf(() => planSlots({ serviceCode: ServiceCode.WALK }, RULES, NOW))).toEqual({
        errorCode: 'INVALID_SCHEDULE',
        message: 'Elige cuándo empieza cada paseo.',
      });
      expect(
        errorOf(() =>
          planSlots({ ...walk('07:00'), visits: ['2026-11-20T09:00:00-06:00'] }, RULES, NOW),
        ),
      ).toMatchObject({ message: 'Un paseo no lleva noches ni visitas.' });
      expect(
        errorOf(() => planSlots({ ...walk('07:00'), nights: ['2026-11-20'] }, RULES, NOW)),
      ).toMatchObject({ message: 'Un paseo no lleva noches ni visitas.' });
      for (const serviceCode of [ServiceCode.HOME_VISIT, ServiceCode.OVERNIGHT_STAY]) {
        expect(
          errorOf(() =>
            planSlots(
              {
                serviceCode,
                nights: ['2026-11-20'],
                visits: ['2026-11-20T09:00:00-06:00'],
                walks: ['2026-11-20T07:00:00-06:00'],
              },
              RULES,
              NOW,
            ),
          ),
        ).toMatchObject({ message: 'Los paseos van en una reserva de paseo.' });
      }
    });

    it('needs the minimum lead time (RN-RES-05)', () => {
      const today = (time: string) => ({
        serviceCode: ServiceCode.WALK,
        walks: [`2026-11-01T${time}:00-06:00`],
      });

      expect(planSlots(today('14:00'), RULES, NOW)).toHaveLength(1);
      expect(errorOf(() => planSlots(today('13:59'), RULES, NOW))).toMatchObject({
        errorCode: 'TOO_SOON',
      });
    });
  });

  it('lets one visit start right when the previous one ends', () => {
    const slots = planSlots(
      {
        serviceCode: ServiceCode.HOME_VISIT,
        visits: ['2026-11-20T09:00:00-06:00', '2026-11-20T10:00:00-06:00'],
      },
      RULES,
      NOW,
    );

    expect(slots).toHaveLength(2);
  });

  it('asks for what each service needs', () => {
    expect(
      errorOf(() => planSlots({ serviceCode: ServiceCode.HOME_VISIT }, RULES, NOW)),
    ).toMatchObject({
      message: 'Elige cuándo empieza cada visita.',
    });
    expect(
      errorOf(() =>
        planSlots(
          {
            serviceCode: ServiceCode.HOME_VISIT,
            nights: ['2026-11-20'],
            visits: ['2026-11-20T09:00:00-06:00'],
          },
          RULES,
          NOW,
        ),
      ),
    ).toMatchObject({ message: 'Una visita a domicilio no lleva noches.' });
    expect(
      errorOf(() => planSlots({ serviceCode: ServiceCode.OVERNIGHT_STAY }, RULES, NOW)),
    ).toMatchObject({
      message: 'Elige al menos una noche.',
    });
    expect(
      errorOf(() =>
        planSlots(
          { serviceCode: ServiceCode.OVERNIGHT_STAY, nights: ['2026-11-20', '2026-11-20'] },
          RULES,
          NOW,
        ),
      ),
    ).toMatchObject({ message: 'Elegiste la misma noche dos veces.' });
  });

  it('needs the minimum lead time before the first slot (RN-RES-05)', () => {
    const visit = (time: string) => ({
      serviceCode: ServiceCode.HOME_VISIT,
      visits: [`2026-11-01T${time}:00-06:00`],
    });

    expect(planSlots(visit('14:00'), RULES, NOW)).toHaveLength(1);
    expect(errorOf(() => planSlots(visit('13:59'), RULES, NOW))).toEqual({
      errorCode: 'TOO_SOON',
      message: 'Hay que pedir el servicio con al menos 2 h de anticipación.',
    });
  });
});

describe('serviceDates', () => {
  it('covers the morning an overnight ends on', () => {
    const slots = planSlots(
      { serviceCode: ServiceCode.OVERNIGHT_STAY, nights: ['2026-11-20'] },
      RULES,
      NOW,
    );

    expect(serviceDates(slots)).toEqual({
      from: new Date('2026-11-20'),
      to: new Date('2026-11-21'),
    });
  });

  it('keeps a visit ending at midnight on its own day', () => {
    const slots = planSlots(
      { serviceCode: ServiceCode.HOME_VISIT, visits: ['2026-11-20T23:00:00-06:00'] },
      RULES,
      NOW,
    );

    expect(serviceDates(slots)).toEqual({
      from: new Date('2026-11-20'),
      to: new Date('2026-11-20'),
    });
  });
});
