import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator.js';
import { setTimeout } from 'node:timers/promises';
import { ErrorResponse } from '../common/errors/error-response.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisHealth } from '../queues/redis-health.js';
import { type HealthChecks, HealthResponse } from './health-response.dto.js';

const CHECK_TIMEOUT_MS = 3_000;

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisHealth,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Estado de la API',
    description:
      'Revisa la conexión con la base de datos y con Redis. Lo usan el hosting y el monitoreo.',
  })
  @ApiOkResponse({ type: HealthResponse, description: 'La API y sus dependencias responden.' })
  @ApiServiceUnavailableResponse({
    type: ErrorResponse,
    description: 'Alguna dependencia no responde. `details.checks` dice cuál.',
  })
  async check(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      this.probe('database', () => this.prisma.$queryRaw`SELECT 1`),
      this.probe('redis', () => this.redis.ping()),
    ]);
    const checks = { database, redis } satisfies HealthChecks;
    if (database === 'down' || redis === 'down') {
      throw new ServiceUnavailableException({
        errorCode: 'HEALTH_CHECK_FAILED',
        message: 'El servicio no está disponible en este momento. Intenta de nuevo más tarde.',
        details: { checks },
      });
    }
    return { status: 'ok', checks };
  }

  /** Whether the dependency answers within CHECK_TIMEOUT_MS. */
  private async probe(name: string, query: () => Promise<unknown>): Promise<'up' | 'down'> {
    const timeout = new AbortController();
    try {
      await Promise.race([
        query(),
        setTimeout(CHECK_TIMEOUT_MS, undefined, { signal: timeout.signal }).then(() => {
          throw new Error(`No answer within ${CHECK_TIMEOUT_MS} ms`);
        }),
      ]);
      return 'up';
    } catch (error) {
      this.logger.warn(`Health check of ${name} failed`, { error: String(error) });
      return 'down';
    } finally {
      timeout.abort();
    }
  }
}
