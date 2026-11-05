import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DistrictOption } from '../catalog/catalog.dto.js';
import { trimmed } from '../common/validation/trimmed.js';
import { BookingStatus, CareLevel, ServiceCode } from '../generated/prisma/enums.js';
import { BookingPetProfile } from '../pets/pets.dto.js';
import { BookingEmergency } from './bookings.dto.js';

/** `?status=REQUESTED` arrives as a string, and `?status=A&status=B` as an array. */
const toArray = ({ value }: { value: unknown }) =>
  value === undefined || Array.isArray(value) ? value : [value];

export class CaregiverBookingsQuery {
  @ApiPropertyOptional({
    enum: BookingStatus,
    enumName: 'BookingStatus',
    isArray: true,
    description: 'Solo las reservas en estos estados. Sin él, todas.',
  })
  @Transform(toArray)
  @IsOptional()
  @IsEnum(BookingStatus, { each: true, message: 'Ese estado no existe.' })
  status?: BookingStatus[];

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Solo las que todavía no terminan, para la agenda.',
  })
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsOptional()
  @IsBoolean()
  upcoming?: boolean;
}

export class RejectBookingRequest {
  @ApiPropertyOptional({
    example: 'Ese día no estoy en la ciudad.',
    description: 'Por qué rechaza el cuidador. El dueño no lo ve.',
  })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'El motivo puede tener hasta 500 caracteres.' })
  reason?: string;
}

export class CaregiverBookingSlot {
  @ApiProperty({ enum: ServiceCode, enumName: 'ServiceCode' })
  serviceCode: ServiceCode;

  @ApiProperty({ format: 'date-time' })
  startsAt: string;

  @ApiProperty({ format: 'date-time' })
  endsAt: string;
}

/** RN-RES-11, RN-PRE-04: what the caregiver gets, calculated and saved by the API. */
export class CaregiverBookingEarnings {
  @ApiProperty({
    type: 'integer',
    example: 1300,
    description: 'Lo que cobra el cuidador: la suma de los tramos.',
  })
  subtotalCents: number;

  @ApiProperty({ type: 'integer', example: 0, description: 'RN-PRE-04, en puntos básicos.' })
  commissionBp: number;

  @ApiProperty({ type: 'integer', example: 0 })
  commissionCents: number;

  @ApiProperty({
    type: 'integer',
    example: 1300,
    description: 'Lo que va a ganar: el subtotal menos la comisión. La app muestra este monto.',
  })
  payoutCents: number;
}

/** The copy of the address the booking keeps, without the district. */
export class CaregiverBookingAddress {
  @ApiProperty({ example: 'Pasaje Las Mascotas 12, Residencial Pawie' })
  street: string;

  @ApiProperty({ type: String, nullable: true })
  details: string | null;
}

export class CaregiverBookingOwner {
  @ApiProperty({ example: 'Ana P.' })
  displayName: string;
}

/** A booking as its caregiver sees it (RN-RES-11). */
export class CaregiverBookingResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: BookingStatus, enumName: 'BookingStatus' })
  status: BookingStatus;

  @ApiProperty({ enum: ServiceCode, enumName: 'ServiceCode' })
  serviceCode: ServiceCode;

  @ApiProperty({
    enum: CareLevel,
    enumName: 'CareLevel',
    description: 'RN-MAS-06: Especial si alguna mascota lo es.',
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
    description: 'Mientras está SOLICITADA: hasta cuándo puede responder (RN-RES-06).',
  })
  responseDueAt: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Mientras está PENDIENTE DE PAGO: hasta cuándo puede pagar el dueño (RN-RES-07).',
  })
  paymentDueAt: string | null;

  @ApiProperty({ type: CaregiverBookingOwner })
  owner: CaregiverBookingOwner;

  @ApiProperty({ type: DistrictOption })
  district: DistrictOption;

  @ApiProperty({
    type: CaregiverBookingAddress,
    nullable: true,
    description: 'RN-CTA-04: la dirección exacta, solo desde que la reserva está CONFIRMED.',
  })
  address: CaregiverBookingAddress | null;

  @ApiProperty({
    type: BookingEmergency,
    nullable: true,
    description: 'RN-RES-04, RN-CTA-04: los datos de emergencia, solo desde CONFIRMED.',
  })
  emergency: BookingEmergency | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'RN-RES-03: las instrucciones del dueño para este servicio.',
  })
  instructions: string | null;

  @ApiProperty({ type: [CaregiverBookingSlot], description: 'Cada tramo, en orden.' })
  slots: CaregiverBookingSlot[];

  @ApiProperty({ type: CaregiverBookingEarnings })
  earnings: CaregiverBookingEarnings;

  @ApiProperty({ type: [BookingPetProfile] })
  pets: BookingPetProfile[];

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

/** A booking the caregiver is still to be paid for. */
export class PendingEarning {
  @ApiProperty({ format: 'uuid' })
  bookingId: string;

  @ApiProperty({ enum: BookingStatus, enumName: 'BookingStatus' })
  status: BookingStatus;

  @ApiProperty({ enum: ServiceCode, enumName: 'ServiceCode' })
  serviceCode: ServiceCode;

  @ApiProperty({ format: 'date-time' })
  startsAt: string;

  @ApiProperty({ type: [String], example: ['Toby'] })
  petNames: string[];

  @ApiProperty({ type: 'integer', example: 1300 })
  payoutCents: number;
}

/** RN-PAG-10 */
export class CaregiverEarningsResponse {
  @ApiProperty({
    type: 'integer',
    example: 2600,
    description:
      'Por cobrar: lo que va a ganar con las reservas confirmadas o en retención (RN-PAG-03).',
  })
  pendingCents: number;

  @ApiProperty({
    type: 'integer',
    example: 0,
    description: 'Pagado (simulado en la demo). Es 0 hasta que existan los pagos al cuidador.',
  })
  paidCents: number;

  @ApiProperty({ example: '2026-11', description: 'El mes en curso, hora de El Salvador.' })
  month: string;

  @ApiProperty({
    type: 'integer',
    example: 2600,
    description:
      'Lo que gana con los servicios que empiezan en el mes, por cobrar o pagados. No cuenta las reservas que no se confirmaron.',
  })
  monthTotalCents: number;

  @ApiProperty({
    type: [PendingEarning],
    description: 'Lo por cobrar, el servicio más próximo primero.',
  })
  pending: PendingEarning[];
}
