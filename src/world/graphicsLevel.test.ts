import { describe, expect, it } from 'vitest';
import { afterWindow, GRAPHICS_LEVELS, GRAPHICS_TUNING, START, type GraphicsLevel } from './graphicsLevel.ts';

const { slowBelowFps } = GRAPHICS_TUNING;
const fast = slowBelowFps + 15;
const slow = slowBelowFps - 15;
/** The level after windows of frames at these rates, one after another, from the start. */
const after = (...windows: number[]): GraphicsLevel => windows.reduce(afterWindow, START);

describe('the graphics level', () => {
  it('keeps the full look while the frames come fast', () => {
    expect(after(fast, fast, fast)).toMatchObject({ level: 0 });
  });

  it('tries the next cheaper level once the frames come slow, window after window', () => {
    expect(after(slow, slow)).toMatchObject({ level: 1 });
  });

  it('sits out a single slow window, such as one while the town loads', () => {
    expect(after(slow)).toMatchObject({ level: 0 });
    expect(after(slow, fast, slow)).toMatchObject({ level: 0 });
  });

  it('keeps a cheaper level that made the frames come faster, and goes on down while they are still slow', () => {
    expect(after(20, 20, 30)).toMatchObject({ level: 1 });
    expect(after(20, 20, 30, 30)).toMatchObject({ level: 1 });
    expect(after(20, 20, 30, 30, 30)).toMatchObject({ level: 2 });
  });

  it('measures a cheaper level against the faster of the slow windows before it', () => {
    expect(after(20, 30, 32)).toMatchObject({ level: 0 });
  });

  it('goes back, and stops trying, when a cheaper level does not make the frames come faster', () => {
    const back = after(40, 40, 41);
    expect(back).toMatchObject({ level: 0 });
    expect([30, 30, 30].reduce(afterWindow, back)).toMatchObject({ level: 0 });
  });

  it('never goes below the cheapest level', () => {
    const cheapest = GRAPHICS_LEVELS.length - 1;
    expect(after(5, 5, 8, 8, 8, 13).level).toBe(cheapest);
    expect(after(5, 5, 8, 8, 8, 13, 13, 13, 13, 13).level).toBe(cheapest);
  });
});
