import { Clock } from '../src/common/time/clock.js';

/** A Clock that tests can stop at an instant and move forward. Real time otherwise. */
export class TestClock extends Clock {
  private frozenAt: Date | null = null;

  override now(): Date {
    return new Date(this.frozenAt ?? Date.now());
  }

  /** Stops the clock at that instant. */
  set(instant: Date): void {
    this.frozenAt = new Date(instant);
  }

  /** Moves the stopped clock forward. */
  advance(ms: number): void {
    this.set(new Date(this.now().getTime() + ms));
  }

  /** Back to real time. */
  reset(): void {
    this.frozenAt = null;
  }
}
