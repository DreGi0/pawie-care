import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module.js';
import { CaregiversModule } from '../caregivers/caregivers.module.js';
import { PetsModule } from '../pets/pets.module.js';
import { FilesModule } from '../files/files.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { BOOKING_DEADLINES_QUEUE, BookingDeadlines } from './booking-deadlines.js';
import { BookingDeadlinesProcessor } from './booking-deadlines.processor.js';
import { BookingStateMachine } from './booking-state-machine.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { CaregiverBookingsController } from './caregiver-bookings.controller.js';
import { CaregiverBookingsService } from './caregiver-bookings.service.js';

/** RN-RES: booking requests, their statuses and deadlines, and the caregiver's side (RN-RES-11, RN-PAG-10). */
@Module({
  imports: [
    SettingsModule,
    FilesModule,
    AddressesModule,
    CaregiversModule,
    PetsModule,
    BullModule.registerQueue({ name: BOOKING_DEADLINES_QUEUE }),
  ],
  controllers: [BookingsController, CaregiverBookingsController],
  providers: [
    BookingsService,
    CaregiverBookingsService,
    BookingStateMachine,
    BookingDeadlines,
    BookingDeadlinesProcessor,
  ],
  // Payments confirm bookings through the state machine (RN-PAG-02).
  exports: [BookingStateMachine],
})
export class BookingsModule {}
