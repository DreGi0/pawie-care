import { CareTask } from '../generated/prisma/enums.js';
import { careLevelOn, type DatedCareNeed } from './care-level.js';

const date = (value: string) => new Date(`${value}T00:00:00Z`);
const need = (task: CareTask, startsOn: string, endsOn: string | null): DatedCareNeed => ({
  task,
  startsOn: date(startsOn),
  endsOn: endsOn === null ? null : date(endsOn),
});

describe('careLevelOn', () => {
  const from = date('2026-11-10');
  const to = date('2026-11-12');

  it('is standard without care needs, whatever the age (RN-MAS-07)', () => {
    expect(careLevelOn([], from, to)).toEqual({
      careLevel: 'STANDARD',
      specialTasks: [],
      prohibitedTasks: [],
    });
  });

  it('is special while a clinical or assistance task is active (RN-MAS-06)', () => {
    const needs = [
      need(CareTask.MEDICATION, '2026-11-01', '2026-11-10'),
      need(CareTask.MOBILITY_ASSISTANCE, '2026-01-01', null),
    ];

    expect(careLevelOn(needs, from, to)).toMatchObject({
      careLevel: 'SPECIAL',
      specialTasks: [CareTask.MEDICATION, CareTask.MOBILITY_ASSISTANCE],
    });
  });

  it('stops counting a task once its dates are over (RN-MAS-05)', () => {
    const recovery = [need(CareTask.POST_OPERATIVE_RECOVERY, '2026-10-20', '2026-11-09')];

    expect(careLevelOn(recovery, from, to).careLevel).toBe('STANDARD');
    expect(careLevelOn(recovery, date('2026-11-09'), to).careLevel).toBe('SPECIAL');
  });

  it('counts a task that starts on the last day of the service', () => {
    const needs = [need(CareTask.WOUND_CARE, '2026-11-12', '2026-11-20')];

    expect(careLevelOn(needs, from, to).careLevel).toBe('SPECIAL');
    expect(careLevelOn(needs, from, date('2026-11-11')).careLevel).toBe('STANDARD');
  });

  it('reports prohibited tasks apart, without making the pet special (RN-MAS-09)', () => {
    const needs = [
      need(CareTask.INJECTION, '2025-01-01', null),
      need(CareTask.INJECTION, '2026-11-01', null),
      need(CareTask.IV_FLUIDS, '2026-12-01', null),
    ];

    expect(careLevelOn(needs, from, to)).toEqual({
      careLevel: 'STANDARD',
      specialTasks: [],
      prohibitedTasks: [CareTask.INJECTION],
    });
  });
});
