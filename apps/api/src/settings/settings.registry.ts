import { CaregiverLevel, CareLevel, ServiceCode } from '../generated/prisma/enums.js';
import {
  basisPoints,
  integer,
  list,
  minuteOfDay,
  object,
  refine,
  type SettingParser,
  text,
} from './setting-parsers.js';

type RuleId = `RN-${string}`;

export interface SettingDefinition<T> {
  /** What it is, in Spanish, as §15 of docs/reglas-de-negocio.md calls it. */
  description: string;
  /** Rules that use it. The first one is the rule cited in §15. */
  rules: readonly [RuleId, ...RuleId[]];
  parse: SettingParser<T>;
  /** The value in §15, which the seed loads. */
  initialValue: T;
  /** Nothing reads it in the demo: the rules that use it come after the demo. */
  postDemo?: true;
}

function setting<T>(definition: SettingDefinition<T>): SettingDefinition<T> {
  return definition;
}

/** A duration in minutes, between one minute and `maxDays` days. */
const minutes = (maxDays: number) => integer({ min: 1, max: maxDays * 24 * 60 });
const days = integer({ min: 1, max: 365 });
const cents = integer({ min: 1, max: 100_000 });
/** An average rating in tenths of a star: 40 is 4.0. Avoids comparing floats. */
const ratingTenths = integer({ min: 10, max: 50 });

/** What a level asks for besides the lower levels (RN-NIV-02). Ratings are in tenths. */
const levelRequirement = object({
  minReviews: integer({ min: 1, max: 10_000 }),
  minAverageRatingTenths: ratingTenths,
  minCompletedBookings: integer({ min: 0, max: 100_000 }),
  minCertifications: integer({ min: 0, max: 20 }),
  /** Codes of certification types the caregiver must hold, counted in minCertifications. */
  requiredCertificationCodes: list(text),
});

const priceRange = refine(
  object({ minCents: cents, suggestedCents: cents, maxCents: cents }),
  ({ minCents, suggestedCents, maxCents }) =>
    minCents <= suggestedCents && suggestedCents <= maxCents,
  'debe cumplir minCents ≤ suggestedCents ≤ maxCents.',
);
const priceRangesByLevel = object({
  [CareLevel.STANDARD]: priceRange,
  [CareLevel.SPECIAL]: priceRange,
});

/**
 * Every configurable parameter (docs/reglas-de-negocio.md §15), including the ones
 * used after the demo. Values live in the settings table; read them with
 * SettingsService, which validates them with these parsers. Durations given in hours
 * or minutes in the rules are stored in minutes.
 */
