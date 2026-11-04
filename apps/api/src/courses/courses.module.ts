import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';

/** RN-CUI-02: the welcome course, its exam and the attempts. */
@Module({
  imports: [SettingsModule],
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
