import { FilesService } from '../src/files/files.service.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import { createUser } from './factories.js';
import { useApi } from './use-api.js';

const PHOTO = Buffer.from('una foto de Luna, en bytes');

describe('files', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  const api = useApi(() => db);

  async function owner() {
    const user = await createUser(db.prisma);
    return { user, token: await api.tokenFor(user) };
  }

  function requestUpload(token: string, body: Record<string, unknown>) {
    return api.http().post('/v1/files').auth(token, { type: 'bearer' }).send(body);
  }

  const putTo = (url: string, body: Buffer, contentType: string) =>
    fetch(url, {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: { 'Content-Type': contentType },
    });

  it('uploads straight to the bucket and downloads with a signed URL', async () => {
    const { token } = await owner();

    const upload = await requestUpload(token, {
      purpose: 'PET_PHOTO',
      contentType: 'image/jpeg',
      sizeBytes: PHOTO.length,
    }).expect(201);

    expect(upload.body).toMatchObject({
      file: { purpose: 'PET_PHOTO', contentType: 'image/jpeg', uploadedAt: null, url: null },
      uploadMethod: 'PUT',
      uploadHeaders: { 'Content-Type': 'image/jpeg' },
    });
    expect((await putTo(upload.body.uploadUrl, PHOTO, 'image/jpeg')).status).toBe(200);

    const completed = await api
      .http()
      .post(`/v1/files/${upload.body.file.id}/complete`)
      .auth(token, { type: 'bearer' })
      .expect(200);

    expect(completed.body).toMatchObject({
      sizeBytes: PHOTO.length,
      uploadedAt: expect.any(String),
    });
    const download = await fetch(completed.body.url);
    expect(Buffer.from(await download.arrayBuffer())).toEqual(PHOTO);
  });

  it('only accepts exactly the declared size and type', async () => {
    const { token } = await owner();
    const { body } = await requestUpload(token, {
      purpose: 'VET_INSTRUCTION',
      contentType: 'application/pdf',
      sizeBytes: PHOTO.length,
    }).expect(201);

    expect(
      (await putTo(body.uploadUrl, Buffer.concat([PHOTO, PHOTO]), 'application/pdf')).status,
    ).toBe(403);
    expect((await putTo(body.uploadUrl, PHOTO, 'image/png')).status).toBe(403);
  });

  it('rejects formats and sizes each purpose does not take', async () => {
    const { token } = await owner();

    const video = await requestUpload(token, {
      purpose: 'PET_PHOTO',
      contentType: 'video/mp4',
      sizeBytes: 1000,
    }).expect(422);
    const huge = await requestUpload(token, {
      purpose: 'PET_PHOTO',
      contentType: 'image/heic',
      sizeBytes: 11 * 1024 * 1024,
    }).expect(422);

    expect(video.body.errorCode).toBe('UNSUPPORTED_FILE_TYPE');
    expect(huge.body).toMatchObject({
      errorCode: 'FILE_TOO_LARGE',
      details: { maxBytes: 10 * 1024 * 1024 },
    });
  });

  it('does not let owners upload caregiver photos', async () => {
    const { token } = await owner();

    const response = await requestUpload(token, {
      purpose: 'CAREGIVER_PHOTO',
      contentType: 'image/jpeg',
      sizeBytes: 1000,
    }).expect(400);

    expect(response.body.details).toEqual({ purpose: ['Ese tipo de archivo no se puede subir.'] });
  });

  it('refuses to complete an upload that never arrived', async () => {
    const { token } = await owner();
    const { body } = await requestUpload(token, {
      purpose: 'PET_PHOTO',
      contentType: 'image/png',
      sizeBytes: 10,
    }).expect(201);

    const response = await api
      .http()
      .post(`/v1/files/${body.file.id}/complete`)
      .auth(token, { type: 'bearer' })
      .expect(409);

    expect(response.body.errorCode).toBe('FILE_NOT_UPLOADED');
  });

  it("keeps each account's files to itself", async () => {
    const first = await owner();
    const second = await owner();
    const { body } = await requestUpload(first.token, {
      purpose: 'PET_PHOTO',
      contentType: 'image/png',
      sizeBytes: 10,
    }).expect(201);

    const response = await api
      .http()
      .get(`/v1/files/${body.file.id}`)
      .auth(second.token, { type: 'bearer' })
      .expect(404);

    expect(response.body.errorCode).toBe('FILE_NOT_FOUND');
    await api.http().get(`/v1/files/${body.file.id}`).expect(401);
  });

  it('only lets other modules attach complete files of the right purpose', async () => {
    const { user, token } = await owner();
    const files = api.app().get(FilesService);
    const { body } = await requestUpload(token, {
      purpose: 'PET_PHOTO',
      contentType: 'image/jpeg',
      sizeBytes: PHOTO.length,
    }).expect(201);

    await expect(files.requireUploaded(user.id, body.file.id, 'PET_PHOTO')).rejects.toMatchObject({
      response: { errorCode: 'FILE_NOT_UPLOADED' },
    });
    await putTo(body.uploadUrl, PHOTO, 'image/jpeg');
    await files.complete(user.id, body.file.id);

    await expect(
      files.requireUploaded(user.id, body.file.id, 'VET_INSTRUCTION'),
    ).rejects.toMatchObject({
      response: { errorCode: 'WRONG_FILE_PURPOSE' },
    });
    await expect(files.requireUploaded(user.id, body.file.id, 'PET_PHOTO')).resolves.toMatchObject({
      id: body.file.id,
    });
  });
});
