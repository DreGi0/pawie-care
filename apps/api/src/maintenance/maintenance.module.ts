import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { MAINTENANCE_QUEUE, MaintenanceProcessor } from './maintenance.processor.js';
import { MaintenanceService } from './maintenance.service.js';

/** Periodic cleanup: expired refresh tokens and abandoned uploads. */
@Module({
  imports: [FilesModule, BullModule.registerQueue({ name: MAINTENANCE_QUEUE })],
  providers: [MaintenanceService, MaintenanceProcessor],
})
export class MaintenanceModule {}
