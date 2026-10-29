import { CaregiverLevel } from '../generated/prisma/enums.js';
import { SETTINGS } from '../settings/settings.registry.js';
import { caregiverLevel, type LevelInput } from './caregiver-level.js';

const REQUIREMENTS = SETTINGS['levels.requirements'].initialValue;
const { NEW, TRUSTED, PRO, SUPER } = CaregiverLevel;

/** A caregiver who meets Súper Cuidador exactly, so each test breaks one thing. */
const SUPER_INPUT: LevelInput = {
  ratingCount: 5,
  ratingSum: 24, // 4.8
  completedBookingCount: 40,
  certificationCodes: ['SPECIAL_CARE', 'FIRST_AID', 'CATS'],
};
const levelOf = (changes: Partial<LevelInput>) =>
  caregiverLevel({ ...SUPER_INPUT, ...changes }, REQUIREMENTS).level;

describe('caregiverLevel (RN-NIV-02)', () => {
  it('is Nuevo without reviews, services or certifications', () => {
    expect(
      caregiverLevel(
        { ratingCount: 0, ratingSum: 0, completedBookingCount: 0, certificationCodes: [] },
        REQUIREMENTS,
      ).level,
    ).toBe(NEW);
  });

  describe('Confiable: 3 reviews and 4.5', () => {
    it.each([
      { ratingCount: 3, ratingSum: 14, level: TRUSTED }, // 4.67
      { ratingCount: 4, ratingSum: 18, level: TRUSTED }, // exactly 4.5
      { ratingCount: 2, ratingSum: 10, level: NEW }, // perfect, but only 2 reviews
      { ratingCount: 4, ratingSum: 17, level: NEW }, // 4.25
      { ratingCount: 100, ratingSum: 449, level: NEW }, // 4.49
    ])('$ratingCount reviews adding $ratingSum is $level', ({ level, ...ratings }) => {
      const input = { ...ratings, completedBookingCount: 0, certificationCodes: [] };

      expect(caregiverLevel(input, REQUIREMENTS).level).toBe(level);
    });
  });

  describe('Pro: 4.6, 15 services and 2 certifications', () => {
    const pro = { ratingCount: 5, ratingSum: 23, completedBookingCount: 15 }; // exactly 4.6
    const twoCertifications = ['SPECIAL_CARE', 'LARGE_DOGS'];

    it('is reached exactly at the thresholds', () => {
      expect(levelOf({ ...pro, certificationCodes: twoCertifications })).toBe(PRO);
    });

    it.each([
      ['4.59', { ratingCount: 100, ratingSum: 459 }],
      ['14 services', { completedBookingCount: 14 }],
      ['1 certification', { certificationCodes: ['SPECIAL_CARE'] }],
    ])('is only Confiable with %s', (_, short) => {
      expect(levelOf({ ...pro, certificationCodes: twoCertifications, ...short })).toBe(TRUSTED);
    });
  });

  describe('Súper Cuidador: 4.8, 40 services and 3 certifications with Primeros auxilios', () => {
    it('is reached exactly at the thresholds', () => {
      expect(levelOf({})).toBe(SUPER);
    });

    it.each([
      ['4.79', { ratingCount: 100, ratingSum: 479 }],
      ['39 services', { completedBookingCount: 39 }],
      ['2 certifications', { certificationCodes: ['SPECIAL_CARE', 'FIRST_AID'] }],
      [
        '3 certifications but not Primeros auxilios',
        { certificationCodes: ['SPECIAL_CARE', 'LARGE_DOGS', 'CATS'] },
      ],
    ])('is only Pro with %s', (_, short) => {
      expect(levelOf(short)).toBe(PRO);
    });

    it('does not count the same certification twice', () => {
      expect(levelOf({ certificationCodes: ['FIRST_AID', 'FIRST_AID', 'CATS'] })).toBe(PRO);
    });
  });

  describe('can go down (RN-NIV-04)', () => {
    it('when a certification is no longer valid', () => {
      expect(levelOf({})).toBe(SUPER);
      expect(levelOf({ certificationCodes: ['SPECIAL_CARE', 'FIRST_AID'] })).toBe(PRO);
      expect(levelOf({ certificationCodes: ['FIRST_AID'] })).toBe(TRUSTED);
    });

    it('when a bad review lowers the average', () => {
      expect(levelOf({ ratingCount: 6, ratingSum: 25 })).toBe(NEW); // 4.17 after a 1-star review
    });
  });

  describe('what is missing for the next level (RN-NIV-05)', () => {
    it('lists every requirement the caregiver does not meet', () => {
      const result = caregiverLevel(
        {
          ratingCount: 10,
          ratingSum: 47,
          completedBookingCount: 10,
          certificationCodes: ['SPECIAL_CARE'],
        },
        REQUIREMENTS,
      );

      expect(result).toEqual({
        level: TRUSTED,
        next: {
          level: PRO,
          // The 4.7 average already meets Pro's 4.6, so it isn't listed.
          missing: [
            { kind: 'completedBookings', current: 10, required: 15 },
            { kind: 'certifications', current: 1, required: 2 },
          ],
        },
      });
    });

    it('rounds the average down, so it never shows a figure that meets the requirement', () => {
      const { next } = caregiverLevel(
        { ratingCount: 100, ratingSum: 459, completedBookingCount: 15, certificationCodes: [] },
        REQUIREMENTS,
      );

      expect(next?.missing).toContainEqual({
        kind: 'averageRatingTenths',
        current: 45,
        required: 46,
      });
    });

    it('names the certification Súper Cuidador asks for', () => {
      const { level, next } = caregiverLevel(
        { ...SUPER_INPUT, certificationCodes: ['SPECIAL_CARE', 'LARGE_DOGS', 'CATS'] },
        REQUIREMENTS,
      );

      expect(level).toBe(PRO);
      expect(next).toEqual({
        level: SUPER,
        missing: [{ kind: 'certification', code: 'FIRST_AID' }],
      });
    });

    it('starts at Confiable for a new caregiver', () => {
      const { next } = caregiverLevel(
        { ratingCount: 0, ratingSum: 0, completedBookingCount: 0, certificationCodes: [] },
        REQUIREMENTS,
      );

      expect(next).toEqual({
        level: TRUSTED,
        missing: [
          { kind: 'reviews', current: 0, required: 3 },
          { kind: 'averageRatingTenths', current: 0, required: 45 },
        ],
      });
    });

    it('has nothing after Súper Cuidador', () => {
      expect(caregiverLevel(SUPER_INPUT, REQUIREMENTS).next).toBeNull();
    });
  });
});
