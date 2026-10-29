import { CaregiverSkill, ServiceCode } from '../generated/prisma/enums.js';
import type { CertificationCode, DistrictSlug } from './catalog.js';

export interface AvailabilityWindow {
  /** ISO day of the week: 1 is Monday and 7 is Sunday. */
  weekday: number;
  startMinute: number;
  /** Past 1440 when the window ends the next day. */
  endMinute: number;
}

export interface DemoCaregiver {
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  bio: string;
  /**
   * Months since the caregiver got each certification, fewer than its validity so it is
   * valid today. With the ratings and the completed services, they set the level
   * (RN-NIV-02): the comment above each caregiver says which one it is built for.
   */
  certifications?: Partial<Record<CertificationCode, number>>;
  /** RN-CUI-18: declared, not verified. */
  skills?: CaregiverSkill[];
  /** Months the student ID is still valid for. Absent for caregivers who aren't vet students. */
  vetStudentMonthsLeft?: number;
  districts: DistrictSlug[];
  /**
   * Price in cents for each service offered, within the range of the caregiver's level
   * (RN-PRE-01); null takes the suggested one.
   */
  prices: Partial<Record<ServiceCode, number | null>>;
  availability: AvailabilityWindow[];
  /** Fake ratings (RN-RSE, after the demo): count and sum of stars. */
  ratings: { count: number; sum: number; specialCount: number; specialSum: number };
  completedBookings: number;
}

const MONDAY_TO_FRIDAY = [1, 2, 3, 4, 5];
const WEEKEND = [6, 7];
const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];

