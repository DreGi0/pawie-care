import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogResponse } from './catalog.dto.js';
import { CatalogService } from './catalog.service.js';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({
    summary: 'Catálogo',
    description: 'Distritos, especies, servicios y los límites para armar una reserva.',
  })
  @ApiOkResponse({ type: CatalogResponse })
  get(): Promise<CatalogResponse> {
    return this.catalog.catalog();
  }
}
