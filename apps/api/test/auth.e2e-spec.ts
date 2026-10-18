import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { hashPassword } from '../src/auth/passwords.js';
import { REUSE_GRACE_MS } from '../src/auth/refresh-tokens.service.js';
import { addDays, addMonths, dateInElSalvador } from '../src/common/time/calendar.js';
import { Role } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { createTestDatabase, prismaFor, type TestDatabase } from './database.js';

const PASSWORD = 'perro-salchicha-42';

describe('auth', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  /**
   * Boots the API against this file's database. Each group gets its own app, so the
   * rate limits of one group don't spill into the next.
   */
  function useApp() {
    const state: { app?: NestExpressApplication } = {};
    beforeAll(async () => {
      state.app = await createTestApp({
        override: (builder) => builder.overrideProvider(PrismaService).useValue(prismaFor(db.url)),
      });
    });
    afterAll(async () => {
      await state.app?.close();
    });
    const http = () => request(state.app!.getHttpServer());
    return {
      http,
      app: () => state.app!,
      /** Signs in an owner created for the test. */
      signIn: async () => {
        const owner = await existingOwner();
        const response = await http()
          .post('/v1/auth/login')
          .send({ email: owner.email, password: PASSWORD })
          .expect(200);
        return { owner, session: response.body as { accessToken: string; refreshToken: string } };
      },
      refresh: (refreshToken: string) => http().post('/v1/auth/refresh').send({ refreshToken }),
    };
  }

  const uniqueEmail = () => `dueno-${randomUUID()}@example.com`;

  function newOwner(overrides: Record<string, unknown> = {}) {
    return {
      email: uniqueEmail(),
      password: PASSWORD,
      firstName: 'Daniela',
      lastName: 'Pérez',
      birthDate: '1992-05-20',
      ...overrides,
    };
  }

  /** An owner created straight in the database, for tests that aren't about signing up. */
  async function existingOwner(password: string | null = PASSWORD) {
    return db.prisma.user.create({
      data: {
        email: uniqueEmail(),
        passwordHash: password === null ? null : await hashPassword(password),
        firstName: 'Mario',
        lastName: 'Rivas',
        birthDate: new Date('1988-01-15'),
        roles: [Role.OWNER],
      },
    });
  }

  describe('POST /v1/auth/register', () => {
    const { http } = useApp();

    it('creates an owner account and signs it in', async () => {
      const owner = newOwner({
        email: `  Daniela.${randomUUID()}@Example.COM `,
        phone: '7000 0000',
      });

      const response = await http().post('/v1/auth/register').send(owner).expect(201);

      expect(response.body).toEqual({
        tokenType: 'Bearer',
        accessToken: expect.any(String),
        expiresIn: 900,
        refreshToken: expect.any(String),
        refreshTokenExpiresAt: expect.any(String),
        user: {
          id: expect.any(String),
          email: owner.email.trim().toLowerCase(),
          firstName: 'Daniela',
          lastName: 'Pérez',
          birthDate: '1992-05-20',
          phone: '7000 0000',
          roles: ['OWNER'],
        },
      });
      const stored = await db.prisma.user.findUniqueOrThrow({
        where: { id: response.body.user.id },
      });
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
      const refreshDays =
        (Date.parse(response.body.refreshTokenExpiresAt) - Date.now()) / (24 * 60 * 60 * 1000);
      expect(refreshDays).toBeCloseTo(30, 0);
    });

    it('rejects an email that already has an account, whatever its case', async () => {
      const owner = newOwner();
      await http().post('/v1/auth/register').send(owner).expect(201);

      const response = await http()
        .post('/v1/auth/register')
        .send({ ...owner, email: owner.email.toUpperCase() })
        .expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        errorCode: 'EMAIL_TAKEN',
        message: 'Ya hay una cuenta con ese correo. Inicia sesión.',
      });
    });

    it('lets in someone who turns 18 today, not someone who turns 18 tomorrow (RN-CTA-02)', async () => {
      const eighteenYearsAgo = addMonths(dateInElSalvador(new Date()), -18 * 12);
      const asDate = (date: Date) => date.toISOString().slice(0, 10);

      await http()
        .post('/v1/auth/register')
        .send(newOwner({ birthDate: asDate(eighteenYearsAgo) }))
        .expect(201);
      const response = await http()
        .post('/v1/auth/register')
        .send(newOwner({ birthDate: asDate(addDays(eighteenYearsAgo, 1)) }))
        .expect(422);

      expect(response.body).toMatchObject({ errorCode: 'UNDERAGE' });
    });
  });

  describe('POST /v1/auth/register validation', () => {
    const { http } = useApp();

    it('explains each invalid field in Spanish', async () => {
      const response = await http()
        .post('/v1/auth/register')
        .send(newOwner({ email: 'no-es-un-correo', password: 'corta', birthDate: '2001-02-30' }))
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        errorCode: 'VALIDATION_FAILED',
        message: 'Revisa los datos enviados.',
        details: {
          email: ['Escribe un correo válido.'],
          password: ['La contraseña debe tener al menos 8 caracteres.'],
          birthDate: ['Esa fecha no existe.'],
        },
      });
    });

    it('does not let the client choose its roles', async () => {
      const response = await http()
        .post('/v1/auth/register')
        .send(newOwner({ roles: ['ADMIN'] }))
        .expect(400);

      expect(response.body.details).toHaveProperty('roles');
    });
  });

  describe('POST /v1/auth/login', () => {
    const { http } = useApp();

    it('signs in with the right password, whatever the case of the email', async () => {
      const owner = await existingOwner();

      const response = await http()
        .post('/v1/auth/login')
        .send({ email: owner.email.toUpperCase(), password: PASSWORD })
        .expect(200);

      expect(response.body.user).toMatchObject({ id: owner.id, roles: ['OWNER'] });
    });

    it('answers a wrong password and an unknown email the same way', async () => {
      const owner = await existingOwner();
      const invalid = {
        statusCode: 401,
        errorCode: 'INVALID_CREDENTIALS',
        message: 'El correo o la contraseña no son correctos.',
      };

      const wrongPassword = await http()
        .post('/v1/auth/login')
        .send({ email: owner.email, password: 'perro-salchicha-43' })
        .expect(401);
      const unknownEmail = await http()
        .post('/v1/auth/login')
        .send({ email: uniqueEmail(), password: PASSWORD })
        .expect(401);

      expect(wrongPassword.body).toEqual(invalid);
      expect(unknownEmail.body).toEqual(invalid);
    });

    it('does not let accounts without a password sign in, like the seeded caregivers', async () => {
      const caregiver = await existingOwner(null);

      await http()
        .post('/v1/auth/login')
        .send({ email: caregiver.email, password: '' })
        .expect(400);
      await http()
        .post('/v1/auth/login')
        .send({ email: caregiver.email, password: PASSWORD })
        .expect(401);
    });
  });

  describe('tokens', () => {
    const { http, app, signIn, refresh } = useApp();

    it('opens protected routes with the access token', async () => {
      const { owner, session } = await signIn();

      const response = await http()
        .get('/v1/users/me')
        .auth(session.accessToken, { type: 'bearer' })
        .expect(200);

      expect(response.body).toEqual({
        id: owner.id,
        email: owner.email,
        firstName: 'Mario',
        lastName: 'Rivas',
        birthDate: '1988-01-15',
        phone: null,
        roles: ['OWNER'],
      });
    });

    it('rejects a missing, tampered, foreign or expired access token', async () => {
      const { owner, session } = await signIn();
      const payload = { sub: owner.id, roles: owner.roles };
      const [header, body, signature] = session.accessToken.split('.');
      const tokens = [
        undefined,
        `${header}.${body}.${signature.slice(0, -2)}xx`,
        `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${body}.`,
        new JwtService({ secret: 'another-secret-that-is-at-least-32-characters' }).sign(payload),
        await app().get(JwtService).signAsync(payload, { expiresIn: -10 }),
      ];

      for (const token of tokens) {
        const call = http().get('/v1/users/me');
        const response = await (token ? call.auth(token, { type: 'bearer' }) : call).expect(401);
        expect(response.body).toEqual({
          statusCode: 401,
          errorCode: 'UNAUTHORIZED',
          message: 'Necesitas iniciar sesión.',
        });
      }
    });

    it('trades a refresh token for a new pair once', async () => {
      const { owner, session } = await signIn();

      const renewed = await refresh(session.refreshToken).expect(200);

      expect(renewed.body.user.id).toBe(owner.id);
      expect(renewed.body.refreshToken).not.toBe(session.refreshToken);
      await http()
        .get('/v1/users/me')
        .auth(renewed.body.accessToken, { type: 'bearer' })
        .expect(200);
    });

    it('signs out one session and leaves the others', async () => {
      const { owner, session } = await signIn();
      const other = await http()
        .post('/v1/auth/login')
        .send({ email: owner.email, password: PASSWORD })
        .expect(200);

      await http().post('/v1/auth/logout').send({ refreshToken: session.refreshToken }).expect(204);
      await http().post('/v1/auth/logout').send({ refreshToken: session.refreshToken }).expect(204);

      await refresh(session.refreshToken).expect(401);
      await refresh(other.body.refreshToken).expect(200);
    });

    it('rejects an expired refresh token', async () => {
      const { owner, session } = await signIn();
      await db.prisma.refreshToken.updateMany({
        where: { userId: owner.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await refresh(session.refreshToken).expect(401);
    });

    it('keeps only a hash of each refresh token', async () => {
      const { owner, session } = await signIn();

      const stored = await db.prisma.refreshToken.findMany({ where: { userId: owner.id } });

      expect(stored).toHaveLength(1);
      expect(stored[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(stored[0].tokenHash).not.toContain(session.refreshToken);
    });
  });

  describe('refresh token reuse', () => {
    const { http, signIn, refresh } = useApp();

    it('still takes a rotated token for a few seconds, for retries after a lost response', async () => {
      const { session } = await signIn();
      const lost = await refresh(session.refreshToken).expect(200);

      const retried = await refresh(session.refreshToken).expect(200);

      await refresh(retried.body.refreshToken).expect(200);
      await refresh(lost.body.refreshToken).expect(200);
    });

    it('takes two refreshes sent at the same time', async () => {
      const { session } = await signIn();

      const [first, second] = await Promise.all([
        refresh(session.refreshToken),
        refresh(session.refreshToken),
      ]);

      expect([first.status, second.status]).toEqual([200, 200]);
    });

    it('ends the whole session when a rotated token comes back after the grace period', async () => {
      const { owner, session } = await signIn();
      const renewed = await refresh(session.refreshToken).expect(200);
      await db.prisma.refreshToken.updateMany({
        where: { userId: owner.id, rotatedAt: { not: null } },
        data: { rotatedAt: new Date(Date.now() - REUSE_GRACE_MS - 1000) },
      });

      const reused = await refresh(session.refreshToken).expect(401);

      expect(reused.body).toEqual({
        statusCode: 401,
        errorCode: 'INVALID_REFRESH_TOKEN',
        message: 'Tu sesión terminó. Inicia sesión de nuevo.',
      });
      // Whoever got the newer token is signed out too.
      await refresh(renewed.body.refreshToken).expect(401);
    });

    it('does not bring back a token after signing out, even within the grace period', async () => {
      const { session } = await signIn();
      await refresh(session.refreshToken).expect(200);

      await http().post('/v1/auth/logout').send({ refreshToken: session.refreshToken }).expect(204);

      await refresh(session.refreshToken).expect(401);
    });
  });

  describe('rate limiting', () => {
    const { http } = useApp();

    it('stops sign-in attempts after 10 a minute from the same IP', async () => {
      const attempt = () =>
        http().post('/v1/auth/login').send({ email: uniqueEmail(), password: PASSWORD });
      for (let i = 0; i < 10; i++) {
        await attempt().expect(401);
      }

      const response = await attempt().expect(429);

      expect(response.body.errorCode).toBe('TOO_MANY_REQUESTS');
    });
  });
});
