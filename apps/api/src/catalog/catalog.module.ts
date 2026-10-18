import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

/** RN-MAS-01, RN-SER, RN-CUI-04: species, services and districts. */
@Module({
  imports: [SettingsModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
