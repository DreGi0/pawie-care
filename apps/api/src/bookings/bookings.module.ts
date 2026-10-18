import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module.js';
import { CaregiversModule } from '../caregivers/caregivers.module.js';
import { Clock } from '../common/time/clock.js';
import { FilesModule } from '../files/files.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { BOOKING_DEADLINES_QUEUE, BookingDeadlines } from './booking-deadlines.js';
import { BookingDeadlinesProcessor } from './booking-deadlines.processor.js';
import { BookingStateMachine } from './booking-state-machine.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

/** RN-RES: booking requests, their statuses and deadlines. */
@Module({
  imports: [
    SettingsModule,
    FilesModule,
    AddressesModule,
    CaregiversModule,
    BullModule.registerQueue({ name: BOOKING_DEADLINES_QUEUE }),
  ],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    BookingStateMachine,
    BookingDeadlines,
    BookingDeadlinesProcessor,
    Clock,
  ],
})
export class BookingsModule {}
