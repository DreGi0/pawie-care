import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Environment } from '../config/environment.js';

/**
 * Pings the Redis of the queues for /v1/health. It has its own connection, which
 * connects on the first check, so the API starts even if Redis is down, and answers
 * at once while it's disconnected instead of queueing the ping.
 */
@Injectable()
export class RedisHealth implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: ConfigService<Environment, true>) {
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3_000,
    });
    // The health check reports the failure; there's nothing else to do with it.
    this.client.on('error', () => undefined);
  }

  /** Throws if Redis doesn't answer. */
  async ping(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
    await this.client.ping();
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
