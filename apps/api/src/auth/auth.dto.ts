import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimmed } from '../common/validation/trimmed.js';
import { UserProfile } from '../users/user-profile.dto.js';
import { normalizeEmail } from '../users/users.service.js';

// Validation messages are in Spanish because the app shows them next to each field.

const asEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizeEmail(value) : value;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export class RegisterRequest {
  @ApiProperty({ example: 'daniela@example.com', description: 'Se guarda en minúsculas.' })
  @Transform(asEmail)
  @IsEmail({}, { message: 'Escribe un correo válido.' })
  @MaxLength(254, { message: 'El correo es demasiado largo.' })
  email: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsString({ message: 'Escribe una contraseña.' })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `La contraseña puede tener hasta ${PASSWORD_MAX_LENGTH} caracteres.`,
  })
  password: string;

  @ApiProperty({ example: 'Daniela' })
  @Transform(trimmed)
  @IsString({ message: 'Escribe tu nombre.' })
  @IsNotEmpty({ message: 'Escribe tu nombre.' })
  @MaxLength(80, { message: 'El nombre puede tener hasta 80 caracteres.' })
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @Transform(trimmed)
  @IsString({ message: 'Escribe tu apellido.' })
  @IsNotEmpty({ message: 'Escribe tu apellido.' })
  @MaxLength(80, { message: 'El apellido puede tener hasta 80 caracteres.' })
  lastName: string;

  @ApiProperty({
    format: 'date',
    example: '1992-05-20',
    description: 'AAAA-MM-DD. Solo pueden registrarse mayores de 18 años (RN-CTA-02).',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Escribe la fecha como AAAA-MM-DD.' })
  @IsISO8601({ strict: true }, { message: 'Esa fecha no existe.' })
  birthDate: string;

  @ApiPropertyOptional({ example: '+503 7000 0000' })
  @Transform(trimmed)
  @IsOptional()
  @IsPhoneNumber('SV', { message: 'Escribe un teléfono válido.' })
  phone?: string;
}

export class LoginRequest {
  @ApiProperty({ example: 'daniela@example.com' })
  @Transform(asEmail)
  @IsEmail({}, { message: 'Escribe un correo válido.' })
  email: string;

  @ApiProperty()
  @IsString({ message: 'Escribe tu contraseña.' })
  @IsNotEmpty({ message: 'Escribe tu contraseña.' })
  // Caps the work of hashing what an attacker sends.
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `La contraseña puede tener hasta ${PASSWORD_MAX_LENGTH} caracteres.`,
  })
  password: string;
}

export class RefreshTokenRequest {
  @ApiProperty({
    description: 'El refresh token que devolvió el inicio de sesión o el último refresh.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  refreshToken: string;
}

/**
 * Tokens of a session. The mobile app sends `accessToken` as `Authorization: Bearer`
 * and keeps `refreshToken` in the device's secure storage (docs/arquitectura.md §4.4).
 */
export class AuthSession {
  @ApiProperty({ enum: ['Bearer'] })
  tokenType: 'Bearer';

  @ApiProperty({ description: 'JWT de vida corta para el header Authorization.' })
  accessToken: string;

  @ApiProperty({ type: 'integer', example: 900, description: 'Segundos que dura el accessToken.' })
  expiresIn: number;

  @ApiProperty({
    description:
      'POST /v1/auth/refresh lo cambia por uno nuevo, y este deja de servir 30 segundos después. Hay que guardarlo en el almacenamiento seguro del teléfono.',
  })
  refreshToken: string;

  @ApiProperty({ format: 'date-time' })
  refreshTokenExpiresAt: string;

  @ApiProperty({ type: UserProfile })
  user: UserProfile;
}
