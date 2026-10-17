import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { Environment } from '../src/config/environment.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';

// Nothing listens on port 1, so connections are refused right away.
const UNREACHABLE_DATABASE_URL = 'postgresql://pawie:pawie@127.0.0.1:1/pawie';

describe('GET /v1/health', () => {
  describe('with the database up', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      app = await createTestApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('reports the API and the database as healthy', async () => {
      const response = await request(app.getHttpServer()).get('/v1/health').expect(200);

      expect(response.body).toEqual({ status: 'ok', checks: { database: 'up' } });
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
      const config = { get: () => UNREACHABLE_DATABASE_URL } as unknown as ConfigService<
        Environment,
        true
      >;
      app = await createTestApp({
        override: (builder) =>
          builder.overrideProvider(PrismaService).useValue(new PrismaService(config)),
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it('still starts, and answers 503 saying which check failed', async () => {
      const response = await request(app.getHttpServer()).get('/v1/health').expect(503);

      expect(response.body).toEqual({
        statusCode: 503,
        errorCode: 'HEALTH_CHECK_FAILED',
        message: 'El servicio no está disponible en este momento. Intenta de nuevo más tarde.',
        details: { checks: { database: 'down' } },
      });
    });
  });
});
