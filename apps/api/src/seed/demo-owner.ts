import { CareTask, PetSex } from '../generated/prisma/enums.js';
import type { DistrictSlug } from './catalog.js';

export interface DemoPet {
  name: string;
  /** Species code, from catalog.ts. */
  species: 'DOG' | 'CAT';
  breed: string;
  birthDate: string;
  birthDateIsApproximate?: boolean;
  sex: PetSex;
  weightGrams: number;
  isSterilized: boolean;
  temperament?: string;
  handlingNotes?: string;
  healthConditions?: string;
  medications?: string;
  /** Open-ended care needs that started six months before the seed ran. */
  careNeeds: { task: CareTask; ownerInstructions: string }[];
}

const DEMO_PETS: readonly DemoPet[] = [
  {
    name: 'Toby',
    species: 'DOG',
    breed: 'Beagle',
    birthDate: '2019-03-10',
    sex: PetSex.MALE,
    weightGrams: 12_500,
    isSterilized: true,
    temperament: 'Juguetón y muy sociable',
    handlingNotes: 'Jala la correa al salir: mejor con arnés.',
    careNeeds: [],
  },
  {
    name: 'Nala',
    species: 'CAT',
    breed: 'Doméstica de pelo corto',
    birthDate: '2012-07-01',
    birthDateIsApproximate: true,
    sex: PetSex.FEMALE,
    weightGrams: 4_200,
    isSterilized: true,
    temperament: 'Tranquila. Al principio se esconde de las visitas.',
    healthConditions: 'Artritis en las patas traseras.',
    careNeeds: [
      {
        task: CareTask.MOBILITY_ASSISTANCE,
        ownerInstructions:
          'Ayúdala a subir al sofá y a la cama. No la cargues por el abdomen, sino por el pecho y las patas traseras.',
      },
    ],
  },
  {
    name: 'Rocky',
    species: 'DOG',
    breed: 'Schnauzer miniatura',
    birthDate: '2015-11-20',
    sex: PetSex.MALE,
    weightGrams: 8_000,
    isSterilized: true,
    healthConditions: 'Diabetes.',
    medications: 'Insulina dos veces al día.',
    careNeeds: [
      { task: CareTask.INJECTION, ownerInstructions: 'Insulina a las 7:00 y a las 19:00.' },
    ],
  },
];

/**
 * The owner that goes through the demo flow (docs/reglas-de-negocio.md §2). Its password
 * comes from DEMO_OWNER_PASSWORD. The address is made up. Each pet shows one case:
 * Toby is Standard, Nala is Special because she needs help moving (an assistance task,
 * so no vet document is needed), and Rocky needs insulin, which no caregiver may give,
 * so he can't be booked (RN-MAS-09).
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
  pets: DEMO_PETS,
} as const;
