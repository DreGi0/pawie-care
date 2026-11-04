import {
  getPetsGetQueryKey,
  getPetsListQueryKey,
  type PetDetail,
  type PetRequest,
  type PetResponse,
} from '@pawie/api-client';
import { differenceInMonths, parseISO } from 'date-fns';

import { queryClient } from './api';

/**
 * After a change to a pet, MascotaPerfil and Mis mascotas show it. Pass the pet when the API
 * returned it whole; otherwise its profile is asked again.
 */
export function petChanged(petId: string, saved?: PetDetail): void {
  if (saved) queryClient.setQueryData(getPetsGetQueryKey(petId), saved);
  else void queryClient.invalidateQueries({ queryKey: getPetsGetQueryKey(petId) });
  void queryClient.invalidateQueries({ queryKey: getPetsListQueryKey() });
}

/** "Perro, Labrador, 3 años". */
export function describePet(pet: PetResponse, today = new Date()): string {
  return [pet.species.name, pet.breed, petAge(pet, today)].filter(Boolean).join(', ');
}

/** "Hembra, 12.5 kg, esterilizada". Leaves out what the owner hasn't said. */
export function describeBody({
  sex,
  weightGrams,
  isSterilized,
}: Pick<PetResponse, 'sex' | 'weightGrams' | 'isSterilized'>): string {
  const female = sex === 'FEMALE';
  return [
    female ? 'Hembra' : 'Macho',
    weightGrams !== null && `${formatKilos(weightGrams)} kg`,
    isSterilized !== null &&
      (isSterilized ? (female ? 'esterilizada' : 'esterilizado') : 'sin esterilizar'),
  ]
    .filter(Boolean)
    .join(', ');
}

/** 12_500 grams is "12.5"; 8_000 is "8". */
export function formatKilos(grams: number): string {
  return String(Math.round(grams / 100) / 10);
}

/** "3 años", "8 meses", or "aprox. 3 años" when the owner doesn't know the exact birth date. */
export function petAge(
  { birthDate, birthDateIsApproximate }: Pick<PetResponse, 'birthDate' | 'birthDateIsApproximate'>,
  today = new Date(),
): string {
  const months = differenceInMonths(today, parseISO(birthDate));
  const years = Math.floor(months / 12);
  const age =
    years >= 1
      ? count(years, 'año', 'años')
      : months >= 1
        ? count(months, 'mes', 'meses')
        : 'menos de 1 mes';
  return birthDateIsApproximate ? `aprox. ${age}` : age;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The whole profile of a pet with some fields changed, for PUT /v1/pets/{id}: it replaces every
 * field, so each part of MascotaPerfil sends the rest as it is. Only a female can be in heat
 * (RN-MAS-11), so a pet that stops being one loses it.
 */
export function petRequest(pet: PetResponse, changes: Partial<PetRequest> = {}): PetRequest {
  const current: PetRequest = {
    name: pet.name,
    speciesId: pet.species.id,
    breed: pet.breed ?? undefined,
    birthDate: pet.birthDate,
    birthDateIsApproximate: pet.birthDateIsApproximate,
    sex: pet.sex,
    weightGrams: pet.weightGrams ?? undefined,
    isSterilized: pet.isSterilized ?? undefined,
    temperament: pet.temperament ?? undefined,
    handlingNotes: pet.handlingNotes ?? undefined,
    foodDescription: pet.foodDescription ?? undefined,
    foodPortion: pet.foodPortion ?? undefined,
    allowedTreats: pet.allowedTreats ?? undefined,
    dailyRoutine: pet.dailyRoutine ?? undefined,
    vetName: pet.vetName ?? undefined,
    vetClinic: pet.vetClinic ?? undefined,
    vetPhone: pet.vetPhone ?? undefined,
    healthConditions: pet.healthConditions ?? undefined,
    medications: pet.medications ?? undefined,
    heatStartsOn: pet.heatStartsOn ?? undefined,
    heatEndsOn: pet.heatEndsOn ?? undefined,
    photoFileId: pet.photoFileId ?? undefined,
  };
  const request = { ...current, ...changes };
  return request.sex === 'FEMALE'
    ? request
    : { ...request, heatStartsOn: undefined, heatEndsOn: undefined };
}

/** An empty text field is left out, so the API clears it. */
export function optionalText(text: string): string | undefined {
  return text.trim() || undefined;
}
