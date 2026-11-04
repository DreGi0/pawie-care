import { UnprocessableEntityException } from '@nestjs/common';

/** RN-SER-05, RN-RES-01: the walk is only for dogs. Codes of the species catalog (RN-MAS-01). */
export const WALK_SPECIES_CODES: readonly string[] = ['DOG'];

interface WalkPet {
  id: string;
  name: string;
  species: { code: string };
}

/**
 * RN-SER-05, RN-RES-01, RN-RES-03: a walk takes only dogs, up to `maxDogs` of them.
 * Says which pets don't fit, so the app can explain it.
 */
export function requireWalkablePets(pets: readonly WalkPet[], maxDogs: number): void {
  const notDogs = pets.filter(({ species }) => !WALK_SPECIES_CODES.includes(species.code));
  if (notDogs.length > 0) {
    const names = notDogs.map(({ name }) => name);
    const list =
      names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
    throw new UnprocessableEntityException({
      errorCode: 'WALK_ONLY_FOR_DOGS',
      message: `El paseo es solo para perros, así que ${list} no ${names.length === 1 ? 'puede ir' : 'pueden ir'}. Elige solo perros, o busca una visita o una pernocta.`,
      details: { pets: notDogs.map(({ id, name }) => ({ petId: id, name })) },
    });
  }
  if (pets.length > maxDogs) {
    throw new UnprocessableEntityException({
      errorCode: 'TOO_MANY_DOGS_PER_WALK',
      message:
        maxDogs === 1
          ? 'En un paseo va un solo perro.'
          : `En un paseo van hasta ${maxDogs} perros.`,
      details: { maxDogs },
    });
  }
}
