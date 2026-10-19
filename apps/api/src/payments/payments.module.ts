import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { PaymentWebhooks } from './payment-webhooks.js';
import { PaymentsController } from './payments.controller.js';
import { PAYMENTS_QUEUE, PaymentsProcessor } from './payments.processor.js';
import { PaymentsService } from './payments.service.js';
import { WompiClient } from './wompi.client.js';
import { wompiSettingsProvider } from './wompi-settings.js';

/** RN-PAG: paying bookings with Wompi (docs/arquitectura.md §6). */
@Module({
  imports: [BookingsModule, BullModule.registerQueue({ name: PAYMENTS_QUEUE })],
  controllers: [PaymentsController],
  providers: [
    wompiSettingsProvider,
    WompiClient,
    PaymentsService,
    PaymentWebhooks,
    PaymentsProcessor,
  ],
})
export class PaymentsModule {}
