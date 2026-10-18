import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SpeciesOption } from '../catalog/catalog.dto.js';
import { IsDateOnly } from '../common/validation/is-date-only.js';
import { trimmed } from '../common/validation/trimmed.js';
import { CareTask, PetSex } from '../generated/prisma/enums.js';
import type { CareTaskGroup } from './care-tasks.js';

/** RN-MAS-02. Creating and editing take the whole pet: an optional field left out is cleared. */
export class PetRequest {
  @ApiProperty({ example: 'Luna' })
  @Transform(trimmed)
  @IsString({ message: 'Escribe su nombre.' })
  @IsNotEmpty({ message: 'Escribe su nombre.' })
  @MaxLength(60, { message: 'El nombre puede tener hasta 60 caracteres.' })
  name: string;

  @ApiProperty({ format: 'uuid', description: 'Una de las especies de GET /v1/catalog.' })
  @IsUUID('all', { message: 'Elige una especie.' })
  speciesId: string;

  @ApiPropertyOptional({ example: 'Beagle' })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  breed?: string;

  @ApiProperty({ format: 'date', example: '2019-03-10' })
  @IsDateOnly()
  birthDate: string;

  @ApiPropertyOptional({ default: false, description: 'RN-MAS-02: la fecha puede ser aproximada.' })
  @IsOptional()
  @IsBoolean()
  birthDateIsApproximate?: boolean;

  @ApiProperty({ enum: PetSex, enumName: 'PetSex' })
  @IsEnum(PetSex, { message: 'Elige macho o hembra.' })
  sex: PetSex;

  @ApiPropertyOptional({ type: 'integer', example: 12_500, description: 'Peso en gramos.' })
  @IsOptional()
  @IsInt({ message: 'Escribe el peso en gramos.' })
  @Min(1, { message: 'Escribe el peso en gramos.' })
  @Max(150_000, { message: 'Revisa el peso: está en gramos.' })
  weightGrams?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSterilized?: boolean;

  @ApiPropertyOptional({ example: 'Juguetona y muy sociable' })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  temperament?: string;

  @ApiPropertyOptional({ example: 'Jala la correa al salir' })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  handlingNotes?: string;

  @ApiPropertyOptional({ description: 'Veterinario de cabecera.' })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  vetName?: string;

  @ApiPropertyOptional()
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  vetClinic?: string;

  @ApiPropertyOptional({ example: '+503 2222 0000' })
  @Transform(trimmed)
  @IsOptional()
  @IsPhoneNumber('SV', { message: 'Escribe un teléfono válido.' })
  vetPhone?: string;

  @ApiPropertyOptional({
    description:
      'Texto libre para el perfil. Lo que el cuidador tiene que hacer va en las tareas de cuidado.',
  })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  healthConditions?: string;

  @ApiPropertyOptional()
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  medications?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Un archivo PET_PHOTO ya subido (POST /v1/files).',
  })
  @IsOptional()
  @IsUUID()
  photoFileId?: string;
}

export class PetResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: SpeciesOption })
  species: SpeciesOption;

  @ApiProperty({ type: String, nullable: true })
  breed: string | null;

  @ApiProperty({ format: 'date' })
  birthDate: string;

  @ApiProperty()
  birthDateIsApproximate: boolean;

  @ApiProperty({ enum: PetSex, enumName: 'PetSex' })
  sex: PetSex;

  @ApiProperty({ type: 'integer', nullable: true })
  weightGrams: number | null;

  @ApiProperty({ type: Boolean, nullable: true })
  isSterilized: boolean | null;

  @ApiProperty({ type: String, nullable: true })
  temperament: string | null;

  @ApiProperty({ type: String, nullable: true })
  handlingNotes: string | null;

  @ApiProperty({ type: String, nullable: true })
  vetName: string | null;

  @ApiProperty({ type: String, nullable: true })
  vetClinic: string | null;

  @ApiProperty({ type: String, nullable: true })
  vetPhone: string | null;

  @ApiProperty({ type: String, nullable: true })
  healthConditions: string | null;

  @ApiProperty({ type: String, nullable: true })
  medications: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  photoFileId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'URL firmada que vence en 10 minutos.',
  })
  photoUrl: string | null;
}

