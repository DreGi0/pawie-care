import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums.js';

/** The signed-in user's own account. */
export class UserProfile {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'daniela@example.com' })
  email: string;

  @ApiProperty({ example: 'Daniela' })
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  lastName: string;

  @ApiProperty({ format: 'date', example: '1992-05-20' })
  birthDate: string;

  @ApiProperty({ type: String, nullable: true, example: '+503 7000 0000' })
  phone: string | null;

  @ApiProperty({
    description: 'RN-CTA-01: una cuenta puede ser dueño y cuidador a la vez.',
    enum: Role,
    enumName: 'Role',
    isArray: true,
  })
  roles: Role[];
}

/** `GET /v1/users/me`: the account plus what depends on the owner's history. */
export class MeResponse extends UserProfile {
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'RN-PRE-09: hasta cuándo el dueño puede crear su primer servicio sin tarifa. Null si ya no aplica: venció el plazo, ya pagó una reserva o una reserva activa tiene el beneficio.',
  })
  firstServiceFeeWaiverEndsAt: string | null;
}
