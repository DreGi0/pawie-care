import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Environment } from './config/environment.js';

const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();

const config = app.get<ConfigService<Environment, true>>(ConfigService);
await app.listen(config.get('PORT', { infer: true }));
