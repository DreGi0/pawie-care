import type { CaregiverBadge, CaregiverLevel, CaregiverSkill } from '@pawie/api-client';

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
