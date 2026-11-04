import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ErrorResponse } from '../common/errors/error-response.dto.js';
import {
  CaregiverBookingResponse,
  CaregiverBookingsQuery,
  CaregiverEarningsResponse,
} from './caregiver-bookings.dto.js';
import { CaregiverBookingsService } from './caregiver-bookings.service.js';

const NO_PROFILE = {
  type: ErrorResponse,
  description: '`CAREGIVER_PROFILE_NOT_FOUND`: la cuenta no ha activado el modo cuidador.',
};

/**
 * The caregiver's bookings and earnings (RN-RES-11, RN-PAG-10). Its routes have more
 * segments than `caregivers/:caregiverId`, so they never reach it.
 */
@ApiTags('caregivers')
@ApiBearerAuth()
@Controller('caregivers/me')
export class CaregiverBookingsController {
  constructor(private readonly caregiverBookings: CaregiverBookingsService) {}

  @Get('bookings')
  @ApiOperation({
    summary: 'Mis reservas como cuidador',
    description:
      'RN-RES-11. Primero las solicitudes, la que vence primero arriba (RN-RES-06); después el resto, por inicio. La dirección exacta y los datos de emergencia aparecen desde CONFIRMED (RN-CTA-04).',
  })
  @ApiOkResponse({ type: [CaregiverBookingResponse] })
  @ApiNotFoundResponse(NO_PROFILE)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CaregiverBookingsQuery,
  ): Promise<CaregiverBookingResponse[]> {
    return this.caregiverBookings.list(user.id, query);
  }

  @Get('bookings/:bookingId')
  @ApiOperation({
    summary: 'Ver una reserva como cuidador',
    description:
      'RN-RES-11: las mascotas con su ficha para esas fechas, celo y Especial, el servicio, los tramos, el distrito y lo que va a ganar.',
  })
  @ApiOkResponse({ type: CaregiverBookingResponse })
  @ApiNotFoundResponse({
    type: ErrorResponse,
    description: '`BOOKING_NOT_FOUND`: no existe o es de otro cuidador.',
  })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) id: string,
  ): Promise<CaregiverBookingResponse> {
    return this.caregiverBookings.get(user.id, id);
  }

  @Get('earnings')
  @ApiOperation({
    summary: 'Mis ganancias',
    description:
      'RN-PAG-10: por cobrar, pagado y el total del mes en curso, hora de El Salvador. Pagado es 0 hasta que existan los pagos al cuidador.',
  })
  @ApiOkResponse({ type: CaregiverEarningsResponse })
  @ApiNotFoundResponse(NO_PROFILE)
  earnings(@CurrentUser() user: AuthenticatedUser): Promise<CaregiverEarningsResponse> {
    return this.caregiverBookings.earnings(user.id);
  }
}
