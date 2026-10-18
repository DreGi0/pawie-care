import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
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
  CareNeedRequest,
  CareNeedResponse,
  PetDetail,
  PetRequest,
  PetResponse,
  VaccinationRequest,
  VaccinationResponse,
  VetInstructionRequest,
  VetInstructionResponse,
} from './pets.dto.js';
import { PetsService } from './pets.service.js';

const petId = () => Param('petId', ParseUUIDPipe);

@ApiTags('pets')
@ApiBearerAuth()
@ApiNotFoundResponse({
  type: ErrorResponse,
  description: '`PET_NOT_FOUND`: no existe, está archivada o es de otra cuenta.',
})
@ApiUnprocessableEntityResponse({
  type: ErrorResponse,
  description:
    '`INVALID_DATES`, `UNKNOWN_SPECIES`, o un archivo que no sirve (`FILE_NOT_UPLOADED`, `WRONG_FILE_PURPOSE`).',
})
@Controller('pets')
export class PetsController {
  constructor(private readonly pets: PetsService) {}

  @Get()
  @ApiOperation({ summary: 'Mis mascotas', description: 'Sin las archivadas.' })
  @ApiOkResponse({ type: [PetResponse] })
  list(@CurrentUser() user: AuthenticatedUser): Promise<PetResponse[]> {
    return this.pets.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una mascota' })
  @ApiCreatedResponse({ type: PetDetail })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: PetRequest): Promise<PetDetail> {
    return this.pets.create(user.id, body);
  }

  @Get(':petId')
  @ApiOperation({
    summary: 'Ver una mascota',
    description: 'Con sus vacunas, indicaciones del veterinario y tareas de cuidado.',
  })
  @ApiOkResponse({ type: PetDetail })
  get(@CurrentUser() user: AuthenticatedUser, @petId() id: string): Promise<PetDetail> {
    return this.pets.get(user.id, id);
  }

  @Put(':petId')
  @ApiOperation({
    summary: 'Editar una mascota',
    description: 'Reemplaza todos sus datos: un campo opcional que no se manda queda vacío.',
  })
  @ApiOkResponse({ type: PetDetail })
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @petId() id: string,
    @Body() body: PetRequest,
  ): Promise<PetDetail> {
    return this.pets.replace(user.id, id, body);
  }

  @Delete(':petId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Archivar una mascota',
    description: 'Deja de aparecer y no se puede reservar, pero su historial se conserva.',
  })
  @ApiNoContentResponse()
  archive(@CurrentUser() user: AuthenticatedUser, @petId() id: string): Promise<void> {
    return this.pets.archive(user.id, id);
  }

  @Post(':petId/vaccinations')
  @ApiOperation({ summary: 'Agregar una vacuna' })
  @ApiCreatedResponse({ type: VaccinationResponse })
  addVaccination(
    @CurrentUser() user: AuthenticatedUser,
    @petId() id: string,
    @Body() body: VaccinationRequest,
  ): Promise<VaccinationResponse> {
    return this.pets.addVaccination(user.id, id, body);
  }

  @Delete(':petId/vaccinations/:vaccinationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borrar una vacuna' })
  @ApiNoContentResponse()
  removeVaccination(
    @CurrentUser() user: AuthenticatedUser,
    @petId() id: string,
    @Param('vaccinationId', ParseUUIDPipe) vaccinationId: string,
  ): Promise<void> {
    return this.pets.removeVaccination(user.id, id, vaccinationId);
  }

  @Post(':petId/vet-instructions')
  @ApiOperation({
    summary: 'Agregar indicaciones del veterinario',
    description: 'RN-MAS-08: la receta o las instrucciones post-operatorias, ya subidas.',
  })
  @ApiCreatedResponse({ type: VetInstructionResponse })
  addVetInstruction(
    @CurrentUser() user: AuthenticatedUser,
    @petId() id: string,
    @Body() body: VetInstructionRequest,
  ): Promise<VetInstructionResponse> {
    return this.pets.addVetInstruction(user.id, id, body);
  }

  @Delete(':petId/vet-instructions/:vetInstructionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borrar indicaciones del veterinario' })
  @ApiNoContentResponse()
  @ApiConflictResponse({
    type: ErrorResponse,
    description: '`VET_INSTRUCTION_IN_USE`: una tarea de cuidado o una reserva las usa.',
  })
  removeVetInstruction(
    @CurrentUser() user: AuthenticatedUser,
    @petId() id: string,
    @Param('vetInstructionId', ParseUUIDPipe) vetInstructionId: string,
  ): Promise<void> {
    return this.pets.removeVetInstruction(user.id, id, vetInstructionId);
  }

  @Post(':petId/care-needs')
  @ApiOperation({
    summary: 'Agregar una tarea de cuidado',
    description:
      'RN-MAS-06, RN-MAS-08 y RN-MAS-09. Errores: `VET_INSTRUCTIONS_REQUIRED`, `OWNER_INSTRUCTIONS_REQUIRED` o `END_DATE_REQUIRED`.',
  })
  @ApiCreatedResponse({ type: CareNeedResponse })
  addCareNeed(
    @CurrentUser() user: AuthenticatedUser,
    @petId() id: string,
    @Body() body: CareNeedRequest,
  ): Promise<CareNeedResponse> {
    return this.pets.addCareNeed(user.id, id, body);
  }

  @Put(':petId/care-needs/:careNeedId')
  @ApiOperation({
    summary: 'Editar una tarea de cuidado',
    description: 'También sirve para cerrarla, poniéndole fecha de fin.',
  })
  @ApiOkResponse({ type: CareNeedResponse })
  replaceCareNeed(
    @CurrentUser() user: AuthenticatedUser,
    @petId() id: string,
    @Param('careNeedId', ParseUUIDPipe) careNeedId: string,
    @Body() body: CareNeedRequest,
  ): Promise<CareNeedResponse> {
    return this.pets.replaceCareNeed(user.id, id, careNeedId, body);
  }

  @Delete(':petId/care-needs/:careNeedId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borrar una tarea de cuidado' })
  @ApiNoContentResponse()
  removeCareNeed(
    @CurrentUser() user: AuthenticatedUser,
    @petId() id: string,
    @Param('careNeedId', ParseUUIDPipe) careNeedId: string,
  ): Promise<void> {
    return this.pets.removeCareNeed(user.id, id, careNeedId);
  }
}
