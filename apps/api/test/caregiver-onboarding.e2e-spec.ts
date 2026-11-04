import { approveCaregiverCommand } from '../src/caregivers/approve-caregiver.command.js';
import {
  addDays,
  dateInElSalvador,
  formatDateOnly,
  isoWeekday,
} from '../src/common/time/calendar.js';
import type { UploadPurpose } from '../src/files/files.dto.js';
import type { CaregiverDocumentKind } from '../src/generated/prisma/enums.js';
import { seedDatabase } from '../src/seed/seed-database.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import { createUser } from './factories.js';
import { uploadFile } from './uploads.js';
import { useApi } from './use-api.js';

/** The next Wednesday at least three days ahead, in El Salvador. */
function nextWednesday(): string {
  let day = addDays(dateInElSalvador(new Date()), 3);
  while (isoWeekday(day) !== 3) {
    day = addDays(day, 1);
  }
  return formatDateOnly(day);
}
const WEDNESDAY_10AM = `${nextWednesday()}T10:00:00-06:00`;

/** RN-CUI-01: the four documents and the purpose each file is uploaded with. */
const DOCUMENTS: [CaregiverDocumentKind, UploadPurpose][] = [
  ['ID_DOCUMENT_FRONT', 'ID_DOCUMENT'],
  ['ID_DOCUMENT_BACK', 'ID_DOCUMENT'],
  ['SELFIE', 'SELFIE'],
  ['BACKGROUND_CHECK', 'BACKGROUND_CHECK'],
];

/** The franjas of the app: mornings and afternoons, every day (RN-CUI-04). */
const DAYTIME = [1, 2, 3, 4, 5, 6, 7].flatMap((weekday) => [
  { weekday, startMinute: 7 * 60, endMinute: 12 * 60 },
  { weekday, startMinute: 12 * 60, endMinute: 19 * 60 },
]);

