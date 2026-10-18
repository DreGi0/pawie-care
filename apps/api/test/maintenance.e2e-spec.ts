import { randomUUID } from 'node:crypto';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { StorageService } from '../src/files/storage.service.js';
import { MAINTENANCE_QUEUE } from '../src/maintenance/maintenance.processor.js';
import { MaintenanceService } from '../src/maintenance/maintenance.service.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import { type Catalog, createCatalog, createUser } from './factories.js';
import { uploadFile } from './uploads.js';
import { useApi } from './use-api.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('maintenance', () => {
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
  const maintenance = () => api.app().get(MaintenanceService);
  const queue = () => api.app().get<Queue>(getQueueToken(MAINTENANCE_QUEUE));

  // A scheduler with `every` runs its first job as soon as it's created. Wait for those
  // first runs, so they don't clean up behind the tests' back; the next ones are an hour away.
  beforeAll(async () => {
    await vi.waitFor(
      async () => {
        expect(await queue().getJobSchedulersCount()).toBe(2);
        expect(await queue().getJobCounts('waiting', 'active', 'prioritized')).toEqual({
          waiting: 0,
          active: 0,
          prioritized: 0,
        });
      },
      { timeout: 10_000, interval: 50 },
    );
  });

  it('deletes the refresh tokens that expired, and keeps the valid ones', async () => {
    const user = await createUser(db.prisma);
    const token = (expiresAt: Date) => ({
      userId: user.id,
      familyId: user.id,
      tokenHash: randomUUID(),
      expiresAt,
    });
    await db.prisma.refreshToken.createMany({
      data: [token(new Date(Date.now() - 1000)), token(new Date(Date.now() + DAY_MS))],
    });

    expect(await maintenance().deleteExpiredRefreshTokens()).toBe(1);
    expect(await db.prisma.refreshToken.count({ where: { userId: user.id } })).toBe(1);
  });

  it('deletes uploads that were never finished or never used, with their objects', async () => {
    const owner = await createUser(db.prisma);
    const token = await api.tokenFor(owner);
    const unused = await uploadFile(api, token, 'PET_PHOTO');
    const photo = await uploadFile(api, token, 'PET_PHOTO');
    const prescription = await uploadFile(api, token, 'VET_INSTRUCTION');
    const recent = await uploadFile(api, token, 'PET_PHOTO');
    const unfinished = (
      await api
        .http()
        .post('/v1/files')
        .auth(token, { type: 'bearer' })
        .send({ purpose: 'PET_PHOTO', contentType: 'image/jpeg', sizeBytes: 10 })
        .expect(201)
    ).body.file.id as string;
    const pet = await db.prisma.pet.create({
      data: {
        ownerId: owner.id,
        speciesId: catalog.speciesId,
        name: 'Luna',
        birthDate: new Date('2020-01-01'),
        sex: 'FEMALE',
        photoFileId: photo,
      },
    });
    await db.prisma.vetInstruction.create({
      data: { petId: pet.id, fileId: prescription, issuedOn: new Date('2026-10-01') },
    });
    // Everything but `recent` was created two days ago.
    await db.prisma.file.updateMany({
      where: { id: { in: [unused, photo, prescription, unfinished] } },
      data: { createdAt: new Date(Date.now() - 2 * DAY_MS) },
    });
    const unusedKey = (await db.prisma.file.findUniqueOrThrow({ where: { id: unused } }))
      .storageKey;

    const deleted = await maintenance().deleteAbandonedFiles();

    expect(deleted).toBe(2);
    const left = await db.prisma.file.findMany({ where: { uploadedById: owner.id } });
    expect(left.map(({ id }) => id).toSorted()).toEqual([photo, prescription, recent].toSorted());
    expect(await api.app().get(StorageService).head(unusedKey)).toBeNull();
  });

  it('schedules each task every hour, and leaves no finished jobs behind', async () => {
    const schedulers = await queue().getJobSchedulers();

    // The first runs already finished (see beforeAll).
    expect(await queue().getJobCounts('completed')).toEqual({ completed: 0 });
    expect(
      schedulers
        .map(({ key, every }) => [key, every])
        .toSorted(([a], [b]) => String(a).localeCompare(String(b))),
    ).toEqual([
      ['delete-abandoned-files', 3_600_000],
      ['delete-expired-refresh-tokens', 3_600_000],
    ]);
  });
});
