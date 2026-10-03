import { describe, expect, it } from 'vitest';
import { clampMeter, METER_MAX } from './index.ts';

describe('clampMeter', () => {
  it('keeps a meter between 0 and METER_MAX', () => {
    expect(clampMeter(-5)).toBe(0);
    expect(clampMeter(METER_MAX + 1)).toBe(METER_MAX);
    expect(clampMeter(METER_MAX / 2)).toBe(METER_MAX / 2);
  });
});
