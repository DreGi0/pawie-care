import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { minutes, Throttle } from '@nestjs/throttler';
import { ErrorResponse } from '../common/errors/error-response.dto.js';
import { AuthSession, LoginRequest, RefreshTokenRequest, RegisterRequest } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';

@ApiTags('auth')
@Public()
@ApiBadRequestResponse({
  type: ErrorResponse,
  description: '`VALIDATION_FAILED`, con los errores de cada campo en `details`.',
})
@ApiTooManyRequestsResponse({
  type: ErrorResponse,
  description: 'Demasiados intentos desde la misma IP.',
})
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  @ApiOperation({
    summary: 'Crear una cuenta de dueño',
    description: 'Crea la cuenta e inicia sesión.',
  })
  @ApiCreatedResponse({ type: AuthSession })
  @ApiConflictResponse({
    type: ErrorResponse,
    description: '`EMAIL_TAKEN`: ya hay una cuenta con ese correo.',
  })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: '`UNDERAGE`: es menor de 18 años (RN-CTA-02).',
  })
  register(@Body() body: RegisterRequest): Promise<AuthSession> {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: minutes(1) } })
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiOkResponse({ type: AuthSession })
  @ApiUnauthorizedResponse({ type: ErrorResponse, description: '`INVALID_CREDENTIALS`.' })
  login(@Body() body: LoginRequest): Promise<AuthSession> {
    return this.auth.login(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: minutes(1) } })
  @ApiOperation({
    summary: 'Renovar los tokens',
    description: 'Cambia el refresh token por un par nuevo. El anterior deja de servir.',
  })
  @ApiOkResponse({ type: AuthSession })
  @ApiUnauthorizedResponse({
    type: ErrorResponse,
    description:
      '`INVALID_REFRESH_TOKEN`: venció, se cerró la sesión o ya se usó. Hay que iniciar sesión de nuevo.',
  })
  refresh(@Body() body: RefreshTokenRequest): Promise<AuthSession> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cerrar sesión',
    description:
      'Invalida el refresh token y los demás de la misma sesión. No necesita el token de acceso.',
  })
  @ApiNoContentResponse({ description: 'Sesión cerrada, o el token ya no servía.' })
  logout(@Body() body: RefreshTokenRequest): Promise<void> {
    return this.auth.logout(body.refreshToken);
  }
}
