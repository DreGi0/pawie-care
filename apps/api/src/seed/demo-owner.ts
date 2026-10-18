import type { DistrictSlug } from './catalog.js';

/**
 * The owner that goes through the demo flow (docs/reglas-de-negocio.md §2). Its password
 * comes from DEMO_OWNER_PASSWORD. The address is made up.
 */
export const DEMO_OWNER = {
  email: 'demo@example.com',
  firstName: 'Daniela',
  lastName: 'Pérez',
  birthDate: '1992-05-20',
  address: {
    label: 'Casa',
    street: 'Pasaje Las Mascotas 12, Residencial Pawie',
    details: 'Portón verde, a la par de la tienda',
    district: 'san-salvador' satisfies DistrictSlug,
  },
} as const;
