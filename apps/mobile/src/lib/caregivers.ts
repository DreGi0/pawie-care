import type {
  AvailabilityWindow,
  CaregiverBadge,
  CaregiverDocumentKind,
  CaregiverLevel,
  CaregiverSetupStep,
  CaregiverSkill,
  LevelRequirementResponse,
  UploadPurpose,
} from '@pawie/api-client';
import type { Href } from 'expo-router';

import type { IconName } from '@/components/Icon';

/** RN-NIV-01. */
export const LEVEL_NAMES: Record<CaregiverLevel, string> = {
  NEW: 'Nuevo',
  TRUSTED: 'Confiable',
  PRO: 'Pro',
  SUPER: 'Súper Cuidador',
};

/** RN-CUI-03, RN-CUI-05. */
export const BADGE_NAMES: Record<CaregiverBadge, string> = {
  IDENTITY_VERIFIED: 'Identidad verificada',
  BACKGROUND_CHECKED: 'Antecedentes verificados',
  VET_STUDENT: 'Estudiante de veterinaria',
};

/** RN-CUI-19: declared by the caregiver, nobody checks them. */
export const SKILL_NAMES: Record<CaregiverSkill, string> = {
  LARGE_DOGS: 'Perros grandes',
  CATS: 'Gatos',
  PUPPIES: 'Cachorros',
  SENIOR_PETS: 'Mascotas mayores',
  DIFFICULT_BEHAVIOR: 'Comportamiento difícil',
};

/** The certifications to filter by (RN-RES-10). Their codes are the ones of the API's seed. */
export const CERTIFICATION_FILTERS = [
  { code: 'SPECIAL_CARE', label: '⭐ Cuidado especial' },
  { code: 'FIRST_AID', label: 'Primeros auxilios' },
  { code: 'LARGE_DOGS', label: 'Perros grandes' },
  { code: 'CATS', label: 'Gatos' },
] as const;

/** "Nivel Confiable". */
export function levelLabel(level: CaregiverLevel): string {
  return `Nivel ${LEVEL_NAMES[level]}`;
}

/** RN-CUI-01: the documents of the sign-up, in the order Documentos lists them. */
export const DOCUMENTS = [
  {
    kind: 'ID_DOCUMENT_FRONT',
    purpose: 'ID_DOCUMENT',
    title: 'DUI, frente',
    detail: 'El lado con tu fotografía',
    icon: 'id-card',
  },
  {
    kind: 'ID_DOCUMENT_BACK',
    purpose: 'ID_DOCUMENT',
    title: 'DUI, reverso',
    detail: 'El lado con tu dirección',
    icon: 'id-card',
  },
  {
    kind: 'SELFIE',
    purpose: 'SELFIE',
    title: 'Selfie',
    detail: 'Con la cámara, de frente y con buena luz',
    icon: 'scan-face',
  },
  {
    kind: 'BACKGROUND_CHECK',
    purpose: 'BACKGROUND_CHECK',
    title: 'Antecedentes penales',
    detail: 'La constancia o la solvencia de la PNC, en foto o PDF',
    icon: 'file-text',
  },
] as const satisfies readonly {
  kind: CaregiverDocumentKind;
  purpose: UploadPurpose;
  title: string;
  detail: string;
  icon: IconName;
}[];

/** What each step of the sign-up asks for (RN-CUI-01 to RN-CUI-04), and where to do it. */
export const SETUP_STEPS: Record<
  CaregiverSetupStep,
  { title: string; detail: string; icon: IconName; action?: { label: string; href: Href } }
> = {
  DOCUMENTS: {
    title: 'Tus documentos',
    detail: 'DUI por los dos lados, selfie y antecedentes',
    icon: 'id-card',
    action: { label: 'Subir mis documentos', href: '/cuidador/documentos' },
  },
  WELCOME_COURSE: {
    title: 'Curso de bienvenida',
    detail: 'Cuatro módulos cortos y un examen',
    icon: 'book-open',
    action: { label: 'Tomar el curso', href: '/cuidador/curso' },
  },
  APPROVAL: {
    title: 'Revisión de Pawie',
    detail: 'Verificamos tu identidad y tus antecedentes',
    icon: 'shield-check',
  },
  DISTRICTS: {
    title: 'Tus distritos',
    detail: 'Dónde puedes cuidar',
    icon: 'map-pin',
    action: { label: 'Completar mi perfil', href: '/cuidador/perfil' },
  },
  AVAILABILITY: {
    title: 'Tu horario',
    detail: 'Los días y las horas en que puedes cuidar',
    icon: 'calendar',
    action: { label: 'Completar mi perfil', href: '/cuidador/perfil' },
  },
  SERVICES: {
    title: 'Tus servicios',
    detail: 'Al menos uno, con su precio',
    icon: 'circle-dollar-sign',
    action: { label: 'Elegir mis precios', href: '/cuidador/precios' },
  },
};