export const SETTINGS = {
  // ─── Prices and fees ───
  'pricing.priceRanges': setting({
    description: 'Rangos y precios sugeridos por servicio y nivel, en centavos',
    rules: ['RN-PRE-01', 'RN-CUI-17'],
    parse: object({
      [ServiceCode.HOME_VISIT]: priceRangesByLevel,
      [ServiceCode.OVERNIGHT_STAY]: priceRangesByLevel,
    }),
    initialValue: {
      HOME_VISIT: {
        STANDARD: { minCents: 1000, suggestedCents: 1200, maxCents: 1400 },
        SPECIAL: { minCents: 1500, suggestedCents: 1700, maxCents: 2000 },
      },
      OVERNIGHT_STAY: {
        STANDARD: { minCents: 2000, suggestedCents: 2500, maxCents: 3000 },
        SPECIAL: { minCents: 3000, suggestedCents: 3500, maxCents: 4500 },
      },
    },
  }),
  'pricing.additionalPetSurchargeBp': setting({
    description: 'Recargo por mascota adicional, sobre el precio del cuidador',
    rules: ['RN-PRE-02'],
    parse: basisPoints,
    initialValue: 5000,
  }),
  'pricing.ownerServiceFeeBp': setting({
    description: 'Tarifa de servicio al dueño',
    rules: ['RN-PRE-03'],
    parse: basisPoints,
    initialValue: 1000,
  }),
  'pricing.caregiverCommissionBp': setting({
    description: 'Comisión al cuidador',
    rules: ['RN-PRE-04'],
    parse: basisPoints,
    initialValue: 1500,
  }),
  'pricing.guaranteeFundBp': setting({
    description: 'Fondo de Garantía Pawie, sobre lo que paga el dueño',
    rules: ['RN-PRE-06'],
    parse: basisPoints,
    initialValue: 200,
  }),
  'pricing.vatBp': setting({
    description: 'IVA',
    rules: ['RN-PRE-06'],
    parse: basisPoints,
    initialValue: 1300,
  }),
  'payments.gatewayFeeBp': setting({
    description: 'Comisión de la pasarela',
    rules: ['RN-PAG-01'],
    parse: basisPoints,
    initialValue: 350,
  }),

  // ─── Services ───
  'services.homeVisitMaxMinutes': setting({
    description: 'Duración máxima de una visita',
    rules: ['RN-SER-01'],
    parse: integer({ min: 15, max: 4 * 60 }),
    initialValue: 60,
  }),
  'services.overnightHours': setting({
    description: 'Horario de pernocta, en minutos desde la medianoche; termina al día siguiente',
    rules: ['RN-SER-02'],
    parse: refine(
      object({ startMinute: minuteOfDay, endMinute: minuteOfDay }),
      ({ startMinute, endMinute }) => endMinute < startMinute,
      'la pernocta termina al día siguiente, así que endMinute debe ser menor que startMinute.',
    ),
    initialValue: { startMinute: 19 * 60, endMinute: 8 * 60 },
  }),

  // ─── Bookings ───
  'bookings.maxPetsPerBooking': setting({
    description: 'Máximo de mascotas por reserva',
    rules: ['RN-RES-03'],
    parse: integer({ min: 1, max: 10 }),
    initialValue: 3,
  }),
  'bookings.minLeadTimeMinutes': setting({
    description: 'Anticipación mínima para solicitar',
    rules: ['RN-RES-05'],
    parse: minutes(7),
    initialValue: 2 * 60,
  }),
  'bookings.caregiverResponseMinutes': setting({
    description:
      'Plazo de respuesta del cuidador, según falten más de 72 h, entre 24 y 72 h o menos de 24 h para el servicio',
    rules: ['RN-RES-06'],
    parse: object({ over72h: minutes(3), from24hTo72h: minutes(1), under24h: minutes(1) }),
    initialValue: { over72h: 24 * 60, from24hTo72h: 6 * 60, under24h: 60 },
  }),
  'bookings.paymentWindowMinutes': setting({
    description: 'Plazo de pago',
    rules: ['RN-RES-07'],
    parse: minutes(1),
    initialValue: 2 * 60,
  }),

  // ─── After the demo: payouts, cancellations, service, reviews ───
  'payments.payoutHoldMinutes': setting({
    description: 'Retención del pago, que también es el plazo para abrir una disputa',
    rules: ['RN-PAG-03', 'RN-DIS-01'],
    parse: minutes(30),
    initialValue: 48 * 60,
    postDemo: true,
  }),
  'cancellations.ownerRefunds': setting({
    description:
      'Ventanas de cancelación del dueño: 100% con más anticipación que la primera, el porcentaje parcial hasta la segunda y nada después',
    rules: ['RN-CAN-01'],
    parse: refine(
      object({
        fullRefundMinLeadMinutes: minutes(30),
        partialRefundMinLeadMinutes: minutes(30),
        partialRefundBp: basisPoints,
      }),
      (value) => value.fullRefundMinLeadMinutes > value.partialRefundMinLeadMinutes,
      'fullRefundMinLeadMinutes debe ser mayor que partialRefundMinLeadMinutes.',
    ),
    initialValue: {
      fullRefundMinLeadMinutes: 48 * 60,
      partialRefundMinLeadMinutes: 24 * 60,
      partialRefundBp: 5000,
    },
    postDemo: true,
  }),
  'cancellations.caregiverSuspension': setting({
    description: 'Cancelaciones del cuidador antes de suspenderlo, en cuántos días, y por cuánto',
    rules: ['RN-CAN-05'],
    parse: object({
      maxCancellations: integer({ min: 1, max: 100 }),
      windowDays: days,
      suspensionDays: days,
    }),
    initialValue: { maxCancellations: 3, windowDays: 90, suspensionDays: 15 },
    postDemo: true,
  }),
  'cancellations.specialCareSuspensionDays': setting({
    description: 'Suspensión de la ⭐ por cancelar un cuidado Especial',
    rules: ['RN-CAN-05'],
    parse: days,
    initialValue: 30,
    postDemo: true,
  }),
  'cancellations.noReplacementCreditBp': setting({
    description: 'Crédito al dueño si no hay reemplazo, sobre el valor de la reserva',
    rules: ['RN-CAN-06'],
    parse: basisPoints,
    initialValue: 1000,
    postDemo: true,
  }),
  'execution.checkInToleranceMinutes': setting({
    description: 'Tolerancia de check-in',
    rules: ['RN-EJE-02'],
    parse: integer({ min: 1, max: 4 * 60 }),
    initialValue: 30,
    postDemo: true,
  }),
  'emergencies.ownerResponseWaitMinutes': setting({
    description: 'Espera al dueño en emergencias sin señales de alarma',
    rules: ['RN-EME-03'],
    parse: integer({ min: 1, max: 60 }),
    initialValue: 10,
    postDemo: true,
  }),
  'reviews.writingWindowDays': setting({
    description: 'Plazo para escribir una reseña',
    rules: ['RN-RSE-01'],
    parse: days,
    initialValue: 7,
    postDemo: true,
  }),
  'reviews.adminReviewThreshold': setting({
    description:
      'Umbral de revisión por calificación: promedio en décimas, después de cuántos servicios',
    rules: ['RN-RSE-03'],
    parse: object({
      minAverageRatingTenths: ratingTenths,
      afterCompletedBookings: integer({ min: 1, max: 1000 }),
    }),
    initialValue: { minAverageRatingTenths: 40, afterCompletedBookings: 5 },
    postDemo: true,
  }),

  // ─── Certifications (RN-CUI-07 to RN-CUI-10) and levels (RN-NIV) ───
  'certifications.minExamScoreBp': setting({
    description: 'Nota mínima del examen de una certificación',
    rules: ['RN-CUI-08'],
    parse: basisPoints,
    initialValue: 8000,
    postDemo: true,
  }),
  'certifications.validityMonths': setting({
    description: 'Vigencia de una certificación',
    rules: ['RN-CUI-09'],
    parse: integer({ min: 1, max: 60 }),
    initialValue: 12,
  }),
  'certifications.specialCareMinAverageRatingTenths': setting({
    description: 'Calificación mínima para conservar la ⭐, en servicios especiales, en décimas',
    rules: ['RN-CUI-10'],
    parse: ratingTenths,
    initialValue: 40,
    postDemo: true,
  }),
  'levels.requirements': setting({
    description:
      'Requisitos de cada nivel del cuidador, menos Nuevo, que no pide nada. Cuenta solo las certificaciones vigentes',
    rules: ['RN-NIV-02', 'RN-NIV-04'],
    parse: object({
      [CaregiverLevel.TRUSTED]: levelRequirement,
      [CaregiverLevel.PRO]: levelRequirement,
      [CaregiverLevel.SUPER]: levelRequirement,
    }),
    initialValue: {
      TRUSTED: {
        minReviews: 3,
        minAverageRatingTenths: 45,
        minCompletedBookings: 0,
        minCertifications: 0,
        requiredCertificationCodes: [],
      },
      PRO: {
        minReviews: 3,
        minAverageRatingTenths: 46,
        minCompletedBookings: 15,
        minCertifications: 2,
        requiredCertificationCodes: [],
      },
      SUPER: {
        minReviews: 3,
        minAverageRatingTenths: 48,
        minCompletedBookings: 40,
        minCertifications: 3,
        requiredCertificationCodes: ['FIRST_AID'],
      },
    },
  }),
  'disputes.resolutionBusinessDays': setting({
    description: 'Plazo para resolver disputas',
    rules: ['RN-DIS-02'],
    parse: integer({ min: 1, max: 60 }),
    initialValue: 5,
    postDemo: true,
  }),
};

export type SettingKey = keyof typeof SETTINGS;

export type SettingValue<K extends SettingKey> =
  (typeof SETTINGS)[K] extends SettingDefinition<infer T> ? T : never;

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTINGS, key);
}

/** Validates a value for the setting. Throws InvalidSettingValueError if it isn't valid. */
export function parseSettingValue<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  const definition = SETTINGS[key] as SettingDefinition<SettingValue<K>>;
  return definition.parse(value, key);
}
