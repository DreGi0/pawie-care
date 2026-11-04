import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DistrictOption } from '../catalog/catalog.dto.js';
import { trimmed } from '../common/validation/trimmed.js';
import { FileResponse } from '../files/files.dto.js';
import {
  CaregiverDocumentKind,
  CaregiverLevel,
  CaregiverSkill,
  CaregiverStatus,
  ServiceCode,
} from '../generated/prisma/enums.js';
import { CaregiverBadge } from './badges.js';
import { CaregiverSetupStep } from './setup-steps.js';

/**
 * A window of the weekly schedule (RN-CUI-04), in minutes since midnight in El
 * Salvador. A window that ends the next day has endMinute past 1440: an overnight
 * from 19:00 to 08:00 is 1140 to 1920.
 */
export class AvailabilityWindow {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 7, description: 'ISO: 1 es lunes.' })
  @IsInt()
  @Min(1)
  @Max(7)
  weekday: number;

  @ApiProperty({ type: 'integer', minimum: 0, maximum: 1439, example: 420 })
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute: number;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: 2879,
    example: 720,
    description: 'Mayor que startMinute y a lo sumo 24 h después.',
  })
  @IsInt()
  @Min(1)
  @Max(2879)
  endMinute: number;
}

export class CaregiverPriceRequest {
  @ApiProperty({ enum: ServiceCode, enumName: 'ServiceCode' })
  @IsEnum(ServiceCode, { message: 'Elige un servicio de la lista.' })
  serviceCode: ServiceCode;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    example: 900,
    description:
      'Precio por una mascota, en centavos, dentro del rango de su nivel. Null usa el sugerido (RN-CUI-17).',
  })
  @IsOptional()
  @IsInt({ message: 'Escribe el precio en centavos.' })
  priceCents: number | null;
}

export class CaregiverDocumentRequest {
  @ApiProperty({ enum: CaregiverDocumentKind, enumName: 'CaregiverDocumentKind' })
  @IsEnum(CaregiverDocumentKind)
  kind: CaregiverDocumentKind;

  @ApiProperty({
    format: 'uuid',
    description:
      'Un archivo ya subido: ID_DOCUMENT para el DUI, SELFIE para la selfie y BACKGROUND_CHECK para los antecedentes.',
  })
  @IsUUID()
  fileId: string;
}

