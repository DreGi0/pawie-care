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
import { CareTask, PetScheduleKind, PetSex } from '../generated/prisma/enums.js';
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

  @ApiPropertyOptional({
    example: 'Croquetas para perro adulto, de cordero',
    description: 'RN-MAS-02: marca o tipo de alimento.',
  })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  foodDescription?: string;

  @ApiPropertyOptional({
    example: '1 taza por comida',
    description: 'La porción de siempre. Una comida del horario puede tener la suya.',
  })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  foodPortion?: string;

  @ApiPropertyOptional({ example: 'Galletas de pollo, hasta 3 al día' })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  allowedTreats?: string;

  @ApiPropertyOptional({ example: 'Sale al patio al despertar. Duerme en su cama de la sala.' })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  dailyRoutine?: string;

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

  @ApiPropertyOptional({
    description:
      'Los medicamentos que toma, solo para informar: nunca es una instrucción para el cuidador. Si el cuidador tiene que dárselos, van como tarea MEDICATION con sus horarios (RN-CUI-12).',
  })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  medications?: string;

  @ApiPropertyOptional({
    format: 'date',
    description:
      'RN-MAS-11: primer día del celo. Solo para hembras, y junto con heatEndsOn. No la hace Especial ni cambia el precio.',
  })
  @IsOptional()
  @IsDateOnly()
  heatStartsOn?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Último día del celo, incluido.' })
  @IsOptional()
  @IsDateOnly()
  heatEndsOn?: string;

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
  foodDescription: string | null;

  @ApiProperty({ type: String, nullable: true })
  foodPortion: string | null;

  @ApiProperty({ type: String, nullable: true })
  allowedTreats: string | null;

  @ApiProperty({ type: String, nullable: true })
  dailyRoutine: string | null;

  @ApiProperty({ type: String, nullable: true })
  vetName: string | null;

  @ApiProperty({ type: String, nullable: true })
  vetClinic: string | null;

  @ApiProperty({ type: String, nullable: true })
  vetPhone: string | null;

  @ApiProperty({ type: String, nullable: true })
  healthConditions: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Solo informa: nunca se muestra como instrucción ni como tarea del cuidador.',
  })
  medications: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true, description: 'RN-MAS-11' })
  heatStartsOn: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  heatEndsOn: string | null;

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

/**
 * RN-MAS-02: a meal or a medication dose at a time of day, in El Salvador. A dose goes
 * with a MEDICATION care need of the same pet, which gives its dates and its vet
 * instructions (RN-CUI-12); a meal goes without one.
 */
export class ScheduleItemRequest {
  @ApiProperty({ enum: PetScheduleKind, enumName: 'PetScheduleKind' })
  @IsEnum(PetScheduleKind, { message: 'Elige si es una comida o una medicina.' })
  kind: PetScheduleKind;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    maximum: 1439,
    example: 420,
    description: 'Minutos desde la medianoche, hora de El Salvador: 420 son las 7:00.',
  })
  @IsInt({ message: 'Elige una hora.' })
  @Min(0, { message: 'Elige una hora.' })
  @Max(1439, { message: 'Elige una hora.' })
  minuteOfDay: number;

  @ApiProperty({ example: 'Desayuno', description: 'La comida o el nombre de la medicina.' })
  @Transform(trimmed)
  @IsString({ message: 'Escribe qué es.' })
  @IsNotEmpty({ message: 'Escribe qué es.' })
  @MaxLength(80, { message: 'Puede tener hasta 80 caracteres.' })
  label: string;

  @ApiPropertyOptional({
    example: '1 taza',
    description: 'Cuánto. En una comida sin porción se usa foodPortion.',
  })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Puede tener hasta 80 caracteres.' })
  dose?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Obligatorio en una medicina: su tarea de cuidado MEDICATION. Una comida no lleva.',
  })
  @IsOptional()
  @IsUUID()
  careNeedId?: string;
}

export class ScheduleItemResponse {
  @ApiProperty({ format: 'uuid', description: 'Editar el horario conserva el id.' })
  id: string;

  @ApiProperty({ enum: PetScheduleKind, enumName: 'PetScheduleKind' })
  kind: PetScheduleKind;

  @ApiProperty({ type: 'integer', example: 420, description: 'Minutos desde la medianoche.' })
  minuteOfDay: number;

  @ApiProperty({ example: 'Desayuno' })
  label: string;

  @ApiProperty({ type: String, nullable: true })
  dose: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  careNeedId: string | null;
}

export class PetDetail extends PetResponse {
  @ApiProperty({ type: [VaccinationResponse] })
  vaccinations: VaccinationResponse[];

  @ApiProperty({ type: [VetInstructionResponse] })
  vetInstructions: VetInstructionResponse[];

  @ApiProperty({ type: [CareNeedResponse] })
  careNeeds: CareNeedResponse[];

  @ApiProperty({
    type: [ScheduleItemResponse],
    description: 'Comidas y medicinas, ordenadas por hora.',
  })
  scheduleItems: ScheduleItemResponse[];
}