describe('caregiver sign-up (stage 9a)', () => {
  let db: TestDatabase;
  let settings: SettingsService;
  const districts: Record<string, string> = {};

  beforeAll(async () => {
    db = await createTestDatabase();
    settings = new SettingsService(db.prisma);
    await seedDatabase(db.prisma, settings);
    for (const { slug, id } of await db.prisma.district.findMany()) {
      districts[slug] = id;
    }
  });

  afterAll(async () => {
    await db.close();
  });

  const api = useApi(() => db);

  /** A new owner account, as everyone starts (RN-CTA-06), and requests signed as it. */
  async function account() {
    const user = await createUser(db.prisma);
    const token = await api.tokenFor(user);
    return {
      user,
      token,
      get: (url: string) => api.http().get(url).auth(token, { type: 'bearer' }),
      post: (url: string, body?: object) =>
        api.http().post(url).auth(token, { type: 'bearer' }).send(body),
      patch: (url: string, body: object) =>
        api.http().patch(url).auth(token, { type: 'bearer' }).send(body),
    };
  }
  type Account = Awaited<ReturnType<typeof account>>;

  async function caregiver(): Promise<Account> {
    const created = await account();
    await created.post('/v1/caregivers/me').expect(201);
    return created;
  }

  /** Uploads the documents and attaches them, expecting a 200. Returns the response. */
  async function uploadDocuments(of: Account, documents = DOCUMENTS) {
    const uploaded = [];
    for (const [kind, purpose] of documents) {
      uploaded.push({ kind, fileId: await uploadFile(api, of.token, purpose) });
    }
    return of.patch('/v1/caregivers/me', { documents: uploaded }).expect(200);
  }

  /** The exam, answered right or with the first `wrong` questions wrong. */
  async function examAnswers(wrong = 0) {
    const questions = await db.prisma.courseQuestion.findMany({
      orderBy: [{ module: { position: 'asc' } }, { position: 'asc' }],
    });
    return questions.map(({ id, correctOption, options }, index) => ({
      questionId: id,
      option: index < wrong ? (correctOption + 1) % options.length : correctOption,
    }));
  }

  async function approve(email: string) {
    const output = { log: [] as string[], error: [] as string[] };
    const exitCode = await approveCaregiverCommand([email], db.prisma, {
      log: (message) => output.log.push(message),
      error: (message) => output.error.push(message),
    });
    return { exitCode, ...output };
  }

  /** The caregivers another owner finds for a visit on Wednesday at 10:00 in San Salvador. */
  async function searchFromAnotherAccount(): Promise<string[]> {
    const owner = await account();
    const dog = await db.prisma.species.findUniqueOrThrow({ where: { code: 'DOG' } });
    const pet = await db.prisma.pet.create({
      data: {
        ownerId: owner.user.id,
        speciesId: dog.id,
        name: 'Toby',
        birthDate: new Date('2019-01-01'),
        sex: 'MALE',
      },
    });
    const { body } = await owner
      .post('/v1/caregivers/search', {
        petIds: [pet.id],
        serviceCode: 'HOME_VISIT',
        visits: [WEDNESDAY_10AM],
        districtId: districts['san-salvador'],
      })
      .expect(200);
    return (body.results as { id: string }[]).map(({ id }) => id);
  }

  it('takes an owner account from caregiver mode to another owner’s search (RN-CTA-06, RN-CUI-01 to RN-CUI-04)', async () => {
    const maria = await account();

    const created = await maria.post('/v1/caregivers/me').expect(201);
    expect(created.body).toMatchObject({
      status: 'PENDING_APPROVAL',
      isPaused: false,
      level: 'NEW',
      badges: [],
      documents: [],
      welcomeCoursePassedAt: null,
      pendingSteps: ['DOCUMENTS', 'WELCOME_COURSE', 'APPROVAL', 'DISTRICTS', 'AVAILABILITY'],
      visibleInSearch: false,
    });
    expect((await maria.get('/v1/users/me').expect(200)).body).toMatchObject({
      roles: ['OWNER', 'CAREGIVER'],
      mode: 'CAREGIVER',
    });

    const withDocuments = await uploadDocuments(maria);
    expect(withDocuments.body.documents.map(({ kind }: { kind: string }) => kind)).toEqual([
      'BACKGROUND_CHECK',
      'ID_DOCUMENT_BACK',
      'ID_DOCUMENT_FRONT',
      'SELFIE',
    ]);
    expect(withDocuments.body.pendingSteps[0]).toBe('WELCOME_COURSE');

    await maria.post('/v1/courses/welcome/attempts', { answers: await examAnswers() }).expect(201);
    expect((await approve(maria.user.email)).exitCode).toBe(0);
    const approved = await maria.get('/v1/caregivers/me').expect(200);
    expect(approved.body).toMatchObject({
      status: 'APPROVED',
      badges: ['IDENTITY_VERIFIED', 'BACKGROUND_CHECKED'],
      pendingSteps: ['DISTRICTS', 'AVAILABILITY'],
    });
    expect(await searchFromAnotherAccount()).not.toContain(maria.user.id);

    const photoFileId = await uploadFile(api, maria.token, 'CAREGIVER_PHOTO');
    const filled = await maria
      .patch('/v1/caregivers/me', {
        bio: 'Estudio veterinaria y tengo dos perros.',
        photoFileId,
        skills: ['LARGE_DOGS', 'PUPPIES'],
        districtIds: [districts['santa-tecla'], districts['san-salvador']],
        availability: DAYTIME,
        prices: [{ serviceCode: 'HOME_VISIT', priceCents: 800 }],
        instantBooking: true,
      })
      .expect(200);
    expect(filled.body).toMatchObject({
      bio: 'Estudio veterinaria y tengo dos perros.',
      photoUrl: expect.any(String),
      skills: ['LARGE_DOGS', 'PUPPIES'],
      districts: [{ slug: 'san-salvador' }, { slug: 'santa-tecla' }],
      instantBooking: true,
      pendingSteps: [],
      visibleInSearch: true,
    });
    expect(filled.body.availability).toHaveLength(14);

    expect(await searchFromAnotherAccount()).toContain(maria.user.id);
    const profile = await maria.get(`/v1/caregivers/${maria.user.id}`).expect(200);
    expect(profile.body).toMatchObject({
      displayName: 'Ana P.',
      skills: ['LARGE_DOGS', 'PUPPIES'],
      prices: [{ serviceCode: 'HOME_VISIT', priceCents: 800 }],
    });
  });

  it('hides a paused caregiver and shows them again when they resume (RN-CUI-20)', async () => {
    const lucia = await caregiver();
    await uploadDocuments(lucia);
    await lucia.post('/v1/courses/welcome/attempts', { answers: await examAnswers() }).expect(201);
    await approve(lucia.user.email);
    await lucia
      .patch('/v1/caregivers/me', {
        districtIds: [districts['san-salvador']],
        availability: DAYTIME,
      })
      .expect(200);

    const paused = await lucia.patch('/v1/caregivers/me', { isPaused: true }).expect(200);

    expect(paused.body).toMatchObject({ isPaused: true, pendingSteps: [], visibleInSearch: false });
    expect(await searchFromAnotherAccount()).not.toContain(lucia.user.id);

    await lucia.patch('/v1/caregivers/me', { isPaused: false }).expect(200);
    expect(await searchFromAnotherAccount()).toContain(lucia.user.id);
  });

  describe('turning caregiver mode on (RN-CTA-06)', () => {
    it('has no caregiver profile before', async () => {
      const owner = await account();

      const response = await owner.get('/v1/caregivers/me').expect(404);

      expect(response.body.errorCode).toBe('CAREGIVER_PROFILE_NOT_FOUND');
    });

    it('turns it on once', async () => {
      const ana = await caregiver();

      const response = await ana.post('/v1/caregivers/me').expect(409);

      expect(response.body.errorCode).toBe('CAREGIVER_PROFILE_EXISTS');
    });

    it('remembers the last mode in the account', async () => {
      const ana = await account();

      const refused = await ana.patch('/v1/users/me', { mode: 'CAREGIVER' }).expect(422);
      expect(refused.body.errorCode).toBe('CAREGIVER_PROFILE_NOT_FOUND');

      await ana.post('/v1/caregivers/me').expect(201);
      const owner = await ana.patch('/v1/users/me', { mode: 'OWNER' }).expect(200);
      expect(owner.body.mode).toBe('OWNER');
      expect((await ana.get('/v1/users/me').expect(200)).body.mode).toBe('OWNER');
    });

    it('offers every service at the suggested price to start (RN-CUI-17)', async () => {
      const ana = await caregiver();

      const { body } = await ana.get('/v1/caregivers/me/prices').expect(200);

      expect(body.prices).toMatchObject([
        { serviceCode: 'HOME_VISIT', offered: true, caregiverPriceCents: null, priceCents: 700 },
        {
          serviceCode: 'OVERNIGHT_STAY',
          offered: true,
          caregiverPriceCents: null,
          priceCents: 1800,
        },
      ]);
    });
  });

  describe('documents (RN-CUI-01)', () => {
    it('asks for both sides of the DUI, the selfie and the background check', async () => {
      const ana = await caregiver();

      const { body } = await uploadDocuments(ana, DOCUMENTS.slice(0, 3));

      expect(body.pendingSteps[0]).toBe('DOCUMENTS');
      expect(body.documents[0].file).toMatchObject({ url: expect.any(String) });
    });

    it('only takes a file uploaded for that document', async () => {
      const ana = await caregiver();
      const selfie = await uploadFile(api, ana.token, 'SELFIE');

      const response = await ana
        .patch('/v1/caregivers/me', { documents: [{ kind: 'BACKGROUND_CHECK', fileId: selfie }] })
        .expect(422);

      expect(response.body.errorCode).toBe('WRONG_FILE_PURPOSE');
    });

    it('never takes another account’s file', async () => {
      const ana = await caregiver();
      const someoneElse = await caregiver();
      const theirs = await uploadFile(api, someoneElse.token, 'SELFIE');

      const response = await ana
        .patch('/v1/caregivers/me', { documents: [{ kind: 'SELFIE', fileId: theirs }] })
        .expect(404);

      expect(response.body.errorCode).toBe('FILE_NOT_FOUND');
    });

    it('locks them once the sign-up is approved', async () => {
      const ana = await caregiver();
      await uploadDocuments(ana);
      await approve(ana.user.email);
      const selfie = await uploadFile(api, ana.token, 'SELFIE');

      const response = await ana
        .patch('/v1/caregivers/me', { documents: [{ kind: 'SELFIE', fileId: selfie }] })
        .expect(409);

      expect(response.body.errorCode).toBe('DOCUMENTS_LOCKED');
    });
  });

  describe('pnpm caregivers:approve (RN-CUI-03)', () => {
    it('needs every document', async () => {
      const ana = await caregiver();
      await uploadDocuments(ana, DOCUMENTS.slice(1));

      const result = await approve(ana.user.email);

      expect(result.exitCode).toBe(1);
      expect(result.error.join('\n')).toContain('DUI (frente)');
      expect((await ana.get('/v1/caregivers/me')).body.status).toBe('PENDING_APPROVAL');
    });

    it('approves without the welcome course, which searches ask for on their own', async () => {
      const ana = await caregiver();
      await uploadDocuments(ana);
      await ana
        .patch('/v1/caregivers/me', {
          districtIds: [districts['san-salvador']],
          availability: DAYTIME,
        })
        .expect(200);

      expect((await approve(ana.user.email)).exitCode).toBe(0);

      const { body } = await ana.get('/v1/caregivers/me').expect(200);
      expect(body).toMatchObject({ status: 'APPROVED', pendingSteps: ['WELCOME_COURSE'] });
      expect(await searchFromAnotherAccount()).not.toContain(ana.user.id);
    });

    it('says when there is nothing to approve', async () => {
      const ana = await caregiver();
      await uploadDocuments(ana);
      await approve(ana.user.email);

      expect(await approve(ana.user.email)).toMatchObject({
        exitCode: 0,
        log: [`${ana.user.email} ya estaba aprobado.`],
      });
      expect((await approve('nadie@example.com')).exitCode).toBe(1);
      expect((await approve('')).exitCode).toBe(1);
    });
  });

  describe('welcome course (RN-CUI-02)', () => {
    it('has the four modules, with the questions but not their answers', async () => {
      const ana = await caregiver();

      const { body } = await ana.get('/v1/courses/welcome').expect(200);

      expect(body).toMatchObject({ passingScoreBp: 8000, passedAt: null });
      expect(body.modules.map(({ title }: { title: string }) => title)).toEqual([
        'Reglas de la plataforma',
        'Manejo de perros y gatos',
        'Respetar la ficha y la rutina',
        'Qué hacer en una emergencia',
      ]);
      expect(Object.keys(body.modules[0].questions[0]).toSorted()).toEqual([
        'id',
        'options',
        'prompt',
      ]);
    });

    it('fails below 80%, can be repeated, and keeps the first pass', async () => {
      const ana = await caregiver();

      const failed = await ana
        .post('/v1/courses/welcome/attempts', { answers: await examAnswers(3) })
        .expect(201);
      expect(failed.body).toMatchObject({
        scoreBp: 7500,
        passed: false,
        correctCount: 9,
        questionCount: 12,
        passedAt: null,
      });
      expect(failed.body.incorrectQuestionIds).toHaveLength(3);

      const passed = await ana
        .post('/v1/courses/welcome/attempts', { answers: await examAnswers(2) })
        .expect(201);
      expect(passed.body).toMatchObject({ scoreBp: 8333, passed: true });
      expect(passed.body.passedAt).not.toBeNull();

      const again = await ana
        .post('/v1/courses/welcome/attempts', { answers: await examAnswers(5) })
        .expect(201);
      expect(again.body).toMatchObject({ passed: false, passedAt: passed.body.passedAt });
      expect(await db.prisma.courseAttempt.count({ where: { caregiverId: ana.user.id } })).toBe(3);
    });

    it('needs one answer for each question', async () => {
      const ana = await caregiver();
      const answers = await examAnswers();

      const response = await ana
        .post('/v1/courses/welcome/attempts', { answers: answers.slice(1) })
        .expect(422);

      expect(response.body.errorCode).toBe('INVALID_ANSWERS');
    });

    it('is only for caregivers', async () => {
      const owner = await account();

      const response = await owner.get('/v1/courses/welcome').expect(404);

      expect(response.body.errorCode).toBe('CAREGIVER_PROFILE_NOT_FOUND');
    });
  });

  describe('profile (RN-CUI-18)', () => {
    it('refuses two windows of the same day that overlap (RN-CUI-04)', async () => {
      const ana = await caregiver();

      const response = await ana
        .patch('/v1/caregivers/me', {
          availability: [
            { weekday: 1, startMinute: 7 * 60, endMinute: 13 * 60 },
            { weekday: 1, startMinute: 12 * 60, endMinute: 19 * 60 },
          ],
        })
        .expect(422);

      expect(response.body.errorCode).toBe('INVALID_AVAILABILITY');
    });

    it('takes districts of the catalog only', async () => {
      const ana = await caregiver();

      const response = await ana
        .patch('/v1/caregivers/me', { districtIds: ['0190a0e0-0000-7000-8000-000000000000'] })
        .expect(422);

      expect(response.body.errorCode).toBe('UNKNOWN_DISTRICT');
    });

    it('leaves alone what the request does not send', async () => {
      const ana = await caregiver();
      await ana.patch('/v1/caregivers/me', { bio: 'Hola', skills: ['CATS'] }).expect(200);

      const { body } = await ana.patch('/v1/caregivers/me', { instantBooking: true }).expect(200);

      expect(body).toMatchObject({ bio: 'Hola', skills: ['CATS'], instantBooking: true });
    });
  });

  describe('prices and the calculator (RN-CUI-17, RN-PRE-01, RN-PRE-04)', () => {
    afterEach(async () => {
      await settings.set('pricing.caregiverCommissionBp', 0, { changedBy: 'test' });
    });

    it('shows the range and suggested price of the level, and the next level’s', async () => {
      const ana = await caregiver();

      const { body } = await ana.get('/v1/caregivers/me/prices').expect(200);

      expect(body).toEqual({
        level: 'NEW',
        prices: [
          {
            serviceCode: 'HOME_VISIT',
            offered: true,
            caregiverPriceCents: null,
            priceCents: 700,
            payoutCents: 700,
            range: { minCents: 600, suggestedCents: 700, maxCents: 900 },
            nextLevel: { level: 'TRUSTED', suggestedCents: 1000 },
          },
          {
            serviceCode: 'OVERNIGHT_STAY',
            offered: true,
            caregiverPriceCents: null,
            priceCents: 1800,
            payoutCents: 1800,
            range: { minCents: 1500, suggestedCents: 1800, maxCents: 2200 },
            nextLevel: { level: 'TRUSTED', suggestedCents: 2400 },
          },
        ],
      });
    });

    it('answers 422 to a price out of the range, saving it or quoting it', async () => {
      const ana = await caregiver();

      const saved = await ana
        .patch('/v1/caregivers/me', { prices: [{ serviceCode: 'HOME_VISIT', priceCents: 1000 }] })
        .expect(422);
      const quoted = await ana
        .post('/v1/caregivers/me/prices/quote', { serviceCode: 'HOME_VISIT', priceCents: 550 })
        .expect(422);

      for (const { body } of [saved, quoted]) {
        expect(body).toMatchObject({
          errorCode: 'PRICE_OUT_OF_RANGE',
          message: 'Para tu nivel, el precio de la visita va de $6.00 a $9.00.',
          details: { serviceCode: 'HOME_VISIT', minCents: 600, maxCents: 900 },
        });
      }
    });

    it('stops offering a service left out of the prices', async () => {
      const ana = await caregiver();

      await ana
        .patch('/v1/caregivers/me', { prices: [{ serviceCode: 'HOME_VISIT', priceCents: 850 }] })
        .expect(200);

      const { body } = await ana.get('/v1/caregivers/me/prices').expect(200);
      expect(body.prices).toMatchObject([
        { serviceCode: 'HOME_VISIT', offered: true, caregiverPriceCents: 850, priceCents: 850 },
        { serviceCode: 'OVERNIGHT_STAY', offered: false },
      ]);
    });

    it('shows what the caregiver gets with the commission in force, without changing the app', async () => {
      const ana = await caregiver();
      await settings.set('pricing.caregiverCommissionBp', 1000, { changedBy: 'test' });

      const quote = await ana
        .post('/v1/caregivers/me/prices/quote', { serviceCode: 'HOME_VISIT', priceCents: 650 })
        .expect(200);
      const prices = await ana.get('/v1/caregivers/me/prices').expect(200);

      // The example of RN-PRE: $6.50 with a 10% commission leaves $5.85.
      expect(quote.body).toEqual({ serviceCode: 'HOME_VISIT', priceCents: 650, payoutCents: 585 });
      expect(prices.body.prices[0]).toMatchObject({ priceCents: 700, payoutCents: 630 });
    });

    it('shows no next level to a Súper Cuidador', async () => {
      const valeria = await db.prisma.user.findUniqueOrThrow({
        where: { email: 'valeria.martinez@example.com' },
      });
      const token = await api.tokenFor(valeria);

      const prices = await api
        .http()
        .get('/v1/caregivers/me/prices')
        .auth(token, { type: 'bearer' })
        .expect(200);
      const level = await api
        .http()
        .get('/v1/caregivers/me/level')
        .auth(token, { type: 'bearer' })
        .expect(200);

      expect(prices.body.level).toBe('SUPER');
      for (const price of prices.body.prices) {
        expect(price.nextLevel).toBeNull();
      }
      expect(level.body).toEqual({ level: 'SUPER', next: null });
    });
  });

  describe('level (RN-NIV-05)', () => {
    it('lists each requirement of the next level, met or not', async () => {
      const ana = await caregiver();
      await db.prisma.caregiverProfile.update({
        where: { userId: ana.user.id },
        data: { ratingCount: 12, ratingSum: 58, completedBookingCount: 14 },
      });

      const { body } = await ana.get('/v1/caregivers/me/level').expect(200);

      expect(body).toEqual({
        level: 'TRUSTED',
        next: {
          level: 'PRO',
          requirements: [
            { kind: 'REVIEWS', current: 12, required: 3, met: true, certification: null },
            { kind: 'AVERAGE_RATING', current: 4.8, required: 4.6, met: true, certification: null },
            {
              kind: 'COMPLETED_BOOKINGS',
              current: 14,
              required: 15,
              met: false,
              certification: null,
            },
            { kind: 'CERTIFICATIONS', current: 0, required: 2, met: false, certification: null },
          ],
        },
      });
    });

    it('names the certification Súper Cuidador asks for', async () => {
      const ana = await caregiver();
      await db.prisma.caregiverProfile.update({
        where: { userId: ana.user.id },
        data: { ratingCount: 50, ratingSum: 245, completedBookingCount: 40, level: 'PRO' },
      });
      const types = await db.prisma.certificationType.findMany({
        where: { code: { in: ['SPECIAL_CARE', 'LARGE_DOGS', 'CATS'] } },
      });
      await db.prisma.caregiverCertification.createMany({
        data: types.map(({ id }) => ({
          caregiverId: ana.user.id,
          certificationTypeId: id,
          obtainedOn: new Date('2026-01-01'),
          validUntil: new Date('2099-01-01'),
        })),
      });

      const { body } = await ana.get('/v1/caregivers/me/level').expect(200);

      expect(body.next.requirements.at(-1)).toEqual({
        kind: 'CERTIFICATION',
        current: 0,
        required: 1,
        met: false,
        certification: { code: 'FIRST_AID', name: 'Primeros auxilios' },
      });
    });
  });
});
