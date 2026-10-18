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
import { AddressRequest, AddressResponse } from './addresses.dto.js';
import { AddressesService } from './addresses.service.js';

const addressId = () => Param('addressId', ParseUUIDPipe);

@ApiTags('addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Mis direcciones' })
  @ApiOkResponse({ type: [AddressResponse] })
  list(@CurrentUser() user: AuthenticatedUser): Promise<AddressResponse[]> {
    return this.addresses.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Agregar una dirección' })
  @ApiCreatedResponse({ type: AddressResponse })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: '`UNKNOWN_DISTRICT`.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AddressRequest,
  ): Promise<AddressResponse> {
    return this.addresses.create(user.id, body);
  }

  @Put(':addressId')
  @ApiOperation({
    summary: 'Editar una dirección',
    description:
      'Reemplaza todos sus datos. Las reservas ya hechas conservan la dirección que tenían (RN-CTA-04).',
  })
  @ApiOkResponse({ type: AddressResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '`ADDRESS_NOT_FOUND`.' })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: '`UNKNOWN_DISTRICT`.' })
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @addressId() id: string,
    @Body() body: AddressRequest,
  ): Promise<AddressResponse> {
    return this.addresses.replace(user.id, id, body);
  }

  @Delete(':addressId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Borrar una dirección',
    description: 'Las reservas ya hechas conservan su copia (RN-CTA-04).',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse, description: '`ADDRESS_NOT_FOUND`.' })
  remove(@CurrentUser() user: AuthenticatedUser, @addressId() id: string): Promise<void> {
    return this.addresses.remove(user.id, id);
  }
}
