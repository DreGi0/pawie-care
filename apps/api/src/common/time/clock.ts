import { Injectable } from '@nestjs/common';

/**
 * The current time, injected where deadlines depend on it (RN-RES-06, RN-RES-07), so
 * tests can move it instead of waiting.
 */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
