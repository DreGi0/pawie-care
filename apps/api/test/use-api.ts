import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { AccessTokenPayload } from '../src/auth/authenticated-user.js';
import type { User } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { prismaFor, type TestDatabase } from './database.js';

/**
 * Boots the API against a test database for the enclosing describe block. Call it
 * after the hook that creates the database, so it runs first.
 */
export function useApi(database: () => TestDatabase) {
  let app: NestExpressApplication | undefined;

  beforeAll(async () => {
    app = await createTestApp({
      override: (builder) =>
        builder.overrideProvider(PrismaService).useValue(prismaFor(database().url)),
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const started = () => {
    if (!app) {
      throw new Error('useApi() is used before its beforeAll hook ran');
    }
    return app;
  };

  return {
    app: started,
    http: () => request(started().getHttpServer()),
    /** An access token for the user, without going through sign-in. */
    tokenFor: (user: Pick<User, 'id' | 'roles'>) =>
      started()
        .get(JwtService)
        .signAsync({ sub: user.id, roles: user.roles } satisfies AccessTokenPayload),
  };
}
