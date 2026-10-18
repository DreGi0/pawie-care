import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment.js';
import { queueOptions } from './queue-options.js';
import { RedisHealth } from './redis-health.js';

/**
 * BullMQ on Redis, for deferred and periodic tasks (docs/arquitectura.md §4.10). Each
 * module registers its own queue with BullModule.registerQueue(). The workers run in
 * the API process.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) =>
        queueOptions(config.get('REDIS_URL', { infer: true })),
    }),
  ],
  providers: [RedisHealth],
  exports: [RedisHealth],
})
export class QueuesModule {}