/** The same window on several days. "19:00" to "08:00" ends the next day. */
function every(weekdays: number[], from: string, to: string): AvailabilityWindow[] {
  const startMinute = minutesOf(from);
  const end = minutesOf(to);
  const endMinute = end > startMinute ? end : end + 24 * 60;
  return weekdays.map((weekday) => ({ weekday, startMinute, endMinute }));
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

const { HOME_VISIT, OVERNIGHT_STAY } = ServiceCode;
const { LARGE_DOGS, CATS, PUPPIES, SENIOR_PETS, DIFFICULT_BEHAVIOR } = CaregiverSkill;

/**
 * Demo caregivers: approved, with instant booking (docs/reglas-de-negocio.md §2).
 * They mix the four profiles (⭐, vet student, both and neither), and Gabriela, Diego
 * and Sofía don't do overnight stays. They cover the four levels (RN-NIV-02, with the
 * initial requirements): Valeria is Súper Cuidador; Carlos, Gabriela and Ricardo are
 * Pro; Sofía is Nuevo; the rest are Confiable. Emails use example.com, a reserved domain.
 */
export const DEMO_CAREGIVERS: DemoCaregiver[] = [
  {
    email: 'valeria.martinez@example.com',
    firstName: 'Valeria',
    lastName: 'Martínez',
    birthDate: '2002-04-11',
    bio: 'Estudiante de último año de Medicina Veterinaria. Me especializo en perros mayores y en recuperaciones post-operatorias.',
    certifications: { SPECIAL_CARE: 5, FIRST_AID: 3, CATS: 2 },
    skills: [SENIOR_PETS, CATS],
    vetStudentMonthsLeft: 8,
    districts: ['san-salvador', 'antiguo-cuscatlan', 'santa-tecla'],
    prices: {
      [HOME_VISIT]: 1800,
      [OVERNIGHT_STAY]: 4000,
    },
    availability: [
      ...every(MONDAY_TO_FRIDAY, '14:00', '19:00'),
      ...every(WEEKEND, '08:00', '19:00'),
      ...every([5, 6], '19:00', '08:00'),
    ],
    ratings: { count: 46, sum: 223, specialCount: 18, specialSum: 88 },
    completedBookings: 52,
  },
  {
    email: 'carlos.hernandez@example.com',
    firstName: 'Carlos',
    lastName: 'Hernández',
    birthDate: '1988-09-02',
    bio: 'Cuidé por años a mi perro con insuficiencia renal. Hice el curso de cuidado especial de Pawie y ahora ayudo a otras familias.',
    certifications: { SPECIAL_CARE: 10, LARGE_DOGS: 4 },
    skills: [SENIOR_PETS],
    districts: ['santa-tecla', 'antiguo-cuscatlan', 'san-salvador'],
    prices: {
      [HOME_VISIT]: null,
      [OVERNIGHT_STAY]: 3000,
    },
    availability: [...every(EVERY_DAY, '07:00', '19:00'), ...every(EVERY_DAY, '19:00', '08:00')],
    ratings: { count: 71, sum: 337, specialCount: 30, specialSum: 144 },
    completedBookings: 80,
  },
  {
    email: 'andrea.lopez@example.com',
    firstName: 'Andrea',
    lastName: 'López',
    birthDate: '2005-01-23',
    bio: 'Estudio Medicina Veterinaria y Zootecnia. Me encantan los gatos y tengo experiencia con mascotas tímidas.',
    vetStudentMonthsLeft: 10,
    skills: [CATS, PUPPIES],
    districts: ['mejicanos', 'san-salvador', 'ayutuxtepeque'],
    prices: {
      [HOME_VISIT]: 1100,
      [OVERNIGHT_STAY]: 2200,
    },
    availability: [
      ...every(MONDAY_TO_FRIDAY, '15:00', '19:00'),
      ...every([6], '08:00', '18:00'),
      ...every([5, 6], '19:00', '08:00'),
    ],
    ratings: { count: 12, sum: 57, specialCount: 0, specialSum: 0 },
    completedBookings: 14,
  },
  {
    email: 'jose.ramirez@example.com',
    firstName: 'José',
    lastName: 'Ramírez',
    birthDate: '1981-06-30',
    bio: 'Tengo tres perros rescatados y mucha paciencia. Vivo en Soyapango y me muevo rápido por la zona oriente.',
    skills: [LARGE_DOGS, DIFFICULT_BEHAVIOR],
    districts: ['soyapango', 'ilopango', 'san-martin'],
    prices: {
      [HOME_VISIT]: 1000,
      [OVERNIGHT_STAY]: 2000,
    },
    availability: [
      ...every([1, 2, 3, 4, 5, 6], '06:00', '18:00'),
      ...every(EVERY_DAY, '19:00', '08:00'),
    ],
    ratings: { count: 33, sum: 151, specialCount: 0, specialSum: 0 },
    completedBookings: 37,
  },
  {
    email: 'gabriela.flores@example.com',
    firstName: 'Gabriela',
    lastName: 'Flores',
    birthDate: '1993-11-15',
    bio: 'Fui asistente en una clínica veterinaria por seis años. Hago visitas de día; no hago pernoctas.',
    certifications: { SPECIAL_CARE: 2, FIRST_AID: 1 },
    skills: [SENIOR_PETS],
    districts: ['san-salvador', 'ciudad-delgado', 'cuscatancingo', 'mejicanos'],
    prices: { [HOME_VISIT]: 1400 },
    availability: every(MONDAY_TO_FRIDAY, '07:00', '17:00'),
    ratings: { count: 58, sum: 281, specialCount: 25, specialSum: 122 },
    completedBookings: 64,
  },
  {
    email: 'diego.castillo@example.com',
    firstName: 'Diego',
    lastName: 'Castillo',
    birthDate: '2004-08-07',
    bio: 'Estudiante de veterinaria. Por las clases solo hago visitas: paseos cortos y compañía para perros con mucha energía.',
    vetStudentMonthsLeft: 4,
    districts: ['antiguo-cuscatlan', 'santa-tecla'],
    prices: { [HOME_VISIT]: null },
    availability: [...every([1, 3, 5], '12:00', '18:00'), ...every(WEEKEND, '09:00', '17:00')],
    ratings: { count: 5, sum: 23, specialCount: 0, specialSum: 0 },
    completedBookings: 6,
  },
  {
    email: 'mariajose.rivas@example.com',
    firstName: 'María José',
    lastName: 'Rivas',
    birthDate: '1997-03-19',
    bio: 'Trabajo desde casa y tengo horarios flexibles. Me gustan las estadías largas y mando fotos todos los días.',
    skills: [CATS, PUPPIES],
    districts: ['santa-tecla', 'antiguo-cuscatlan'],
    prices: {
      [HOME_VISIT]: 1200,
      [OVERNIGHT_STAY]: 2800,
    },
    availability: [...every(EVERY_DAY, '08:00', '19:00'), ...every([4, 5, 6, 7], '19:00', '08:00')],
    ratings: { count: 20, sum: 96, specialCount: 0, specialSum: 0 },
    completedBookings: 23,
  },
  {
    email: 'fernando.mejia@example.com',
    firstName: 'Fernando',
    lastName: 'Mejía',
    birthDate: '2000-12-01',
    bio: 'Hago mis prácticas en una clínica de Apopa. Con la ⭐ puedo dar medicamentos y curar heridas según las indicaciones del veterinario.',
    certifications: { SPECIAL_CARE: 1 },
    vetStudentMonthsLeft: 6,
    districts: ['apopa', 'nejapa', 'mejicanos', 'san-salvador'],
    prices: {
      [HOME_VISIT]: 1000,
      [OVERNIGHT_STAY]: 2000,
    },
    availability: [
      ...every(MONDAY_TO_FRIDAY, '17:00', '19:00'),
      ...every(WEEKEND, '07:00', '19:00'),
      ...every(EVERY_DAY, '19:00', '08:00'),
    ],
    ratings: { count: 9, sum: 44, specialCount: 3, specialSum: 15 },
    completedBookings: 9,
  },
  {
    email: 'sofia.alvarado@example.com',
    firstName: 'Sofía',
    lastName: 'Alvarado',
    birthDate: '2007-02-14',
    bio: 'Soy nueva en Pawie. Vivo con dos gatos y hago visitas por la tarde y los fines de semana.',
    skills: [CATS],
    districts: ['soyapango', 'ilopango', 'tonacatepeque'],
    prices: { [HOME_VISIT]: 800 },
    availability: [
      ...every(MONDAY_TO_FRIDAY, '16:00', '19:00'),
      ...every(WEEKEND, '08:00', '18:00'),
    ],
    ratings: { count: 0, sum: 0, specialCount: 0, specialSum: 0 },
    completedBookings: 0,
  },
  {
    email: 'ricardo.portillo@example.com',
    firstName: 'Ricardo',
    lastName: 'Portillo',
    birthDate: '1985-05-27',
    bio: 'Cuidador de tiempo completo desde hace ocho años. Tengo experiencia con perros grandes, mascotas con movilidad reducida y gatos mayores.',
    // 3 certifications and 4.78, but no Primeros auxilios and under 4.8: Pro, not Súper Cuidador.
    certifications: { SPECIAL_CARE: 11, LARGE_DOGS: 6, CATS: 8 },
    skills: [LARGE_DOGS, SENIOR_PETS, CATS],
    districts: ['san-marcos', 'san-salvador', 'ilopango'],
    prices: {
      [HOME_VISIT]: 1300,
      [OVERNIGHT_STAY]: 2700,
    },
    availability: [...every(EVERY_DAY, '06:00', '19:00'), ...every(EVERY_DAY, '19:00', '08:00')],
    ratings: { count: 104, sum: 497, specialCount: 47, specialSum: 226 },
    completedBookings: 119,
  },
];
