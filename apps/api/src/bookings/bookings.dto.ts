import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DistrictOption } from '../catalog/catalog.dto.js';
import { trimmed } from '../common/validation/trimmed.js';
import { BookingStatus, CareLevel, ServiceCode } from '../generated/prisma/enums.js';
import { BookingPayment } from '../payments/payments.dto.js';
import { ScheduleRequest } from './schedule.dto.js';

/** RN-RES-04: what the caregiver needs if something happens during the service. */
export class EmergencyDetails {
  @ApiProperty({ example: 'Luis Pérez', description: 'Contacto de emergencia.' })
  @Transform(trimmed)
  @IsString({ message: 'Escribe el nombre del contacto de emergencia.' })
  @IsNotEmpty({ message: 'Escribe el nombre del contacto de emergencia.' })
  @MaxLength(120, { message: 'El nombre puede tener hasta 120 caracteres.' })
  contactName: string;

  @ApiProperty({ example: '+503 7000 0000' })
  @Transform(trimmed)
  @IsPhoneNumber('SV', { message: 'Escribe un teléfono válido para el contacto de emergencia.' })
  contactPhone: string;

  @ApiPropertyOptional({
    example: 'Clínica Veterinaria San Benito',
    description: 'Veterinario de cabecera.',
  })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'El nombre puede tener hasta 120 caracteres.' })
  vetName?: string;

  @ApiPropertyOptional({ example: '+503 2222 0000' })
  @Transform(trimmed)
  @IsOptional()
  @IsPhoneNumber('SV', { message: 'Escribe un teléfono válido para el veterinario.' })
  vetPhone?: string;

  @ApiProperty({
    type: 'integer',
    example: 5000,
    description:
      'Monto preautorizado para emergencias, en centavos. Solo se declara: no se cobra por adelantado (RN-EME-04).',
  })
  @IsInt({ message: 'Escribe el monto en centavos.' })
  @Min(0, { message: 'El monto no puede ser negativo.' })
  @Max(200_000, { message: 'El monto puede ser de hasta $2,000.' })
  preauthorizedCents: number;

  @ApiProperty({
    enum: [true],
    description:
      'Consentimiento para llevar a la mascota a una clínica si hace falta. Sin él no se puede reservar (RN-EME-02).',
  })
  @Equals(true, {
    message:
      'Para reservar necesitamos tu permiso para llevar a tu mascota a una clínica si hace falta.',
  })
  clinicConsent: true;
}

/**
 * RN-RES-03, RN-RES-04: a booking with a caregiver from the search, for the owner's
 * pets and schedule, at one of the owner's addresses.
 */
export class CreateBookingRequest extends ScheduleRequest {
  @ApiProperty({ format: 'uuid', description: 'Un cuidador de los resultados de la búsqueda.' })
  @IsUUID('all', { message: 'Elige un cuidador.' })
  caregiverId: string;

  @ApiProperty({ type: [String], format: 'uuid', description: 'Mascotas del dueño.' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos una mascota.' })
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  petIds: string[];

  @ApiProperty({ format: 'uuid', description: 'Una de las direcciones de GET /v1/addresses.' })
  @IsUUID('all', { message: 'Elige una dirección.' })
  addressId: string;

  @ApiPropertyOptional({
    example: 'La comida está en la alacena de la cocina. Toby come dos veces al día.',
    description: 'Instrucciones para el cuidador (RN-RES-03).',
  })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Las instrucciones pueden tener hasta 2000 caracteres.' })
  instructions?: string;

  @ApiProperty({ type: EmergencyDetails })
  @IsObject({ message: 'Faltan los datos de emergencia.' })
  @ValidateNested()
  @Type(() => EmergencyDetails)
  emergency: EmergencyDetails;
}

export class CancelBookingRequest {
  @ApiPropertyOptional({ example: 'Cambié de planes.', description: 'Por qué cancela el dueño.' })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'El motivo puede tener hasta 500 caracteres.' })
  reason?: string;
}

export class BookingCaregiver {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Valeria M.' })
  displayName: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'URL firmada que vence en 10 minutos.',
  })
  photoUrl: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'RN-CTA-04: solo aparece cuando la reserva está confirmada.',
  })
  phone: string | null;
}

export class BookingPetResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Toby' })
  name: string;

  @ApiProperty({
    enum: CareLevel,
    enumName: 'CareLevel',
    description: 'Su nivel en las fechas de la reserva (RN-MAS-05).',
  })
  careLevel: CareLevel;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Las indicaciones del veterinario que se adjuntaron a la reserva (RN-RES-03).',
  })
  vetInstructionIds: string[];
}

