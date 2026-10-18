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
