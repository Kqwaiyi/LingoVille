import { METER_MAX } from './tuning.ts';

/** Health, Hunger, Thirst and Mood never leave the range 0..METER_MAX. */
export function clampMeter(value: number): number {
  return Math.min(METER_MAX, Math.max(0, value));
}
