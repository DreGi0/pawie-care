import { requireWalkablePets } from './walk.js';

const dog = (name: string) => ({ id: name, name, species: { code: 'DOG' } });
const cat = (name: string) => ({ id: name, name, species: { code: 'CAT' } });

function errorOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    return (error as { getResponse(): unknown }).getResponse();
  }
  throw new Error('Expected requireWalkablePets to fail');
}

describe('requireWalkablePets (RN-SER-05, RN-RES-01)', () => {
  it('takes up to the maximum of dogs', () => {
    expect(() => requireWalkablePets([dog('Toby'), dog('Luna')], 2)).not.toThrow();
    expect(errorOf(() => requireWalkablePets([dog('Toby'), dog('Luna')], 1))).toEqual({
      errorCode: 'TOO_MANY_DOGS_PER_WALK',
      message: 'En un paseo va un solo perro.',
      details: { maxDogs: 1 },
    });
  });

  it('names every pet that is not a dog, before counting the dogs', () => {
    expect(
      errorOf(() => requireWalkablePets([cat('Nala'), dog('Toby'), cat('Mishi'), cat('Kiwi')], 2)),
    ).toEqual({
      errorCode: 'WALK_ONLY_FOR_DOGS',
      message:
        'El paseo es solo para perros, así que Nala, Mishi y Kiwi no pueden ir. Elige solo perros, o busca una visita o una pernocta.',
      details: {
        pets: [
          { petId: 'Nala', name: 'Nala' },
          { petId: 'Mishi', name: 'Mishi' },
          { petId: 'Kiwi', name: 'Kiwi' },
        ],
      },
    });
  });
});
