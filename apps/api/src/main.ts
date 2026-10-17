import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Environment } from './config/environment.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
configureApp(app);
app.enableShutdownHooks();

const config = app.get<ConfigService<Environment, true>>(ConfigService);
await app.listen(config.get('PORT', { infer: true }));
