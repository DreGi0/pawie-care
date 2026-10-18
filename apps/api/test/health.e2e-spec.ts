import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { Environment } from '../src/config/environment.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisHealth } from '../src/queues/redis-health.js';
import { createTestApp } from './create-test-app.js';
import { prismaFor } from './database.js';

// Nothing listens on port 1, so connections are refused right away.
const UNREACHABLE_DATABASE_URL = 'postgresql://pawie:pawie@127.0.0.1:1/pawie';
const UNREACHABLE_REDIS_URL = 'redis://127.0.0.1:1';

const UNAVAILABLE = {
  statusCode: 503,
  errorCode: 'HEALTH_CHECK_FAILED',
  message: 'El servicio no está disponible en este momento. Intenta de nuevo más tarde.',
};

describe('GET /v1/health', () => {
  describe('with every dependency up', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      app = await createTestApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('reports the API, the database and Redis as healthy', async () => {
      const response = await request(app.getHttpServer()).get('/v1/health').expect(200);

      expect(response.body).toEqual({ status: 'ok', checks: { database: 'up', redis: 'up' } });
    });

    it('only exists under the /v1 prefix', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(404);

      expect(response.body).toEqual({
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        message: 'No encontramos lo que buscas.',
      });
    });
  });

  describe('with the database unreachable', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      app = await createTestApp({
        override: (builder) =>
          builder.overrideProvider(PrismaService).useValue(prismaFor(UNREACHABLE_DATABASE_URL)),
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it('still starts, and answers 503 saying which check failed', async () => {
      const response = await request(app.getHttpServer()).get('/v1/health').expect(503);

      expect(response.body).toEqual({
        ...UNAVAILABLE,
        details: { checks: { database: 'down', redis: 'up' } },
      });
    });
  });

  describe('with Redis unreachable', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      const config = { get: () => UNREACHABLE_REDIS_URL } as unknown as ConfigService<
        Environment,
        true
      >;
      app = await createTestApp({
        override: (builder) =>
          builder.overrideProvider(RedisHealth).useValue(new RedisHealth(config)),
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it('still starts, and answers 503 saying which check failed', async () => {
      const response = await request(app.getHttpServer()).get('/v1/health').expect(503);

      expect(response.body).toEqual({
        ...UNAVAILABLE,
        details: { checks: { database: 'up', redis: 'down' } },
      });
    });
  });
});
