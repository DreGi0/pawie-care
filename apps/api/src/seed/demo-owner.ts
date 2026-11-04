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
  foodDescription?: string;
  foodPortion?: string;
  allowedTreats?: string;
  dailyRoutine?: string;
  /** RN-MAS-02: meals only. A medication dose would need a vet document. */
  meals: { minuteOfDay: number; label: string; dose?: string }[];
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
    foodDescription: 'Croquetas para perro adulto, de cordero',
    foodPortion: '1 taza',
    allowedTreats: 'Galletas de pollo, hasta 3 al día',
    dailyRoutine:
      'Sale al patio al despertar y después de cada comida. Duerme en su cama de la sala.',
    meals: [
      { minuteOfDay: 7 * 60, label: 'Desayuno' },
      { minuteOfDay: 18 * 60, label: 'Cena' },
    ],
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
    foodDescription: 'Comida húmeda para gatos senior',
    allowedTreats: 'Ninguno',
    dailyRoutine: 'Toma el sol en la ventana de la sala por la mañana. Usa el arenero del baño.',
    meals: [
      { minuteOfDay: 8 * 60, label: 'Desayuno', dose: '1 sobre' },
      { minuteOfDay: 19 * 60, label: 'Cena', dose: '1 sobre' },
    ],
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
    meals: [],
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
