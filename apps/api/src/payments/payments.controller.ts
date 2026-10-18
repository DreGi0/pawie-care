import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ErrorResponse } from '../common/errors/error-response.dto.js';
import { BookingPayment } from './payments.dto.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('bookings/:bookingId/payments')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Pagar una reserva',
    description:
      'RN-PAG-02: crea el enlace de pago de Wompi por el total de la reserva, que la app abre con expo-web-browser. Solo el dueño, mientras la reserva está PENDING_PAYMENT y antes de `paymentDueAt` (RN-RES-07). Si ya hay un enlace pendiente, devuelve el mismo: acepta un solo pago y vence con el plazo. La reserva se confirma cuando llega el aviso de Wompi, no cuando el dueño vuelve a la app.',
  })
  @ApiOkResponse({ type: BookingPayment })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '`BOOKING_NOT_FOUND`.' })
  @ApiConflictResponse({
    type: ErrorResponse,
    description:
      '`BOOKING_NOT_PAYABLE`: la reserva no espera un pago (todavía está solicitada, o ya está pagada, vencida o cancelada) o venció el plazo. `details.status` trae su estado.',
  })
  @ApiBadGatewayResponse({
    type: ErrorResponse,
    description: '`PAYMENT_GATEWAY_ERROR`: Wompi no respondió o rechazó el enlace.',
  })
  @ApiServiceUnavailableResponse({
    type: ErrorResponse,
    description: '`PAYMENTS_UNAVAILABLE`: la API no tiene configurado Wompi.',
  })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<BookingPayment> {
    return this.payments.start(user.id, bookingId);
  }
}
