import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module.js';
import { CaregiversModule } from '../caregivers/caregivers.module.js';
import { Clock } from '../common/time/clock.js';
import { FilesModule } from '../files/files.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { BookingStateMachine } from './booking-state-machine.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

/** RN-RES: booking requests, their statuses and deadlines. */
@Module({
  imports: [SettingsModule, FilesModule, AddressesModule, CaregiversModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingStateMachine, Clock],
})
export class BookingsModule {}
