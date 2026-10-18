import { Global, Module } from '@nestjs/common';
import { Clock } from './clock.js';

/** One Clock for the whole API, which tests replace to control deadlines. */
@Global()
@Module({ providers: [Clock], exports: [Clock] })
export class ClockModule {}
