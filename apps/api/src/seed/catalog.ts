import { ServiceCode } from '../generated/prisma/enums.js';

/**
 * RN-CUI-04: the 14 former municipalities of the AMSS (12 in San Salvador and 2 in La
 * Libertad), as COAMSS-OPAMSS lists them. Since the 2024 territorial reform they are
 * districts of the new municipalities.
 */
export const DISTRICTS = [
  { slug: 'antiguo-cuscatlan', name: 'Antiguo Cuscatlán' },
  { slug: 'apopa', name: 'Apopa' },
  { slug: 'ayutuxtepeque', name: 'Ayutuxtepeque' },
  { slug: 'ciudad-delgado', name: 'Ciudad Delgado' },
  { slug: 'cuscatancingo', name: 'Cuscatancingo' },
  { slug: 'ilopango', name: 'Ilopango' },
  { slug: 'mejicanos', name: 'Mejicanos' },
  { slug: 'nejapa', name: 'Nejapa' },
  { slug: 'san-marcos', name: 'San Marcos' },
  { slug: 'san-martin', name: 'San Martín' },
  { slug: 'san-salvador', name: 'San Salvador' },
  { slug: 'santa-tecla', name: 'Santa Tecla' },
  { slug: 'soyapango', name: 'Soyapango' },
  { slug: 'tonacatepeque', name: 'Tonacatepeque' },
] as const;

export type DistrictSlug = (typeof DISTRICTS)[number]['slug'];

/** RN-MAS-01 */
export const SPECIES = [
  { code: 'DOG', name: 'Perro' },
  { code: 'CAT', name: 'Gato' },
] as const;

/** RN-SER-01, RN-SER-02. Durations and hours are settings, so the texts don't give them. */
export const SERVICES = [
  {
    code: ServiceCode.HOME_VISIT,
    name: 'Visita a domicilio',
    description:
      'El cuidador visita la casa del dueño para alimentar, limpiar, acompañar y dar medicación y, si es un perro, sacarlo a una caminata corta.',
  },
  {
    code: ServiceCode.OVERNIGHT_STAY,
    name: 'Pernocta en casa del dueño',
    description:
      'El cuidador duerme en la casa del dueño y se encarga de los cuidados de la noche y de la mañana.',
  },
] as const;

/** RN-CUI-11: the ⭐, the only certification type of the demo. */
export const SPECIAL_CARE_CERTIFICATION = {
  code: 'SPECIAL_CARE',
  name: 'Cuidado especial',
} as const;
