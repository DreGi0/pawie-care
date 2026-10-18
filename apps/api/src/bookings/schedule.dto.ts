import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { IsDateOnly } from '../common/validation/is-date-only.js';
import { ServiceCode } from '../generated/prisma/enums.js';

/**
 * When the owner wants the service. The API turns it into slots (planSlots), so the
 * search and the booking work on the same slots:
 * - a night runs from the overnight start of its date to the overnight end of the next
 *   day (RN-SER-02);
 * - a visit takes the full visit time from its start (RN-SER-01).
 */
export class ScheduleRequest {
  @ApiProperty({ enum: ServiceCode, enumName: 'ServiceCode' })
  @IsEnum(ServiceCode, { message: 'Elige visita o pernocta.' })
  serviceCode: ServiceCode;

  @ApiPropertyOptional({
    type: [String],
    format: 'date',
    example: ['2026-11-20', '2026-11-21'],
    description: 'Solo en pernocta: la fecha en que empieza cada noche.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(31, { message: 'Se pueden pedir hasta 31 noches a la vez.' })
  @IsDateOnly({ each: true })
  nights?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'date-time',
    example: ['2026-11-20T09:00:00-06:00'],
    description:
      'Cuándo empieza cada visita. En una pernocta son las visitas de día durante la estadía (RN-SER-03).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(62, { message: 'Se pueden pedir hasta 62 visitas a la vez.' })
  @IsISO8601({ strict: true }, { each: true, message: 'Escribe la hora con fecha y zona horaria.' })
  visits?: string[];
}

export class SlotResponse {
  @ApiProperty({ enum: ServiceCode, enumName: 'ServiceCode' })
  serviceCode: ServiceCode;

  @ApiProperty({ format: 'date-time' })
  startsAt: string;

  @ApiProperty({ format: 'date-time' })
  endsAt: string;
}
