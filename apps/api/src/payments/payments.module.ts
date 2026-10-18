import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { WompiClient } from './wompi.client.js';
import { wompiSettingsProvider } from './wompi-settings.js';

/** RN-PAG: paying bookings with Wompi (docs/arquitectura.md §6). */
@Module({
  controllers: [PaymentsController],
  providers: [wompiSettingsProvider, WompiClient, PaymentsService],
})
export class PaymentsModule {}
