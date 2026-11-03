import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
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
import {
  CaregiverLevelResponse,
  CaregiverMeResponse,
  CaregiverPricesResponse,
  PriceQuoteRequest,
  PriceQuoteResponse,
  UpdateCaregiverMeRequest,
} from './caregiver-me.dto.js';
import { CaregiverMeService } from './caregiver-me.service.js';

const NO_PROFILE = {
  type: ErrorResponse,
  description: '`CAREGIVER_PROFILE_NOT_FOUND`: la cuenta no ha activado el modo cuidador.',
};

/**
 * The caregiver's own profile (RN-CTA-06, RN-CUI-01 to RN-CUI-04, RN-CUI-16 to
 * RN-CUI-20). Registered before CaregiversController, so `me` never reaches its
 * `:caregiverId` route.
 */
@ApiTags('caregivers')
@ApiBearerAuth()
@Controller('caregivers/me')
export class CaregiverMeController {
  constructor(private readonly caregiverMe: CaregiverMeService) {}

  @Post()
  @ApiOperation({
    summary: 'Activar el modo cuidador',
    description:
      'RN-CTA-06. Crea el perfil de cuidador en `PENDING_APPROVAL`, con todos los servicios al precio sugerido (RN-CUI-17), y la cuenta queda en modo cuidador.',
  })
  @ApiCreatedResponse({ type: CaregiverMeResponse })
  @ApiConflictResponse({
    type: ErrorResponse,
    description: '`CAREGIVER_PROFILE_EXISTS`: ya lo activó.',
  })
  create(@CurrentUser() user: AuthenticatedUser): Promise<CaregiverMeResponse> {
    return this.caregiverMe.create(user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Mi perfil de cuidador',
    description:
      'Con los documentos, el curso de bienvenida y lo que le falta para aparecer en búsquedas.',
  })
  @ApiOkResponse({ type: CaregiverMeResponse })
  @ApiNotFoundResponse(NO_PROFILE)
  get(@CurrentUser() user: AuthenticatedUser): Promise<CaregiverMeResponse> {
    return this.caregiverMe.get(user.id);
  }

  @Patch()
  @ApiOperation({
    summary: 'Editar mi perfil de cuidador',
    description:
      'RN-CUI-18. Foto, descripción, habilidades, distritos, horario semanal, precios, Reserva inmediata, pausa (RN-CUI-20) y documentos (RN-CUI-01). Cada campo enviado reemplaza al anterior.',
  })
  @ApiOkResponse({ type: CaregiverMeResponse })
  @ApiNotFoundResponse({
    type: ErrorResponse,
    description: '`CAREGIVER_PROFILE_NOT_FOUND` o `FILE_NOT_FOUND`.',
  })
  @ApiConflictResponse({
    type: ErrorResponse,
    description:
      '`DOCUMENTS_LOCKED`: el alta ya está aprobada. `FILE_NOT_UPLOADED`: el archivo no terminó de subirse.',
  })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description:
      '`PRICE_OUT_OF_RANGE` (RN-CUI-17, con el rango en `details`), `INVALID_AVAILABILITY`, `UNKNOWN_DISTRICT` o `WRONG_FILE_PURPOSE`.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateCaregiverMeRequest,
  ): Promise<CaregiverMeResponse> {
    return this.caregiverMe.update(user.id, body);
  }

  @Get('level')
  @ApiOperation({
    summary: 'Mi nivel',
    description: 'RN-NIV-05: el nivel actual y cada requisito del siguiente, cumplido o no.',
  })
  @ApiOkResponse({ type: CaregiverLevelResponse })
  @ApiNotFoundResponse(NO_PROFILE)
  level(@CurrentUser() user: AuthenticatedUser): Promise<CaregiverLevelResponse> {
    return this.caregiverMe.level(user.id);
  }

  @Get('prices')
  @ApiOperation({
    summary: 'Mis precios',
    description:
      'RN-CUI-17, RN-PRE-01, RN-PRE-04. Por servicio: su precio, lo que recibe con él, el rango y el sugerido de su nivel, y el sugerido del siguiente nivel.',
  })
  @ApiOkResponse({ type: CaregiverPricesResponse })
  @ApiNotFoundResponse(NO_PROFILE)
  prices(@CurrentUser() user: AuthenticatedUser): Promise<CaregiverPricesResponse> {
    return this.caregiverMe.prices(user.id);
  }

  @Post('prices/quote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cuánto recibiría con un precio',
    description:
      'RN-CUI-17, RN-PRE-04. Para la calculadora de precios, mientras el cuidador lo cambia. No guarda nada.',
  })
  @ApiOkResponse({ type: PriceQuoteResponse })
  @ApiNotFoundResponse(NO_PROFILE)
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: '`PRICE_OUT_OF_RANGE`, con el rango de su nivel en `details`.',
  })
  quote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PriceQuoteRequest,
  ): Promise<PriceQuoteResponse> {
    return this.caregiverMe.quote(user.id, body);
  }
}