/** RN-CUI-18: what the caregiver sets up by themselves. Each field left out stays as it is. */
export class UpdateCaregiverMeRequest {
  @ApiPropertyOptional({ type: String, nullable: true, description: 'Descripción del perfil.' })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'La descripción puede tener hasta 1000 caracteres.' })
  bio?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Un archivo CAREGIVER_PHOTO ya subido. Null quita la foto.',
  })
  @IsOptional()
  @IsUUID()
  photoFileId?: string | null;

  @ApiPropertyOptional({
    enum: CaregiverSkill,
    enumName: 'CaregiverSkill',
    isArray: true,
    description: 'Reemplaza las habilidades declaradas (RN-CUI-19).',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(CaregiverSkill, { each: true })
  skills?: CaregiverSkill[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Reemplaza los distritos que cubre (RN-CUI-04), de GET /v1/catalog.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  districtIds?: string[];

  @ApiPropertyOptional({
    type: [AvailabilityWindow],
    description:
      'Reemplaza el horario semanal (RN-CUI-04). Las ventanas de un mismo día no se pueden cruzar.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AvailabilityWindow)
  availability?: AvailabilityWindow[];

  @ApiPropertyOptional({
    type: [CaregiverPriceRequest],
    description:
      'Reemplaza los servicios que ofrece y su precio (RN-CUI-17). Un servicio que no está en la lista deja de ofrecerse.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique((price: CaregiverPriceRequest) => price.serviceCode)
  @ValidateNested({ each: true })
  @Type(() => CaregiverPriceRequest)
  prices?: CaregiverPriceRequest[];

  @ApiPropertyOptional({ description: 'RN-CUI-16: las solicitudes se confirman sin esperarlo.' })
  @IsOptional()
  @IsBoolean()
  instantBooking?: boolean;

  @ApiPropertyOptional({
    description: 'RN-CUI-20: pausado no aparece en búsquedas, pero conserva sus reservas.',
  })
  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;

  @ApiPropertyOptional({
    type: [CaregiverDocumentRequest],
    description:
      'RN-CUI-01: reemplaza los documentos de esos tipos. Solo mientras el alta no está aprobada.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique((document: CaregiverDocumentRequest) => document.kind)
  @ValidateNested({ each: true })
  @Type(() => CaregiverDocumentRequest)
  documents?: CaregiverDocumentRequest[];
}

export class CaregiverDocumentResponse {
  @ApiProperty({ enum: CaregiverDocumentKind, enumName: 'CaregiverDocumentKind' })
  kind: CaregiverDocumentKind;

  @ApiProperty({ type: FileResponse })
  file: FileResponse;
}

/** The caregiver's own profile, with what the owners don't see. */
export class CaregiverMeResponse {
  @ApiProperty({ enum: CaregiverStatus, enumName: 'CaregiverStatus', description: 'RN-CUI-03.' })
  status: CaregiverStatus;

  @ApiProperty({ description: 'RN-CUI-20.' })
  isPaused: boolean;

  @ApiProperty({ description: 'RN-CUI-16.' })
  instantBooking: boolean;

  @ApiProperty({ type: String, nullable: true })
  bio: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'URL firmada que vence en 10 minutos.',
  })
  photoUrl: string | null;

  @ApiProperty({ enum: CaregiverSkill, enumName: 'CaregiverSkill', isArray: true })
  skills: CaregiverSkill[];

  @ApiProperty({ type: [DistrictOption], description: 'Ordenados por nombre.' })
  districts: DistrictOption[];

  @ApiProperty({ type: [AvailabilityWindow], description: 'Ordenadas por día y hora.' })
  availability: AvailabilityWindow[];

  @ApiProperty({
    type: [CaregiverDocumentResponse],
    description: 'RN-CUI-01: los que ya subió. Solo los ve el cuidador.',
  })
  documents: CaregiverDocumentResponse[];

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'RN-CUI-02: cuándo aprobó el curso de bienvenida.',
  })
  welcomeCoursePassedAt: string | null;

  @ApiProperty({ enum: CaregiverLevel, enumName: 'CaregiverLevel' })
  level: CaregiverLevel;

  @ApiProperty({ enum: CaregiverBadge, enumName: 'CaregiverBadge', isArray: true })
  badges: CaregiverBadge[];

  @ApiProperty({
    enum: CaregiverSetupStep,
    enumName: 'CaregiverSetupStep',
    isArray: true,
    description:
      'Lo que le falta para aparecer en búsquedas, en orden (RN-CUI-01 a RN-CUI-04, RN-CUI-17).',
  })
  pendingSteps: CaregiverSetupStep[];

  @ApiProperty({
    description:
      'Aparece en búsquedas: no le falta ningún paso, no está pausado ni suspendido (RN-CUI-03, RN-CUI-20).',
  })
  visibleInSearch: boolean;
}

/** RN-NIV-05. Kinds in the order the level lists them. */
export const LevelRequirementKind = {
  REVIEWS: 'REVIEWS',
  AVERAGE_RATING: 'AVERAGE_RATING',
  COMPLETED_BOOKINGS: 'COMPLETED_BOOKINGS',
  CERTIFICATIONS: 'CERTIFICATIONS',
  CERTIFICATION: 'CERTIFICATION',
} as const;
export type LevelRequirementKind = (typeof LevelRequirementKind)[keyof typeof LevelRequirementKind];

export class RequiredCertification {
  @ApiProperty({ example: 'FIRST_AID' })
  code: string;

  @ApiProperty({ example: 'Primeros auxilios' })
  name: string;
}

export class LevelRequirementResponse {
  @ApiProperty({ enum: LevelRequirementKind, enumName: 'LevelRequirementKind' })
  kind: LevelRequirementKind;

  @ApiProperty({
    example: 12,
    description:
      'La cifra del cuidador. El promedio va con un decimal, redondeado hacia abajo. En CERTIFICATION es 1 si la tiene y 0 si no.',
  })
  current: number;

  @ApiProperty({ example: 3 })
  required: number;

  @ApiProperty()
  met: boolean;

  @ApiProperty({
    type: RequiredCertification,
    nullable: true,
    description: 'La certificación que pide el nivel, solo en CERTIFICATION.',
  })
  certification: RequiredCertification | null;
}

export class NextLevelProgress {
  @ApiProperty({ enum: CaregiverLevel, enumName: 'CaregiverLevel' })
  level: CaregiverLevel;

  @ApiProperty({ type: [LevelRequirementResponse], description: 'Cumplidos o no.' })
  requirements: LevelRequirementResponse[];
}

export class CaregiverLevelResponse {
  @ApiProperty({ enum: CaregiverLevel, enumName: 'CaregiverLevel', description: 'RN-NIV-01.' })
  level: CaregiverLevel;

  @ApiProperty({
    type: NextLevelProgress,
    nullable: true,
    description: 'RN-NIV-05. Null para un Súper Cuidador.',
  })
  next: NextLevelProgress | null;
}

export class PriceRangeResponse {
  @ApiProperty({ type: 'integer', example: 600 })
  minCents: number;

  @ApiProperty({ type: 'integer', example: 700 })
  suggestedCents: number;

  @ApiProperty({ type: 'integer', example: 900 })
  maxCents: number;
}

export class NextLevelPrice {
  @ApiProperty({ enum: CaregiverLevel, enumName: 'CaregiverLevel' })
  level: CaregiverLevel;

  @ApiProperty({ type: 'integer', example: 1000 })
  suggestedCents: number;
}

/** RN-CUI-17, RN-PRE-01, RN-PRE-04: one service of the price calculator. */
export class CaregiverServicePriceResponse {
  @ApiProperty({ enum: ServiceCode, enumName: 'ServiceCode' })
  serviceCode: ServiceCode;

  @ApiProperty({ description: 'Lo ofrece: aparece en las búsquedas de ese servicio.' })
  offered: boolean;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    description: 'El precio que fijó. Null si usa el sugerido.',
  })
  caregiverPriceCents: number | null;

  @ApiProperty({
    type: 'integer',
    description:
      'El precio que se cobra por una mascota: el suyo o el sugerido, dentro del rango vigente.',
  })
  priceCents: number;

  @ApiProperty({
    type: 'integer',
    description: 'Lo que recibe con ese precio, ya descontada la comisión vigente (RN-PRE-04).',
  })
  payoutCents: number;

  @ApiProperty({
    type: PriceRangeResponse,
    description: 'El rango y el sugerido de su nivel (RN-PRE-01).',
  })
  range: PriceRangeResponse;

  @ApiProperty({
    type: NextLevelPrice,
    nullable: true,
    description: 'El sugerido del siguiente nivel. Null para un Súper Cuidador.',
  })
  nextLevel: NextLevelPrice | null;
}

export class CaregiverPricesResponse {
  @ApiProperty({ enum: CaregiverLevel, enumName: 'CaregiverLevel' })
  level: CaregiverLevel;

  @ApiProperty({ type: [CaregiverServicePriceResponse], description: 'Todos los servicios.' })
  prices: CaregiverServicePriceResponse[];
}

export class PriceQuoteRequest {
  @ApiProperty({ enum: ServiceCode, enumName: 'ServiceCode' })
  @IsEnum(ServiceCode, { message: 'Elige un servicio de la lista.' })
  serviceCode: ServiceCode;

  @ApiProperty({ type: 'integer', example: 900, description: 'Precio por una mascota.' })
  @IsInt({ message: 'Escribe el precio en centavos.' })
  priceCents: number;
}

export class PriceQuoteResponse {
  @ApiProperty({ enum: ServiceCode, enumName: 'ServiceCode' })
  serviceCode: ServiceCode;

  @ApiProperty({ type: 'integer' })
  priceCents: number;

  @ApiProperty({
    type: 'integer',
    description: 'Lo que recibiría, ya descontada la comisión vigente (RN-PRE-04).',
  })
  payoutCents: number;
}
