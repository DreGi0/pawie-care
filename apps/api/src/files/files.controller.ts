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
import { CreateUploadRequest, FileResponse, FileUpload } from './files.dto.js';
import { FilesService } from './files.service.js';

@ApiTags('files')
@ApiBearerAuth()
@ApiNotFoundResponse({
  type: ErrorResponse,
  description: '`FILE_NOT_FOUND`: no existe o es de otra cuenta.',
})
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @ApiOperation({
    summary: 'Pedir una subida',
    description:
      'Devuelve una URL firmada para subir el archivo con PUT, directo al almacenamiento. Después hay que llamar a `complete`.',
  })
  @ApiCreatedResponse({ type: FileUpload })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: '`UNSUPPORTED_FILE_TYPE` o `FILE_TOO_LARGE`.',
  })
  createUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateUploadRequest,
  ): Promise<FileUpload> {
    return this.files.createUpload(user.id, body);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar una subida', description: 'Se llama después del PUT.' })
  @ApiOkResponse({ type: FileResponse })
  @ApiConflictResponse({
    type: ErrorResponse,
    description: '`FILE_NOT_UPLOADED`: el PUT no llegó.',
  })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FileResponse> {
    return this.files.complete(user.id, id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Ver un archivo',
    description: 'Sirve para pedir otra URL de descarga cuando la anterior venció.',
  })
  @ApiOkResponse({ type: FileResponse })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FileResponse> {
    return this.files.get(user.id, id);
  }
}