export class VaccinationRequest {
  @ApiProperty({ example: 'Antirrábica' })
  @Transform(trimmed)
  @IsString({ message: 'Escribe el nombre de la vacuna.' })
  @IsNotEmpty({ message: 'Escribe el nombre de la vacuna.' })
  @MaxLength(80)
  name: string;

  @ApiProperty({ format: 'date' })
  @IsDateOnly()
  administeredOn: string;

  @ApiPropertyOptional({ format: 'date', description: 'Cuándo toca la siguiente dosis.' })
  @IsOptional()
  @IsDateOnly()
  nextDueOn?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Un archivo VACCINATION_RECORD ya subido.' })
  @IsOptional()
  @IsUUID()
  fileId?: string;
}

export class VaccinationResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ format: 'date' })
  administeredOn: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  nextDueOn: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  fileId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'URL firmada que vence en 10 minutos.',
  })
  fileUrl: string | null;
}

/** RN-MAS-08: a prescription or post-operative instructions. */
export class VetInstructionRequest {
  @ApiProperty({ format: 'uuid', description: 'Un archivo VET_INSTRUCTION ya subido.' })
  @IsUUID('all', { message: 'Sube el documento del veterinario.' })
  fileId: string;

  @ApiProperty({ format: 'date', description: 'La fecha que dice el documento.' })
  @IsDateOnly()
  issuedOn: string;

  @ApiPropertyOptional()
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  vetName?: string;

  @ApiPropertyOptional()
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class VetInstructionResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'date' })
  issuedOn: string;

  @ApiProperty({ type: String, nullable: true })
  vetName: string | null;

  @ApiProperty({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty({ format: 'uuid' })
  fileId: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'URL firmada que vence en 10 minutos.',
  })
  fileUrl: string | null;

  @ApiProperty({ example: 'application/pdf' })
  contentType: string;
}

/**
 * A task the caregiver would do during the service (RN-MAS-06, RN-MAS-08, RN-MAS-09):
 * clinical tasks need vetInstructionId, assistance tasks need ownerInstructions, and
 * only chronic monitoring, mobility help and prohibited tasks can leave endsOn empty.
 */
export class CareNeedRequest {
  @ApiProperty({ enum: CareTask, enumName: 'CareTask' })
  @IsEnum(CareTask, { message: 'Elige una tarea de la lista.' })
  task: CareTask;

  @ApiProperty({ format: 'date' })
  @IsDateOnly()
  startsOn: string;

  @ApiPropertyOptional({ format: 'date', description: 'Último día, incluido.' })
  @IsOptional()
  @IsDateOnly()
  endsOn?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Indicaciones del veterinario de esta mascota.',
  })
  @IsOptional()
  @IsUUID()
  vetInstructionId?: string;

  @ApiPropertyOptional({ description: 'Cómo hacerlo, en palabras del dueño.' })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  ownerInstructions?: string;
}

export class CareNeedResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: CareTask, enumName: 'CareTask' })
  task: CareTask;

  @ApiProperty({ enum: ['CLINICAL', 'ASSISTANCE', 'PROHIBITED'], enumName: 'CareTaskGroup' })
  group: CareTaskGroup;

  @ApiProperty({ format: 'date' })
  startsOn: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  endsOn: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  vetInstructionId: string | null;

  @ApiProperty({ type: String, nullable: true })
  ownerInstructions: string | null;
}

export class PetDetail extends PetResponse {
  @ApiProperty({ type: [VaccinationResponse] })
  vaccinations: VaccinationResponse[];

  @ApiProperty({ type: [VetInstructionResponse] })
  vetInstructions: VetInstructionResponse[];

  @ApiProperty({ type: [CareNeedResponse] })
  careNeeds: CareNeedResponse[];
}