/** The order of the sign-up, done or not, as Inicio lists it. */
export const SETUP_ORDER = Object.keys(SETUP_STEPS) as CaregiverSetupStep[];

/** One requirement of the next level as Inicio writes it: "12" "reseñas" "de 3" (RN-NIV-05). */
export function requirementText({
  kind,
  current,
  required,
  certification,
}: LevelRequirementResponse): { value: string; text: string; of?: string } {
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  switch (kind) {
    case 'REVIEWS':
      return {
        value: `${current}`,
        text: plural(current, ' reseña', ' reseñas'),
        of: `de ${required}`,
      };
    case 'AVERAGE_RATING':
      return current === 0
        ? { value: 'Promedio', text: ' de reseñas', of: `de ${required.toFixed(1)}` }
        : { value: current.toFixed(1), text: ' de promedio', of: `de ${required.toFixed(1)}` };
    case 'COMPLETED_BOOKINGS':
      return {
        value: `${current}`,
        text: ` de ${required} ${plural(required, 'servicio', 'servicios')}`,
      };
    case 'CERTIFICATIONS':
      return {
        value: `${current}`,
        text: ` de ${required} ${plural(required, 'certificación', 'certificaciones')}`,
      };
    case 'CERTIFICATION':
      return { value: certification?.name ?? '', text: ', vigente' };
  }
}

/** ISO weekdays, 1 is Monday, as the weekly schedule lists them. */
export const WEEKDAYS = [
  { weekday: 1, short: 'Lun', long: 'Lunes' },
  { weekday: 2, short: 'Mar', long: 'Martes' },
  { weekday: 3, short: 'Mié', long: 'Miércoles' },
  { weekday: 4, short: 'Jue', long: 'Jueves' },
  { weekday: 5, short: 'Vie', long: 'Viernes' },
  { weekday: 6, short: 'Sáb', long: 'Sábado' },
  { weekday: 7, short: 'Dom', long: 'Domingo' },
] as const;

export type Franja = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export const FRANJA_NAMES: Record<Franja, string> = {
  MORNING: 'Mañana',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noche',
};

type Range = { startMinute: number; endMinute: number };

/**
 * How the app edits the weekly schedule (RN-CUI-04): each day has a morning from 7:00 to 12:00,
 * an afternoon until the overnight stay starts, and the night of the overnight stay
 * (RN-SER-02), which ends the next day. The API takes any window; these are only the app's
 * editor. The overnight hours come from GET /v1/catalog.
 */
export function franjaWindows(overnight: Range): Record<Franja, Range> {
  return {
    MORNING: { startMinute: 7 * 60, endMinute: 12 * 60 },
    AFTERNOON: { startMinute: 12 * 60, endMinute: overnight.startMinute },
    NIGHT: { startMinute: overnight.startMinute, endMinute: overnight.endMinute + 24 * 60 },
  };
}

/** The franjas each weekday's windows cover whole, as keys like "1:MORNING". */
export function franjasOf(
  windows: readonly AvailabilityWindow[],
  franjas: Record<Franja, Range>,
): Set<string> {
  const selected = new Set<string>();
  for (const { weekday } of WEEKDAYS) {
    for (const franja of Object.keys(franjas) as Franja[]) {
      const { startMinute, endMinute } = franjas[franja];
      if (
        windows.some(
          (window) =>
            window.weekday === weekday &&
            window.startMinute <= startMinute &&
            window.endMinute >= endMinute,
        )
      ) {
        selected.add(`${weekday}:${franja}`);
      }
    }
  }
  return selected;
}

/** The windows to save for the selected franjas. The API takes windows that touch. */
export function windowsOf(
  selected: ReadonlySet<string>,
  franjas: Record<Franja, Range>,
): AvailabilityWindow[] {
  return WEEKDAYS.flatMap(({ weekday }) =>
    (Object.keys(franjas) as Franja[])
      .filter((franja) => selected.has(`${weekday}:${franja}`))
      .map((franja) => ({ weekday, ...franjas[franja] })),
  );
}
