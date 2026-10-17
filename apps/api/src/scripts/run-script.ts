import { type INestApplicationContext, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppConfigModule } from '../config/config.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SettingsModule } from '../settings/settings.module.js';

/** What the command-line scripts need from the API: no HTTP, no request logging. */
@Module({ imports: [AppConfigModule, PrismaModule, SettingsModule] })
class ScriptModule {}

/**
 * Runs a command-line script with the API's validated configuration and providers,
 * and turns its result into the process exit code. The scripts run from dist/ (see
 * package.json), because Node can't run the generated Prisma client from TypeScript.
 */
export async function runScript(
  script: (app: INestApplicationContext) => Promise<number>,
): Promise<void> {
  const app = await NestFactory.createApplicationContext(ScriptModule, {
    logger: ['error', 'warn'],
  });
  try {
    process.exitCode = await script(app);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
