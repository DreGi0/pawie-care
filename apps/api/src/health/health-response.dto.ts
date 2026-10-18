import { ApiProperty } from '@nestjs/swagger';

export class HealthChecks {
  @ApiProperty({ description: 'Conexión con PostgreSQL.', enum: ['up', 'down'] })
  database: 'up' | 'down';

  @ApiProperty({
    description: 'Conexión con Redis, donde están las colas de tareas.',
    enum: ['up', 'down'],
  })
  redis: 'up' | 'down';
}

export class HealthResponse {
  @ApiProperty({ description: 'La API y sus dependencias responden.', enum: ['ok'] })
  status: 'ok';

  @ApiProperty({ description: 'Resultado de cada dependencia.' })
  checks: HealthChecks;
}
