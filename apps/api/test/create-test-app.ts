import { randomUUID } from 'node:crypto';
import { getSharedConfigToken } from '@nestjs/bullmq';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { queueOptions } from '../src/queues/queue-options.js';

interface TestAppOptions {
  /** Extra controllers, for testing cross-cutting behavior through a real route. */
  controllers?: NonNullable<Parameters<typeof Test.createTestingModule>[0]['controllers']>;
  /** Changes to the module before it compiles, such as provider overrides. */
  override?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

/**
 * Boots the real AppModule with the same HTTP setup as main.ts, without listening.
 * Its queues get a key prefix of their own, so the workers of one test app never take
 * the jobs of another that shares the Redis.
 */
export async function createTestApp({
  controllers = [],
  override = (builder) => builder,
}: TestAppOptions = {}): Promise<NestExpressApplication> {
  const moduleRef = await override(
    Test.createTestingModule({ imports: [AppModule], controllers })
      .overrideProvider(getSharedConfigToken())
      .useValue(queueOptions(process.env.REDIS_URL ?? '', `test-${randomUUID()}`)),
  ).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();
  return app;
}
