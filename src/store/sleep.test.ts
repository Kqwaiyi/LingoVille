import 'fake-indexeddb/auto';
import { createStore } from 'idb-keyval';
import { describe, expect, it, vi } from 'vitest';
import { CLOCK, createSave, gameMinutesFor, MOOD, type GameState } from '../sim/index.ts';
import { createGameStore, createSaves, DEV_SETUP, selectDay, selectMoodFace, selectSavedCount, selectToast } from './index.ts';
import { recordingSaves } from './testSaves.ts';

const HOUR = 60;

let databases = 0;

/** The Character at home at `minuteOfDay` on day 1, saving into a fresh IndexedDB database. */
function atHome(minuteOfDay: number, character: Partial<GameState['character']> = {}) {
  const saves = createSaves(() => createStore(`sleep-test-${++databases}`, 'saves'));
  const game = createSave(DEV_SETUP);
  const store = createGameStore(
    { ...game, clock: { day: 1, minuteOfDay }, character: { ...game.character, ...character } },
    { saves },
  );
  return { store, saves };
}

describe('going to bed', () => {
  it('wakes at 07:00 the next morning, saved, with the start-of-day backup rotated to the new day', async () => {
    const { store, saves } = atHome(22 * HOUR);
    store.getState().saveNow();
    await vi.waitFor(() => expect(selectSavedCount(store.getState())).toBe(1));
    expect((await saves.backups('slot-1')).find((b) => b.name === 'start-of-day')?.day).toBe(1);

    store.getState().sleep();

    expect(selectDay(store.getState())).toBe(2);
    expect(store.getState().game.clock.minuteOfDay).toBe(CLOCK.wakeAt);
    await vi.waitFor(() => expect(selectSavedCount(store.getState())).toBe(2));
    expect((await saves.load('slot-1'))?.save.game.clock).toEqual({ day: 2, minuteOfDay: CLOCK.wakeAt });
    expect((await saves.backups('slot-1')).find((b) => b.name === 'start-of-day')?.day).toBe(2);
  });

  it('rotates the start-of-day backup to the morning after a bedtime past midnight', async () => {
    const { store, saves } = atHome(23 * HOUR + 59);
    store.getState().saveNow();
    await vi.waitFor(() => expect(selectSavedCount(store.getState())).toBe(1));
    // Past midnight: the new day number has its own save.
    for (let minutes = 0; minutes < HOUR; minutes += gameMinutesFor(CLOCK.maxRealDeltaMs, CLOCK.timeScale.normal)) {
      store.getState().advance(CLOCK.maxRealDeltaMs);
    }
    await vi.waitFor(() => expect(selectSavedCount(store.getState())).toBe(2));

    store.getState().sleep();

    expect(store.getState().game.clock).toEqual({ day: 2, minuteOfDay: CLOCK.wakeAt });
    await vi.waitFor(() => expect(selectSavedCount(store.getState())).toBe(3));
    expect((await saves.raw('slot-1')).backups['start-of-day']).toMatchObject({ game: { clock: { day: 2, minuteOfDay: CLOCK.wakeAt } } });
  });

  it('says it is too early before 20:00, and nothing else happens', () => {
    const { saves, written } = recordingSaves();
    const store = createGameStore({ ...createSave(DEV_SETUP), clock: { day: 1, minuteOfDay: 15 * HOUR } }, { saves });
    const before = store.getState().game;

    store.getState().sleep();

    expect(store.getState().game).toBe(before);
    expect(selectToast(store.getState())).toEqual({ kind: 'tooEarlyForBed' });
    expect(written).toHaveLength(0);
  });
});

describe('the Mood face', () => {
  it('follows Mood', () => {
    expect(selectMoodFace(atHome(9 * HOUR, { mood: MOOD.neutral }).store.getState())).toBe('okay');
    expect(selectMoodFace(atHome(9 * HOUR, { mood: 0 }).store.getState())).toBe('miserable');
  });

  it('falls as the Character stays up late', () => {
    const { store } = atHome(CLOCK.lateNightFrom, { mood: MOOD.faceFrom.okay + 1 });
    for (let minutes = 0; minutes < 4 * HOUR; minutes += gameMinutesFor(CLOCK.maxRealDeltaMs, CLOCK.timeScale.normal)) {
      store.getState().advance(CLOCK.maxRealDeltaMs);
    }
    expect(selectMoodFace(store.getState())).not.toBe('okay');
  });
});
