import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { NodeEnv, validateEnvironment } from './config/environment.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
      // Tests set their variables explicitly, so a developer's .env can't change them.
      ignoreEnvFile: process.env.NODE_ENV === NodeEnv.Test,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
