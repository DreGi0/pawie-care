import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { PetsController } from './pets.controller.js';
import { PetsService } from './pets.service.js';

/** RN-MAS: pets, their vaccinations, vet instructions and care needs. */
@Module({
  imports: [FilesModule],
  controllers: [PetsController],
  providers: [PetsService],
  exports: [PetsService],
})
export class PetsModule {}
