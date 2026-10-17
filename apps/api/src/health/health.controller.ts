import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { setTimeout } from 'node:timers/promises';
import { ErrorResponse } from '../common/errors/error-response.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthResponse } from './health-response.dto.js';

const DATABASE_TIMEOUT_MS = 3_000;

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Estado de la API',
    description: 'Revisa la conexión con la base de datos. Lo usan el hosting y el monitoreo.',
  })
  @ApiOkResponse({ type: HealthResponse, description: 'La API y la base de datos responden.' })
  @ApiServiceUnavailableResponse({
    type: ErrorResponse,
    description: 'Alguna dependencia no responde. `details.checks` dice cuál.',
  })
  async check(): Promise<HealthResponse> {
    if (!(await this.isDatabaseUp())) {
      throw new ServiceUnavailableException({
        errorCode: 'HEALTH_CHECK_FAILED',
        message: 'El servicio no está disponible en este momento. Intenta de nuevo más tarde.',
        details: { checks: { database: 'down' } },
      });
    }
    return { status: 'ok', checks: { database: 'up' } };
  }

  private async isDatabaseUp(): Promise<boolean> {
    const timeout = new AbortController();
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        setTimeout(DATABASE_TIMEOUT_MS, undefined, { signal: timeout.signal }).then(() => {
          throw new Error(`Database did not answer within ${DATABASE_TIMEOUT_MS} ms`);
        }),
      ]);
      return true;
    } catch (error) {
      this.logger.warn('Database health check failed', { error: String(error) });
      return false;
    } finally {
      timeout.abort();
    }
  }
}
