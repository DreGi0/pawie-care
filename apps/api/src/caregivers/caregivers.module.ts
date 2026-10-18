import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { PetsModule } from '../pets/pets.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { CaregiversController } from './caregivers.controller.js';
import { CaregiversService } from './caregivers.service.js';

/** RN-CUI, RN-RES-01, RN-RES-02: caregiver profiles and search. */
@Module({
  imports: [SettingsModule, FilesModule, PetsModule],
  controllers: [CaregiversController],
  providers: [CaregiversService],
})
export class CaregiversModule {}
