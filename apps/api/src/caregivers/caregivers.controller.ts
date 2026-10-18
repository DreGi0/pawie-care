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
  CaregiverProfileResponse,
  CaregiverSearchResponse,
  SearchCaregiversRequest,
} from './caregivers.dto.js';
import { CaregiversService } from './caregivers.service.js';

@ApiTags('caregivers')
@ApiBearerAuth()
@Controller('caregivers')
export class CaregiversController {
  constructor(private readonly caregivers: CaregiversService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Buscar cuidadores',
    description:
      'RN-RES-01. Va por POST porque lleva las mascotas y los horarios; no cambia nada. Devuelve el nivel de la reserva, los tramos y los cuidadores disponibles.',
  })
  @ApiOkResponse({ type: CaregiverSearchResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '`PET_NOT_FOUND`.' })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description:
      '`TOO_MANY_PETS` (RN-RES-03), `INVALID_SCHEDULE`, `TOO_SOON` (RN-RES-05), `PET_NOT_BOOKABLE` (RN-MAS-09, con las mascotas y tareas en `details`) o `UNKNOWN_DISTRICT`.',
  })
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SearchCaregiversRequest,
  ): Promise<CaregiverSearchResponse> {
    return this.caregivers.search(user.id, body);
  }

  @Get(':caregiverId')
  @ApiOperation({ summary: 'Perfil de un cuidador', description: 'RN-RES-02.' })
  @ApiOkResponse({ type: CaregiverProfileResponse })
  @ApiNotFoundResponse({
    type: ErrorResponse,
    description: '`CAREGIVER_NOT_FOUND`: no existe, no está aprobado o no está activo.',
  })
  profile(
    @Param('caregiverId', ParseUUIDPipe) caregiverId: string,
  ): Promise<CaregiverProfileResponse> {
    return this.caregivers.profile(caregiverId);
  }
}
