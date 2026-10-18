import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../generated/prisma/enums.js';

/** A payment attempt of a booking (RN-PAG). */
export class BookingPayment {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    enum: PaymentStatus,
    enumName: 'PaymentStatus',
    description:
      '`PENDING`: el enlace espera el pago, o el aviso de Wompi de que se pagó. `APPROVED`: pagado; la reserva quedó confirmada. `REFUND_PENDING`: Wompi cobró, pero la reserva no se pudo confirmar (venció y el horario ya se tomó, ya estaba pagada o el dueño la canceló), así que se devuelve desde el panel de Wompi (RN-PAG-05). `REFUNDED`: ya se devolvió.',
  })
  status: PaymentStatus;

  @ApiProperty({
    type: 'integer',
    example: 1870,
    description: 'Lo que se cobra, en centavos: el total de la reserva (RN-PRE-07).',
  })
  amountCents: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://lk.wompi.sv/abcd',
    description:
      'Mientras está `PENDING`: la página de pago de Wompi, que la app abre con expo-web-browser.',
  })
  checkoutUrl: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  approvedAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}
