import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

interface TestAppOptions {
  /** Extra controllers, for testing cross-cutting behavior through a real route. */
  controllers?: NonNullable<Parameters<typeof Test.createTestingModule>[0]['controllers']>;
  /** Changes to the module before it compiles, such as provider overrides. */
  override?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

/** Boots the real AppModule with the same HTTP setup as main.ts, without listening. */
export async function createTestApp({
  controllers = [],
  override = (builder) => builder,
}: TestAppOptions = {}): Promise<NestExpressApplication> {
  const moduleRef = await override(
    Test.createTestingModule({ imports: [AppModule], controllers }),
  ).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();
  return app;
}
