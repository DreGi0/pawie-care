import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import type { Environment } from './config/environment.js';
import { setupSwaggerUi } from './openapi/openapi.js';

/**
 * HTTP setup of the app. Global pipes, guards and filters are registered in
 * AppModule instead.
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
