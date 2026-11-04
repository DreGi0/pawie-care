import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { PetsModule } from '../pets/pets.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { CaregiverMeController } from './caregiver-me.controller.js';
import { CaregiverMeService } from './caregiver-me.service.js';
import { CaregiversController } from './caregivers.controller.js';
import { CaregiversService } from './caregivers.service.js';

/**
 * RN-CUI, RN-RES-01, RN-RES-02: caregiver profiles and search, and the caregiver's own
 * profile. CaregiverMeController goes first, so `caregivers/me` isn't read as an id.
 */
@Module({
  imports: [SettingsModule, FilesModule, PetsModule],
  controllers: [CaregiverMeController, CaregiversController],
  providers: [CaregiversService, CaregiverMeService],
  exports: [CaregiversService],
})
export class CaregiversModule {}
