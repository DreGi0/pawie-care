import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ScheduleRequest, SlotResponse } from '../bookings/schedule.dto.js';
import { DistrictOption } from '../catalog/catalog.dto.js';
import {
  CaregiverLevel,
  CaregiverSkill,
  CareLevel,
  ServiceCode,
} from '../generated/prisma/enums.js';
import { CaregiverBadge } from './badges.js';

export class CaregiverPrice {
  @ApiProperty({ enum: ServiceCode, enumName: 'ServiceCode' })
  serviceCode: ServiceCode;

  @ApiProperty({
    type: 'integer',
    example: 1300,
    description:
      'Precio del cuidador por una mascota, en centavos, sin la tarifa de servicio (RN-PRE-01).',
  })
  priceCents: number;
}

export class CaregiverCertificationSummary {
  @ApiProperty({ example: 'FIRST_AID', description: 'Código del tipo de certificación.' })
  code: string;

  @ApiProperty({ example: 'Primeros auxilios' })
  name: string;

  @ApiProperty({ format: 'date', description: 'Último día de vigencia (RN-CUI-09).' })
  validUntil: string;
}

/** What the owner sees of a caregiver in a list (RN-RES-02). */
export class CaregiverSummary {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Valeria M.', description: 'Nombre e inicial del apellido.' })
  displayName: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'URL firmada que vence en 10 minutos.',
  })
  photoUrl: string | null;

  @ApiProperty({
    enum: CaregiverLevel,
    enumName: 'CaregiverLevel',
    description: 'RN-NIV-01: lo calcula el sistema.',
  })
  level: CaregiverLevel;

  @ApiProperty({
    enum: CaregiverBadge,
    enumName: 'CaregiverBadge',
    isArray: true,
    description: 'Insignias de verificación (RN-CUI-03, RN-CUI-05).',
  })
  badges: CaregiverBadge[];

  @ApiProperty({
    type: [CaregiverCertificationSummary],
    description: 'Certificaciones vigentes, la ⭐ incluida (RN-CUI-07).',
  })
  certifications: CaregiverCertificationSummary[];

  @ApiProperty({
    enum: CaregiverSkill,
    enumName: 'CaregiverSkill',
    isArray: true,
    description: 'Habilidades que declara el cuidador. Nadie las verifica (RN-CUI-19).',
  })
  skills: CaregiverSkill[];

  @ApiProperty({ description: 'Tiene la ⭐ de cuidado especial vigente (RN-CUI-07).' })
  hasSpecialCareCertification: boolean;

  @ApiProperty({ description: 'Insignia "Estudiante de veterinaria" vigente (RN-CUI-05).' })
  isVetStudent: boolean;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 4.8,
    description: 'Promedio de 1 a 5 con un decimal. Null si todavía no tiene calificaciones.',
  })
  rating: number | null;

  @ApiProperty({ type: 'integer' })
  ratingCount: number;

  @ApiProperty({ type: 'integer', description: 'Servicios completados en Pawie.' })
  completedBookingCount: number;

  @ApiProperty({ description: 'RN-CUI-16: las solicitudes se confirman sin esperar al cuidador.' })
  instantBooking: boolean;
}

export class CaregiverProfileResponse extends CaregiverSummary {
  @ApiProperty({ type: String, nullable: true })
  bio: string | null;

  @ApiProperty({ type: [DistrictOption] })
  districts: DistrictOption[];

  @ApiProperty({
    type: [CaregiverPrice],
    description: 'Los servicios que ofrece, al rango de su nivel (RN-PRE-01).',
  })
  prices: CaregiverPrice[];
}

/** RN-RES-01: the owner's pets, the service with its nights or visits, and the district. */
export class SearchCaregiversRequest extends ScheduleRequest {
  @ApiProperty({ type: [String], format: 'uuid', description: 'Mascotas del dueño.' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos una mascota.' })
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  petIds: string[];

  @ApiProperty({ format: 'uuid', description: 'Uno de los distritos de GET /v1/catalog.' })
  @IsUUID('all', { message: 'Elige un distrito.' })
  districtId: string;

  @ApiPropertyOptional({
    enum: CaregiverLevel,
    enumName: 'CaregiverLevel',
    description: 'Solo cuidadores de este nivel o uno más alto.',
  })
  @IsOptional()
  @IsEnum(CaregiverLevel, { message: 'Elige un nivel de la lista.' })
  minLevel?: CaregiverLevel;

  @ApiPropertyOptional({
    type: [String],
    example: ['FIRST_AID'],
    description: 'Códigos de certificación que debe tener vigentes todo el servicio.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  certificationCodes?: string[];

  @ApiPropertyOptional({
    example: 4.5,
    description: 'Calificación mínima, de 1 a 5. Deja fuera a quien aún no tiene calificaciones.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'Escribe una calificación de 1 a 5.' })
  @Min(1, { message: 'Escribe una calificación de 1 a 5.' })
  @Max(5, { message: 'Escribe una calificación de 1 a 5.' })
  minRating?: number;
}

export class CaregiverSearchResult extends CaregiverSummary {
  @ApiProperty({
    type: [CaregiverPrice],
    description: 'Sus precios para lo que se buscó (RN-PRE-01).',
  })
  prices: CaregiverPrice[];
}

export class CaregiverSearchResponse {
  @ApiProperty({
    enum: CareLevel,
    enumName: 'CareLevel',
    description:
      'RN-MAS-05, RN-MAS-06: Especial si alguna mascota lo es en esas fechas. Exige la ⭐, pero no cambia el precio.',
  })
  careLevel: CareLevel;

  @ApiProperty({ type: [SlotResponse], description: 'Los tramos que se buscaron, en orden.' })
  slots: SlotResponse[];

  @ApiProperty({
    type: [CaregiverSearchResult],
    description: 'Ordenados por calificación y después por cantidad de servicios.',
  })
  results: CaregiverSearchResult[];
}
