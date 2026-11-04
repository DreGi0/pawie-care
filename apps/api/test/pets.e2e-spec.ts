import { createTestDatabase, type TestDatabase } from './database.js';
import { type Catalog, createCatalog, createUser } from './factories.js';
import { uploadFile } from './uploads.js';
import { useApi } from './use-api.js';

describe('pets', () => {
  let db: TestDatabase;
  let catalog: Catalog;

  beforeAll(async () => {
    db = await createTestDatabase();
    catalog = await createCatalog(db.prisma);
  });

  afterAll(async () => {
    await db.close();
  });

  const api = useApi(() => db);

  async function owner() {
    return api.tokenFor(await createUser(db.prisma));
  }

  const luna = (overrides: Record<string, unknown> = {}) => ({
    name: 'Luna',
    speciesId: catalog.speciesId,
    breed: 'Beagle',
    birthDate: '2015-03-10',
    birthDateIsApproximate: true,
    sex: 'FEMALE',
    weightGrams: 12_500,
    isSterilized: true,
    temperament: 'Juguetona',
    ...overrides,
  });

  const as = (token: string) => ({
    get: (path: string) => api.http().get(path).auth(token, { type: 'bearer' }),
    post: (path: string, body?: object) =>
      api.http().post(path).auth(token, { type: 'bearer' }).send(body),
    put: (path: string, body: object) =>
      api.http().put(path).auth(token, { type: 'bearer' }).send(body),
    delete: (path: string) => api.http().delete(path).auth(token, { type: 'bearer' }),
  });

  async function createPet(token: string, overrides: Record<string, unknown> = {}) {
    const { body } = await as(token).post('/v1/pets', luna(overrides)).expect(201);
    return body as { id: string };
  }

  describe('profile (RN-MAS-02, RN-MAS-03)', () => {
    it('registers a pet with its photo', async () => {
      const token = await owner();
      const photoFileId = await uploadFile(api, token, 'PET_PHOTO');

      const { body } = await as(token).post('/v1/pets', luna({ photoFileId })).expect(201);

      expect(body).toMatchObject({
        name: 'Luna',
        species: { id: catalog.speciesId, name: 'Perro' },
        birthDate: '2015-03-10',
        birthDateIsApproximate: true,
        sex: 'FEMALE',
        weightGrams: 12_500,
        photoFileId,
        vaccinations: [],
        vetInstructions: [],
        careNeeds: [],
      });
      expect((await fetch(body.photoUrl)).status).toBe(200);
    });

    it("lists only the owner's pets that are not archived", async () => {
      const token = await owner();
      const kept = await createPet(token, { name: 'Toby' });
      const archived = await createPet(token, { name: 'Michi' });
      await createPet(await owner(), { name: 'De otra cuenta' });

      await as(token).delete(`/v1/pets/${archived.id}`).expect(204);
      const { body } = await as(token).get('/v1/pets').expect(200);

      expect(body.map(({ id }: { id: string }) => id)).toEqual([kept.id]);
      await as(token).get(`/v1/pets/${archived.id}`).expect(404);
    });

    it('replaces every field on edit, clearing what is left out', async () => {
      const token = await owner();
      const pet = await createPet(token);

      const { body } = await as(token)
        .put(`/v1/pets/${pet.id}`, {
          name: 'Luna',
          speciesId: catalog.speciesId,
          birthDate: '2015-03-10',
          sex: 'FEMALE',
        })
        .expect(200);

      expect(body).toMatchObject({
        breed: null,
        weightGrams: null,
        isSterilized: null,
        birthDateIsApproximate: false,
      });
    });

    it('keeps the routine: food, portion, treats and daily routine (RN-MAS-02)', async () => {
      const token = await owner();
      const routine = {
        foodDescription: 'Croquetas para perro adulto',
        foodPortion: '1 taza',
        allowedTreats: 'Galletas de pollo, hasta 3 al día',
        dailyRoutine: 'Sale al patio al despertar.',
        medications: 'Gotas para los ojos',
      };

      const created = await as(token).post('/v1/pets', luna(routine)).expect(201);
      const cleared = await as(token).put(`/v1/pets/${created.body.id}`, luna()).expect(200);

      expect(created.body).toMatchObject(routine);
      expect(cleared.body).toMatchObject({
        foodDescription: null,
        foodPortion: null,
        allowedTreats: null,
        dailyRoutine: null,
        medications: null,
      });
    });

    it('does not let anyone else see or change a pet', async () => {
      const pet = await createPet(await owner());
      const stranger = await owner();

      const response = await as(stranger).get(`/v1/pets/${pet.id}`).expect(404);
      await as(stranger).put(`/v1/pets/${pet.id}`, luna()).expect(404);
      await as(stranger).delete(`/v1/pets/${pet.id}`).expect(404);

      expect(response.body).toEqual({
        statusCode: 404,
        errorCode: 'PET_NOT_FOUND',
        message: 'No encontramos esa mascota.',
      });
    });

    it('rejects a future birth date, an unknown species and invalid fields', async () => {
      const token = await owner();

      const future = await as(token)
        .post('/v1/pets', luna({ birthDate: '2999-01-01' }))
        .expect(422);
      const species = await as(token)
        .post('/v1/pets', luna({ speciesId: '01a14c39-0000-7000-8000-000000000000' }))
        .expect(422);
      const invalid = await as(token)
        .post('/v1/pets', luna({ sex: 'OTHER', name: '' }))
        .expect(400);

      expect(future.body.errorCode).toBe('INVALID_DATES');
      expect(species.body.errorCode).toBe('UNKNOWN_SPECIES');
      expect(invalid.body.details).toEqual({
        name: ['Escribe su nombre.'],
        sex: ['Elige macho o hembra.'],
      });
    });

    it('only takes a photo that is uploaded and meant for a pet', async () => {
      const token = await owner();
      const prescription = await uploadFile(api, token, 'VET_INSTRUCTION');
      const pending = await as(token)
        .post('/v1/files', { purpose: 'PET_PHOTO', contentType: 'image/png', sizeBytes: 10 })
        .expect(201);

      const wrongPurpose = await as(token)
        .post('/v1/pets', luna({ photoFileId: prescription }))
        .expect(422);
      const notUploaded = await as(token)
        .post('/v1/pets', luna({ photoFileId: pending.body.file.id }))
        .expect(409);

      expect(wrongPurpose.body.errorCode).toBe('WRONG_FILE_PURPOSE');
      expect(notUploaded.body.errorCode).toBe('FILE_NOT_UPLOADED');
    });
  });

  describe('vaccinations', () => {
    it('adds and removes vaccinations, with an optional record', async () => {
      const token = await owner();
      const pet = await createPet(token);
      const fileId = await uploadFile(api, token, 'VACCINATION_RECORD');

      const { body } = await as(token)
        .post(`/v1/pets/${pet.id}/vaccinations`, {
          name: 'Antirrábica',
          administeredOn: '2026-03-01',
          nextDueOn: '2027-03-01',
          fileId,
        })
        .expect(201);

      expect(body).toMatchObject({ name: 'Antirrábica', nextDueOn: '2027-03-01', fileId });
      expect((await fetch(body.fileUrl)).status).toBe(200);
      await as(token).delete(`/v1/pets/${pet.id}/vaccinations/${body.id}`).expect(204);
      await as(token).delete(`/v1/pets/${pet.id}/vaccinations/${body.id}`).expect(404);
    });

    it('needs the next dose after the one given', async () => {
      const token = await owner();
      const pet = await createPet(token);

      const response = await as(token)
        .post(`/v1/pets/${pet.id}/vaccinations`, {
          name: 'Triple',
          administeredOn: '2026-03-01',
          nextDueOn: '2026-03-01',
        })
        .expect(422);

      expect(response.body.errorCode).toBe('INVALID_DATES');
    });
  });

  async function petWithInstructions(token: string) {
    const pet = await createPet(token);
    const fileId = await uploadFile(api, token, 'VET_INSTRUCTION');
    const { body } = await as(token)
      .post(`/v1/pets/${pet.id}/vet-instructions`, {
        fileId,
        issuedOn: '2026-10-01',
        vetName: 'Dra. Rivas',
      })
      .expect(201);
    return { pet, instruction: body as { id: string; fileUrl: string } };
  }

  const careNeed = (token: string, petId: string, body: Record<string, unknown>) =>
    as(token).post(`/v1/pets/${petId}/care-needs`, { startsOn: '2026-11-01', ...body });

  // RN-MAS-06, RN-MAS-08, RN-MAS-09
  describe('vet instructions and care needs', () => {
    it('keeps the vet instructions with a link to the document', async () => {
      const token = await owner();
      const { pet, instruction } = await petWithInstructions(token);

      const { body } = await as(token).get(`/v1/pets/${pet.id}`).expect(200);

      expect(body.vetInstructions).toMatchObject([
        {
          id: instruction.id,
          issuedOn: '2026-10-01',
          vetName: 'Dra. Rivas',
          contentType: 'application/pdf',
        },
      ]);
      expect((await fetch(instruction.fileUrl)).status).toBe(200);
    });

    it('asks for the vet instructions for clinical tasks', async () => {
      const token = await owner();
      const { pet, instruction } = await petWithInstructions(token);

      const missing = await careNeed(token, pet.id, {
        task: 'MEDICATION',
        endsOn: '2026-11-10',
      }).expect(422);
      const { body } = await careNeed(token, pet.id, {
        task: 'MEDICATION',
        endsOn: '2026-11-10',
        vetInstructionId: instruction.id,
      }).expect(201);

      expect(missing.body).toEqual({
        statusCode: 422,
        errorCode: 'VET_INSTRUCTIONS_REQUIRED',
        message: 'Para darle medicamentos hacen falta las indicaciones escritas del veterinario.',
      });
      expect(body).toMatchObject({ task: 'MEDICATION', group: 'CLINICAL', endsOn: '2026-11-10' });
    });

    it("asks for the owner's instructions for assistance tasks, and lets mobility help be open-ended", async () => {
      const token = await owner();
      const pet = await createPet(token);

      const missing = await careNeed(token, pet.id, { task: 'MOBILITY_ASSISTANCE' }).expect(422);
      const { body } = await careNeed(token, pet.id, {
        task: 'MOBILITY_ASSISTANCE',
        ownerInstructions: 'Levantarla con el arnés para salir al patio.',
      }).expect(201);

      expect(missing.body.errorCode).toBe('OWNER_INSTRUCTIONS_REQUIRED');
      expect(body).toMatchObject({ group: 'ASSISTANCE', endsOn: null });
    });

    it('asks for an end date where it is required', async () => {
      const token = await owner();
      const pet = await createPet(token);

      const response = await careNeed(token, pet.id, {
        task: 'INCONTINENCE_HYGIENE',
        ownerInstructions: 'Cambiarle el pañal en cada visita.',
      }).expect(422);

      expect(response.body).toMatchObject({ errorCode: 'END_DATE_REQUIRED' });
    });

    it('takes prohibited needs without instructions or end date', async () => {
      const token = await owner();
      const pet = await createPet(token);

      const { body } = await careNeed(token, pet.id, { task: 'INJECTION' }).expect(201);

      expect(body).toMatchObject({ group: 'PROHIBITED', endsOn: null, vetInstructionId: null });
    });

    it("rejects another pet's vet instructions", async () => {
      const token = await owner();
      const { instruction } = await petWithInstructions(token);
      const other = await createPet(token, { name: 'Toby' });

      const response = await careNeed(token, other.id, {
        task: 'WOUND_CARE',
        endsOn: '2026-11-05',
        vetInstructionId: instruction.id,
      }).expect(404);

      expect(response.body.errorCode).toBe('VET_INSTRUCTION_NOT_FOUND');
    });

    it('closes an open-ended need by giving it an end date, and deletes it', async () => {
      const token = await owner();
      const pet = await createPet(token);
      const need = await careNeed(token, pet.id, { task: 'IV_FLUIDS' }).expect(201);
      const path = `/v1/pets/${pet.id}/care-needs/${need.body.id}`;

      const closed = await as(token)
        .put(path, { task: 'IV_FLUIDS', startsOn: '2026-11-01', endsOn: '2026-11-03' })
        .expect(200);
      const backwards = await as(token)
        .put(path, { task: 'IV_FLUIDS', startsOn: '2026-11-01', endsOn: '2026-10-31' })
        .expect(422);

      expect(closed.body.endsOn).toBe('2026-11-03');
      expect(backwards.body.errorCode).toBe('INVALID_DATES');
      await as(token).delete(path).expect(204);
      await as(token).delete(path).expect(404);
    });

    it('keeps instructions that a care need relies on', async () => {
      const token = await owner();
      const { pet, instruction } = await petWithInstructions(token);
      await careNeed(token, pet.id, {
        task: 'PRESCRIBED_REST',
        endsOn: '2026-11-15',
        vetInstructionId: instruction.id,
      }).expect(201);

      const response = await as(token)
        .delete(`/v1/pets/${pet.id}/vet-instructions/${instruction.id}`)
        .expect(409);

      expect(response.body.errorCode).toBe('VET_INSTRUCTION_IN_USE');
    });
  });

  describe('heat (RN-MAS-11)', () => {
    it('marks a female in heat between two days, and clears it on edit', async () => {
      const token = await owner();
      const heat = { heatStartsOn: '2026-11-03', heatEndsOn: '2026-11-12' };

      const created = await as(token).post('/v1/pets', luna(heat)).expect(201);
      const listed = await as(token).get('/v1/pets').expect(200);
      const cleared = await as(token).put(`/v1/pets/${created.body.id}`, luna()).expect(200);

      expect(created.body).toMatchObject(heat);
      expect(listed.body[0]).toMatchObject(heat);
      expect(cleared.body).toMatchObject({ heatStartsOn: null, heatEndsOn: null });
    });

    it('takes heat only for a female, with both days in order', async () => {
      const token = await owner();
      const post = (overrides: Record<string, unknown>) =>
        as(token).post('/v1/pets', luna(overrides)).expect(422);

      const male = await post({
        sex: 'MALE',
        heatStartsOn: '2026-11-03',
        heatEndsOn: '2026-11-12',
      });
      const oneDay = await post({ heatStartsOn: '2026-11-03' });
      const backwards = await post({ heatStartsOn: '2026-11-12', heatEndsOn: '2026-11-03' });

      expect(male.body).toEqual({
        statusCode: 422,
        errorCode: 'HEAT_ONLY_FOR_FEMALES',
        message: 'Solo una hembra puede estar en celo.',
      });
      expect(oneDay.body.errorCode).toBe('INVALID_DATES');
      expect(backwards.body.errorCode).toBe('INVALID_DATES');
    });

    it('takes heat for a sterilized female, because the owner may not know', async () => {
      const token = await owner();

      await as(token)
        .post(
          '/v1/pets',
          luna({ isSterilized: true, heatStartsOn: '2026-11-03', heatEndsOn: '2026-11-03' }),
        )
        .expect(201);
    });
  });

  // RN-MAS-02, RN-MAS-12, RN-CUI-12
  describe('schedule', () => {
    const scheduleItem = (token: string, petId: string, body: Record<string, unknown>) =>
      as(token).post(`/v1/pets/${petId}/schedule-items`, body);

    async function medicationNeed(token: string) {
      const { pet, instruction } = await petWithInstructions(token);
      const { body } = await careNeed(token, pet.id, {
        task: 'MEDICATION',
        endsOn: '2026-11-10',
        vetInstructionId: instruction.id,
      }).expect(201);
      return { pet, need: body as { id: string }, instruction };
    }

    it('shows a meal at 7:00 in the profile, in order of time', async () => {
      const token = await owner();
      const pet = await createPet(token);
      await scheduleItem(token, pet.id, { kind: 'MEAL', minuteOfDay: 1080, label: 'Cena' }).expect(
        201,
      );
      await scheduleItem(token, pet.id, {
        kind: 'MEAL',
        minuteOfDay: 420,
        label: 'Desayuno',
        dose: '1 taza',
      }).expect(201);

      const { body } = await as(token).get(`/v1/pets/${pet.id}`).expect(200);

      expect(body.scheduleItems).toEqual([
        {
          id: expect.any(String),
          kind: 'MEAL',
          minuteOfDay: 420,
          label: 'Desayuno',
          dose: '1 taza',
          careNeedId: null,
        },
        {
          id: expect.any(String),
          kind: 'MEAL',
          minuteOfDay: 1080,
          label: 'Cena',
          dose: null,
          careNeedId: null,
        },
      ]);
    });

    it('edits an item in place, keeping its id, and deletes it', async () => {
      const token = await owner();
      const pet = await createPet(token);
      const created = await scheduleItem(token, pet.id, {
        kind: 'MEAL',
        minuteOfDay: 420,
        label: 'Desayuno',
      }).expect(201);
      const path = `/v1/pets/${pet.id}/schedule-items/${created.body.id}`;

      const edited = await as(token)
        .put(path, { kind: 'MEAL', minuteOfDay: 450, label: 'Desayuno', dose: '1 taza' })
        .expect(200);

      expect(edited.body).toMatchObject({ id: created.body.id, minuteOfDay: 450, dose: '1 taza' });
      await as(token).delete(path).expect(204);
      const missing = await as(token).delete(path).expect(404);
      expect(missing.body.errorCode).toBe('SCHEDULE_ITEM_NOT_FOUND');
    });

    it('hangs a medication dose from a Medicación task of the same pet', async () => {
      const token = await owner();
      const { pet, need } = await medicationNeed(token);
      const mobility = await careNeed(token, pet.id, {
        task: 'MOBILITY_ASSISTANCE',
        ownerInstructions: 'Levantarla con el arnés.',
      }).expect(201);
      const other = await medicationNeed(token);
      const dose = { kind: 'MEDICATION', minuteOfDay: 480, label: 'Amoxicilina' };

      const loose = await scheduleItem(token, pet.id, dose).expect(422);
      const notMedication = await scheduleItem(token, pet.id, {
        ...dose,
        careNeedId: mobility.body.id,
      }).expect(422);
      const otherPet = await scheduleItem(token, pet.id, {
        ...dose,
        careNeedId: other.need.id,
      }).expect(404);
      const { body } = await scheduleItem(token, pet.id, {
        ...dose,
        dose: 'Media pastilla',
        careNeedId: need.id,
      }).expect(201);

      expect(loose.body).toEqual({
        statusCode: 422,
        errorCode: 'MEDICATION_TASK_REQUIRED',
        message:
          'Para que el cuidador le dé una medicina, agrégala primero como tarea de cuidado Medicación, con las indicaciones del veterinario.',
      });
      expect(notMedication.body.errorCode).toBe('MEDICATION_TASK_REQUIRED');
      expect(otherPet.body.errorCode).toBe('CARE_NEED_NOT_FOUND');
      expect(body).toMatchObject({ kind: 'MEDICATION', careNeedId: need.id });
    });

    it('takes no care need for a meal', async () => {
      const token = await owner();
      const { pet, need } = await medicationNeed(token);

      const response = await scheduleItem(token, pet.id, {
        kind: 'MEAL',
        minuteOfDay: 420,
        label: 'Desayuno',
        careNeedId: need.id,
      }).expect(422);

      expect(response.body.errorCode).toBe('CARE_NEED_NOT_ALLOWED');
    });

    it('deletes the doses with their task, and keeps the task a medication while it has doses', async () => {
      const token = await owner();
      const { pet, need, instruction } = await medicationNeed(token);
      await scheduleItem(token, pet.id, {
        kind: 'MEDICATION',
        minuteOfDay: 480,
        label: 'Amoxicilina',
        careNeedId: need.id,
      }).expect(201);
      const path = `/v1/pets/${pet.id}/care-needs/${need.id}`;

      const changed = await as(token)
        .put(path, {
          task: 'WOUND_CARE',
          startsOn: '2026-11-01',
          endsOn: '2026-11-10',
          vetInstructionId: instruction.id,
        })
        .expect(409);
      await as(token).delete(path).expect(204);
      const { body } = await as(token).get(`/v1/pets/${pet.id}`).expect(200);

      expect(changed.body.errorCode).toBe('CARE_NEED_HAS_DOSES');
      expect(body.scheduleItems).toEqual([]);
    });

    it('rejects a time outside the day and an empty label', async () => {
      const token = await owner();
      const pet = await createPet(token);

      const response = await scheduleItem(token, pet.id, {
        kind: 'MEAL',
        minuteOfDay: 1440,
        label: ' ',
      }).expect(400);

      expect(response.body.details).toEqual({
        minuteOfDay: ['Elige una hora.'],
        label: ['Escribe qué es.'],
      });
    });

    it("does not let anyone else touch a pet's schedule", async () => {
      const token = await owner();
      const pet = await createPet(token);
      const item = await scheduleItem(token, pet.id, {
        kind: 'MEAL',
        minuteOfDay: 420,
        label: 'Desayuno',
      }).expect(201);
      const stranger = await owner();
      const meal = { kind: 'MEAL', minuteOfDay: 420, label: 'Desayuno' };

      await scheduleItem(stranger, pet.id, meal).expect(404);
      await as(stranger).put(`/v1/pets/${pet.id}/schedule-items/${item.body.id}`, meal).expect(404);
      await as(stranger).delete(`/v1/pets/${pet.id}/schedule-items/${item.body.id}`).expect(404);
    });
  });
});