export class BookingSlotResponse {
  @ApiProperty({ enum: ServiceCode, enumName: 'ServiceCode' })
  serviceCode: ServiceCode;

  @ApiProperty({ format: 'date-time' })
  startsAt: string;

  @ApiProperty({ format: 'date-time' })
  endsAt: string;

  @ApiProperty({
    type: 'integer',
    example: 1300,
    description: 'Precio del cuidador por una mascota, en centavos.',
  })
  unitPriceCents: number;

  @ApiProperty({
    type: 'integer',
    example: 1950,
    description: 'Con el recargo por cada mascota adicional (RN-PRE-02).',
  })
  subtotalCents: number;
}

/** The copy of the address the booking keeps (RN-CTA-04). */
export class BookingAddress {
  @ApiProperty({ example: 'Pasaje Las Mascotas 12, Residencial Pawie' })
  street: string;

  @ApiProperty({ type: String, nullable: true })
  details: string | null;

  @ApiProperty({ type: DistrictOption })
  district: DistrictOption;
}

export class BookingEmergency {
  @ApiProperty()
  contactName: string;

  @ApiProperty()
  contactPhone: string;

  @ApiProperty({ type: String, nullable: true })
  vetName: string | null;

  @ApiProperty({ type: String, nullable: true })
  vetPhone: string | null;

  @ApiProperty({ type: 'integer' })
  preauthorizedCents: number;

  @ApiProperty()
  clinicConsent: boolean;
}

/** What the owner pays, in cents (RN-PRE-03, RN-PRE-09). */
export class BookingPrice {
  @ApiProperty({
    type: 'integer',
    example: 1700,
    description: 'Lo que cobra el cuidador: la suma de los tramos.',
  })
  subtotalCents: number;

  @ApiProperty({
    type: 'integer',
    example: 1000,
    description: 'Tarifa de servicio, en puntos básicos. Es 0 en el primer servicio (RN-PRE-09).',
  })
  serviceFeeBp: number;

  @ApiProperty({ type: 'integer', example: 170 })
  serviceFeeCents: number;

  @ApiProperty({ type: 'integer', example: 1870, description: 'Lo que paga el dueño.' })
  totalCents: number;

  @ApiProperty({
    description:
      'RN-PRE-09: es el primer servicio y no lleva tarifa. La app muestra la línea tachada en $0.00.',
  })
  firstServiceFeeWaived: boolean;
}

export class BookingResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: BookingStatus, enumName: 'BookingStatus', description: 'Sección 8.2.' })
  status: BookingStatus;

  @ApiProperty({ enum: ServiceCode, enumName: 'ServiceCode' })
  serviceCode: ServiceCode;

  @ApiProperty({
    enum: CareLevel,
    enumName: 'CareLevel',
    description:
      'RN-MAS-06: Especial si alguna mascota lo es. Exige la ⭐ del cuidador, pero no cambia el precio.',
  })
  careLevel: CareLevel;

  @ApiProperty({ format: 'date-time', description: 'Inicio del primer tramo.' })
  startsAt: string;

  @ApiProperty({ format: 'date-time', description: 'Fin del último tramo.' })
  endsAt: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Mientras está SOLICITADA: hasta cuándo puede responder el cuidador (RN-RES-06).',
  })
  responseDueAt: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Mientras está PENDIENTE DE PAGO: hasta cuándo puede pagar el dueño (RN-RES-07).',
  })
  paymentDueAt: string | null;

  @ApiProperty({ type: BookingCaregiver })
  caregiver: BookingCaregiver;

  @ApiProperty({ type: [BookingPetResponse] })
  pets: BookingPetResponse[];

  @ApiProperty({ type: [BookingSlotResponse], description: 'Cada visita o cada noche, en orden.' })
  slots: BookingSlotResponse[];

  @ApiProperty({ type: BookingAddress })
  address: BookingAddress;

  @ApiProperty({ type: String, nullable: true })
  instructions: string | null;

  @ApiProperty({ type: BookingEmergency })
  emergency: BookingEmergency;

  @ApiProperty({ type: BookingPrice })
  price: BookingPrice;

  @ApiProperty({
    type: BookingPayment,
    nullable: true,
    description:
      'El pago que la confirmó o, si no, el último intento. Mientras la reserva está PENDING_PAYMENT y el pago está PENDING, la app espera el aviso de Wompi (RN-PAG-02).',
  })
  payment: BookingPayment | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}
