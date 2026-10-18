import { ApiProperty } from '@nestjs/swagger';
import { ServiceCode } from '../generated/prisma/enums.js';

export class DistrictOption {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'santa-tecla' })
  slug: string;

  @ApiProperty({ example: 'Santa Tecla' })
  name: string;
}

export class SpeciesOption {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'DOG' })
  code: string;

  @ApiProperty({ example: 'Perro' })
  name: string;
}

export class ServiceOption {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ServiceCode, enumName: 'ServiceCode' })
  code: ServiceCode;

  @ApiProperty({ example: 'Visita a domicilio' })
  name: string;

  @ApiProperty()
  description: string;
}

/**
 * Limits the app needs to build its forms. They come from the settings (§15), so the
 * app doesn't hard-code them; the API still checks every request.
 */
export class BookingRules {
  @ApiProperty({ type: 'integer', example: 3, description: 'RN-RES-03' })
  maxPetsPerBooking: number;

  @ApiProperty({
    type: 'integer',
    example: 120,
    description: 'RN-RES-05: el primer tramo empieza al menos esto después de pedirlo.',
  })
  minLeadTimeMinutes: number;

  @ApiProperty({
    type: 'integer',
    example: 60,
    description: 'RN-SER-01: cada visita ocupa este tiempo en el calendario del cuidador.',
  })
  homeVisitMinutes: number;

  @ApiProperty({
    type: 'integer',
    example: 1140,
    description: 'RN-SER-02: inicio de la pernocta, en minutos desde la medianoche.',
  })
  overnightStartMinute: number;

  @ApiProperty({
    type: 'integer',
    example: 480,
    description: 'RN-SER-02: fin de la pernocta, al día siguiente.',
  })
  overnightEndMinute: number;
}

export class CatalogResponse {
  @ApiProperty({ type: [DistrictOption], description: 'Ordenados por nombre.' })
  districts: DistrictOption[];

  @ApiProperty({ type: [SpeciesOption] })
  species: SpeciesOption[];

  @ApiProperty({ type: [ServiceOption] })
  services: ServiceOption[];

  @ApiProperty({ type: BookingRules })
  bookingRules: BookingRules;
}
