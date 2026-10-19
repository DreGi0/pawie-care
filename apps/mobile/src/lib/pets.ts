import type { PetResponse } from '@pawie/api-client';
import { differenceInMonths, parseISO } from 'date-fns';

/** "Perro · Labrador · 3 años". */
export function describePet(pet: PetResponse, today = new Date()): string {
  return [pet.species.name, pet.breed, petAge(pet, today)].filter(Boolean).join(' · ');
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
