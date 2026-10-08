import { describe, expect, it } from 'vitest';
import { placeHours, TRAM_LINE, type TramStopId } from '../content/index.ts';
import { createSave, TRAM, type GameState, type OpeningHours } from '../sim/index.ts';
import {
  createGameStore,
  DEV_SETUP,
  selectClockMinute,
  selectInteractable,
  selectMoneyInShifts,
  selectPlaceId,
  selectToast,
  selectTramArrival,
  selectTramChoosing,
  selectTramDestinations,
  selectTramRunning,
  selectTramStop,
} from './index.ts';

const HOUR = 60;
const MONDAY = 1;
const TRAMS = placeHours('tram-stop', DEV_SETUP.culturePackId) as Exclude<OpeningHours, null>;
const SUPERMARKET = placeHours('supermarket', DEV_SETUP.culturePackId) as Exclude<OpeningHours, null>;
const [WEST, CENTRAL, EAST] = TRAM_LINE as readonly TramStopId[];

/** A game at `minuteOfDay` on Monday, the Character standing wherever `placeId` says. */
function playingAt(minuteOfDay: number, placeId: GameState['placeId'] = 'home') {
  return createGameStore({ ...createSave(DEV_SETUP), placeId, clock: { day: MONDAY, minuteOfDay } });
}

describe('walking around town', () => {
  it('can always walk onto a tram stop or into the park, even when no tram runs', () => {
    const store = playingAt(3 * HOUR);
    store.getState().enterPlace('tram-stop');
    expect(selectPlaceId(store.getState())).toBe('tram-stop');
    store.getState().enterPlace('park');
    expect(selectPlaceId(store.getState())).toBe('park');
  });

  it('offers Press E for the staff while their place is open, and not once it closes', () => {
    const open = playingAt(SUPERMARKET.opensAt, 'supermarket');
    open.getState().setInteractable('cashier');
    expect(selectInteractable(open.getState())).toBe('cashier');

    const closed = playingAt(SUPERMARKET.closesAt, 'supermarket');
    closed.getState().setInteractable('cashier');
    expect(selectInteractable(closed.getState())).toBeNull();
  });

  it('only offers the landlord in their own hours, though home is always open', () => {
    const store = playingAt(7 * HOUR);
    store.getState().setInteractable('landlord');
    expect(selectInteractable(store.getState())).toBeNull();
  });

  it('chats with staff who have nothing else to talk about', () => {
    const store = playingAt(9 * HOUR, 'clinic');
    store.getState().setInteractable('pharmacist');
    store.getState().talk();
    expect(selectToast(store.getState())).toBeNull();
    expect(store.getState().conversation).toMatchObject({ npcId: 'pharmacist', interaction: null });
  });
});

describe('taking the tram', () => {
  function atStop(stopId: TramStopId, minuteOfDay = 9 * HOUR) {
    const store = playingAt(minuteOfDay, 'tram-stop');
    store.getState().setInteractable(stopId);
    return store;
  }

  it('offers the other stops on the line, with each trip’s time', () => {
    const store = atStop(WEST!);
    expect(selectTramStop(store.getState())).toBe(WEST);
    expect(selectTramRunning(store.getState())).toBe(true);
    expect(selectTramChoosing(store.getState())).toBe(false);

    store.getState().openTram();
    expect(selectTramChoosing(store.getState())).toBe(true);
    expect(selectTramDestinations(WEST!)).toEqual([
      { stopId: CENTRAL, minutes: TRAM.minutesPerStop },
      { stopId: EAST, minutes: 2 * TRAM.minutesPerStop },
    ]);
  });

  it('rides to the chosen stop for free: time passes, and the world is told where to put the Character', () => {
    const store = atStop(WEST!);
    const money = selectMoneyInShifts(store.getState());
    store.getState().openTram();
    store.getState().rideTram(EAST!);

    expect(selectClockMinute(store.getState())).toBe(9 * HOUR + 2 * TRAM.minutesPerStop);
    expect(selectMoneyInShifts(store.getState())).toBe(money);
    expect(selectPlaceId(store.getState())).toBe('tram-stop');
    expect(selectTramArrival(store.getState())).toMatchObject({ stopId: EAST });
    expect(selectTramStop(store.getState())).toBeNull();
    expect(selectTramChoosing(store.getState())).toBe(false);
  });

  it('says no tram is running outside the trams’ hours, and goes nowhere', () => {
    const store = atStop(CENTRAL!, TRAMS.closesAt - 24 * HOUR + HOUR);
    expect(selectTramStop(store.getState())).toBe(CENTRAL);
    expect(selectTramRunning(store.getState())).toBe(false);

    store.getState().openTram();
    expect(selectTramChoosing(store.getState())).toBe(false);
    store.getState().rideTram(EAST!);
    expect(selectTramArrival(store.getState())).toBeNull();
  });

  it('closes the choice without riding', () => {
    const store = atStop(WEST!);
    store.getState().openTram();
    store.getState().closeTram();
    expect(selectTramChoosing(store.getState())).toBe(false);
    expect(selectClockMinute(store.getState())).toBe(9 * HOUR);
  });
});
