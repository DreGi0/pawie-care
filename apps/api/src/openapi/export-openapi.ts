// Writes apps/api/openapi.json without starting the server or touching the
// database. Run it from the compiled output (`pnpm openapi:generate`), because
// the @nestjs/swagger CLI plugin only runs during `nest build`.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../app.setup.js';
import { createOpenApiDocument } from './openapi.js';

const apiRoot = new URL('../../', import.meta.url);

// The document doesn't depend on the environment, but AppModule validates it on
// import, so missing variables are filled from the example file (set ones win).
// Logging is off: this script only builds the document.
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.loadEnvFile(new URL('.env.example', apiRoot));

const { AppModule } = await import('../app.module.js');
const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  logger: false,
  abortOnError: false,
});
configureApp(app);

const target = new URL('openapi.json', apiRoot);
await writeFile(target, `${JSON.stringify(createOpenApiDocument(app), null, 2)}\n`);
await app.close();

console.log(`OpenAPI document written to ${fileURLToPath(target)}`);
