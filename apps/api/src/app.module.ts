import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { minutes, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AddressesModule } from './addresses/addresses.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { CaregiversModule } from './caregivers/caregivers.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { ClockModule } from './common/time/clock.module.js';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { ApiValidationPipe } from './common/errors/api-validation.pipe.js';
import { AppConfigModule } from './config/config.module.js';
import { type Environment, NodeEnv } from './config/environment.js';
import { FilesModule } from './files/files.module.js';
import { HealthModule } from './health/health.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { PetsModule } from './pets/pets.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueuesModule } from './queues/queues.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { UsersModule } from './users/users.module.js';

const REQUEST_ID_HEADER = 'x-request-id';
const VALID_REQUEST_ID = /^[\w-]{1,128}$/;

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          transport:
            config.get('NODE_ENV', { infer: true }) === NodeEnv.Development
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          // Reuse the caller's request ID when it is safe to log, and echo it back.
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const header = req.headers[REQUEST_ID_HEADER];
            const id =
              typeof header === 'string' && VALID_REQUEST_ID.test(header) ? header : randomUUID();
            res.setHeader(REQUEST_ID_HEADER, id);
            return id;
          },
          // Log what identifies a request, not its headers: they are noisy and can
          // carry credentials.
          serializers: {
            req: (req: { id: string; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
          // Logs must never contain credentials or personal data, whatever logs them.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              '*.password',
              '*.accessToken',
              '*.refreshToken',
            ],
            censor: '[REDACTED]',
          },
          // Health probes run every few seconds and would drown the useful logs.
          autoLogging: { ignore: (req: IncomingMessage) => req.url === '/v1/health' },
        },
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: minutes(1), limit: 100 }]),
    PrismaModule,
    QueuesModule,
    ClockModule,
    HealthModule,
    SettingsModule,
    UsersModule,
    AuthModule,
    FilesModule,
    CatalogModule,
    PetsModule,
    AddressesModule,
    BookingsModule,
    MaintenanceModule,
    CaregiversModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ApiValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
