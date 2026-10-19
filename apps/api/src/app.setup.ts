import { type NestApplicationOptions, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import type { Environment } from './config/environment.js';
import { setupSwaggerUi } from './openapi/openapi.js';

/** Options to create the app with, shared by main.ts and the integration tests. */
export const APP_OPTIONS = {
  bufferLogs: true,
  // Keeps the body as it arrived in req.rawBody: Wompi signs those exact bytes
  // (docs/arquitectura.md §6).
  rawBody: true,
} satisfies NestApplicationOptions;

/**
 * HTTP setup shared by main.ts and the integration tests, so tests exercise the
 * same app that runs in production. Global pipes, guards and filters are
 * registered in AppModule instead.
 */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  app.use(helmet());
  // Native apps don't use CORS; this only lets the future web client call the API.
  app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }), credentials: true });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  setupSwaggerUi(app);

  return app;
}
