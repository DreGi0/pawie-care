import { ApiProperty } from '@nestjs/swagger';

export class HealthChecks {
  @ApiProperty({ description: 'Conexión con PostgreSQL.', enum: ['up'] })
  database: 'up';
}

export class HealthResponse {
  @ApiProperty({ description: 'La API y sus dependencias responden.', enum: ['ok'] })
  status: 'ok';

  @ApiProperty({ description: 'Resultado de cada dependencia.' })
  checks: HealthChecks;
}
