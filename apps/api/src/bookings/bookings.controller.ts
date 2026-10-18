import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ErrorResponse } from '../common/errors/error-response.dto.js';
import { BookingResponse, CancelBookingRequest, CreateBookingRequest } from './bookings.dto.js';
import { BookingsService } from './bookings.service.js';

const bookingId = () => Param('bookingId', ParseUUIDPipe);

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'Reservar',
    description:
      'RN-RES-03 y RN-RES-04. Valida igual que la búsqueda. Con Reserva inmediata queda PENDING_PAYMENT con `paymentDueAt` (RN-RES-07); si no, REQUESTED con `responseDueAt` (RN-RES-06). Los precios se copian al crearla (RN-PRE-07).',
  })
  @ApiCreatedResponse({ type: BookingResponse })
  @ApiNotFoundResponse({
    type: ErrorResponse,
    description: '`ADDRESS_NOT_FOUND` o `PET_NOT_FOUND`.',
  })
  @ApiConflictResponse({
    type: ErrorResponse,
    description:
      '`SLOT_TAKEN`: otra reserva tomó ese horario (RN-CUI-15). `CAREGIVER_UNAVAILABLE`: la búsqueda ya no mostraría a ese cuidador para esa reserva.',
  })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description:
      'Los mismos de la búsqueda: `TOO_MANY_PETS`, `INVALID_SCHEDULE`, `TOO_SOON` o `PET_NOT_BOOKABLE`.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateBookingRequest,
  ): Promise<BookingResponse> {
    return this.bookings.create(user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'Mis reservas', description: 'Primero las de servicio más reciente.' })
  @ApiOkResponse({ type: [BookingResponse] })
  list(@CurrentUser() user: AuthenticatedUser): Promise<BookingResponse[]> {
    return this.bookings.list(user.id);
  }

  @Get(':bookingId')
  @ApiOperation({
    summary: 'Ver una reserva',
    description: 'El teléfono del cuidador aparece cuando está confirmada (RN-CTA-04).',
  })
  @ApiOkResponse({ type: BookingResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '`BOOKING_NOT_FOUND`.' })
  get(@CurrentUser() user: AuthenticatedUser, @bookingId() id: string): Promise<BookingResponse> {
    return this.bookings.get(user.id, id);
  }

  @Post(':bookingId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancelar una reserva',
    description:
      'Sin costo mientras está REQUESTED o PENDING_PAYMENT; pasa a CANCELLED_BY_OWNER y libera el horario. Cancelar una reserva confirmada llega después de la demo.',
  })
  @ApiOkResponse({ type: BookingResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '`BOOKING_NOT_FOUND`.' })
  @ApiConflictResponse({
    type: ErrorResponse,
    description:
      '`BOOKING_NOT_CANCELLABLE`: ya está pagada, vencida o cancelada. `BOOKING_STATUS_CHANGED`: cambió mientras tanto.',
  })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @bookingId() id: string,
    @Body() body: CancelBookingRequest,
  ): Promise<BookingResponse> {
    return this.bookings.cancel(user.id, id, body.reason);
  }
}
