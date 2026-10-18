import { BookingStatus } from '../src/generated/prisma/client.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import {
  type Catalog,
  createBooking,
  createCaregiver,
  createCatalog,
  createUser,
  svTime,
} from './factories.js';
import { useApi } from './use-api.js';

describe('addresses', () => {
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

  const as = (token: string) => ({
    get: (path: string) => api.http().get(path).auth(token, { type: 'bearer' }),
    post: (path: string, body: object) =>
      api.http().post(path).auth(token, { type: 'bearer' }).send(body),
    put: (path: string, body: object) =>
      api.http().put(path).auth(token, { type: 'bearer' }).send(body),
    delete: (path: string) => api.http().delete(path).auth(token, { type: 'bearer' }),
  });

  const home = () => ({
    label: ' Casa ',
    street: 'Pasaje Las Mascotas 12, Residencial Pawie',
    details: 'Portón verde',
    districtId: catalog.districtId,
  });

  it('creates, lists, edits and deletes the owner’s addresses', async () => {
    const owner = await createUser(db.prisma);
    const token = await api.tokenFor(owner);

    const { body: created } = await as(token).post('/v1/addresses', home()).expect(201);
    expect(created).toMatchObject({
      label: 'Casa',
      street: 'Pasaje Las Mascotas 12, Residencial Pawie',
      details: 'Portón verde',
      district: { id: catalog.districtId },
    });

    const { body: edited } = await as(token)
      .put(`/v1/addresses/${created.id}`, { ...home(), label: 'Oficina', details: undefined })
      .expect(200);
    expect(edited).toMatchObject({ id: created.id, label: 'Oficina', details: null });

    const { body: list } = await as(token).get('/v1/addresses').expect(200);
    expect(list).toEqual([edited]);

    await as(token).delete(`/v1/addresses/${created.id}`).expect(204);
    expect((await as(token).get('/v1/addresses').expect(200)).body).toEqual([]);
  });

  it('hides other owners’ addresses', async () => {
    const theirs = await as(await api.tokenFor(await createUser(db.prisma)))
      .post('/v1/addresses', home())
      .expect(201);
    const token = await api.tokenFor(await createUser(db.prisma));

    expect((await as(token).get('/v1/addresses').expect(200)).body).toEqual([]);
    const edit = await as(token).put(`/v1/addresses/${theirs.body.id}`, home()).expect(404);
    const remove = await as(token).delete(`/v1/addresses/${theirs.body.id}`).expect(404);

    expect(edit.body.errorCode).toBe('ADDRESS_NOT_FOUND');
    expect(remove.body.errorCode).toBe('ADDRESS_NOT_FOUND');
  });

  it('validates the fields and the district', async () => {
    const token = await api.tokenFor(await createUser(db.prisma));

    const invalid = await as(token)
      .post('/v1/addresses', { ...home(), label: '  ', street: '' })
      .expect(400);
    const district = await as(token)
      .post('/v1/addresses', { ...home(), districtId: '01a14c39-0000-7000-8000-000000000000' })
      .expect(422);

    expect(Object.keys(invalid.body.details)).toEqual(['label', 'street']);
    expect(district.body).toMatchObject({
      errorCode: 'UNKNOWN_DISTRICT',
      message: 'Elige un distrito de la lista.',
    });
  });

  it('can delete an address that a booking used, which keeps its copy (RN-CTA-04)', async () => {
    const owner = await createUser(db.prisma);
    const token = await api.tokenFor(owner);
    const { body: address } = await as(token).post('/v1/addresses', home()).expect(201);
    const caregiver = await createCaregiver(db.prisma);
    const booking = await createBooking(db.prisma, catalog, {
      caregiverId: caregiver.userId,
      slots: [{ startsAt: svTime('2026-11-02T10:00'), endsAt: svTime('2026-11-02T11:00') }],
      status: BookingStatus.CONFIRMED,
    });
    await db.prisma.booking.update({ where: { id: booking.id }, data: { addressId: address.id } });

    await as(token).delete(`/v1/addresses/${address.id}`).expect(204);

    expect(await db.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      addressId: null,
      addressStreet: booking.addressStreet,
    });
  });
});
