import type { Band, DrinkModifiers, ShiftTemplate } from '../content/index.ts';
import { isOpen, type OpeningHours } from './clock.ts';
import { nextRandom, randomInt } from './rng.ts';
import type { GameState, JobId, ShiftOrder } from './state.ts';
import { gainLifeSkillXp, lifeSkillLevel } from './lifeSkills.ts';
import { clampMeter } from './meters.ts';
import { moodModifier } from './mood.ts';
import { lineKey } from './tray.ts';
import { ECONOMY, LIFE_SKILLS, MOOD, PROFICIENCY_STEP_TABLE, STEP_BANDS, type ProficiencyStep } from './tuning.ts';

/** Why E at the staff door can't start a Shift now. */
export type ShiftRefusal = 'notHired' | 'closed' | 'workedToday' | 'underway';

/**
 * Why a Shift at this Job can't start now, or null if it can: the Character must have the Job,
 * the place must be open (`hours` are its hours), and there's at most one Shift a day.
 */
export function shiftRefusal(state: GameState, jobId: JobId, hours: OpeningHours): ShiftRefusal | null {
  if (state.possessions.shift) return 'underway';
  if (!state.possessions.jobsHired.includes(jobId)) return 'notHired';
  if (state.progression.lastShiftDay === state.clock.day) return 'workedToday';
  if (!isOpen(hours, state.clock)) return 'closed';
  return null;
}

/** E at the staff door: a Shift starts, with a number of Shift Customers to come drawn from the RNG. Nothing changes if it can't start now. */
export function startShift(state: GameState, jobId: JobId, hours: OpeningHours): GameState {
  if (shiftRefusal(state, jobId, hours)) return state;
  const { min, max } = ECONOMY.shiftCustomers;
  const customers = randomInt(state.rngState, min, max);
  return {
    ...state,
    rngState: customers.rngState,
    progression: { ...state.progression, lastShiftDay: state.clock.day },
    possessions: { ...state.possessions, shift: { jobId, customers: customers.value, served: 0, failed: 0, translated: 0, customer: null } },
  };
}

/** The most a voice seed can be: the gateway picks a voice from it, however many it has. */
const VOICE_SEEDS = 2 ** 16;

/** The Shift Customer bands, easiest first. */
const BANDS: readonly Band[] = ['B', 'I', 'A'];

/** One of `options`, drawn from the RNG. */
function pick<T>(rngState: number, options: readonly T[]): { value: T; rngState: number } {
  const draw = randomInt(rngState, 0, options.length - 1);
  return { value: options[draw.value]!, rngState: draw.rngState };
}

/**
 * The template the next Shift Customer comes from: the Player's own band (by the current step), the one below or the
 * one above, in the tuned shares. A band the Job lacks falls back to the nearest one it has, the easier on a tie.
 */
function drawTemplate(rngState: number, step: ProficiencyStep, templates: readonly ShiftTemplate[]) {
  const { ownBand, bandBelow, bandAbove } = ECONOMY.shiftCustomerMix;
  const roll = nextRandom(rngState);
  const share = roll.value * (bandBelow + ownBand + bandAbove);
  const own = BANDS.indexOf(STEP_BANDS[step]);
  const wanted = share < bandBelow ? own - 1 : share < bandBelow + ownBand ? own : own + 1;
  // The nearest band the Job has, and of two as near, the easier.
  const bandsHad = [...new Set(templates.map((template) => BANDS.indexOf(template.band)))];
  const nearestFirst = bandsHad.sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || a - b);
  return pick(roll.rngState, templates.filter((template) => BANDS.indexOf(template.band) === nearestFirst[0]));
}

/** One drink from the template: alone, or made in one of its sizes, hot or iced, with one of the extras that drink takes. */
function drawOrder(rngState: number, { drinks, modifiers }: ShiftTemplate): { value: ShiftOrder; rngState: number } {
  const drink = pick(rngState, drinks);
  if (!modifiers) return { value: [{ itemId: drink.value, quantity: 1 }], rngState: drink.rngState };
  const size = pick(drink.rngState, modifiers.sizes);
  const temperature = pick(size.rngState, modifiers.temperatures);
  const taken = modifiers.extras[drink.value] ?? [];
  const extra = taken.length > 0 ? pick(temperature.rngState, taken) : null;
  const made: DrinkModifiers = { size: size.value, temperature: temperature.value, extras: extra ? [extra.value] : [] };
  return { value: [{ itemId: drink.value, quantity: 1, modifiers: made }], rngState: extra?.rngState ?? temperature.rngState };
}

/** What a customer who changes their mind wants instead: another drawn order, never the same as the first. */
function drawChangeOfMind(rngState: number, template: ShiftTemplate, first: ShiftOrder) {
  const then = drawOrder(rngState, template);
  if (!sameOrder(then.value, first)) return then;
  // The same again: they want it the other temperature instead.
  const flipped = then.value.map((line) =>
    line.modifiers ? { ...line, modifiers: { ...line.modifiers, temperature: line.modifiers.temperature === 'hot' ? 'iced' : 'hot' } } : line,
  ) as ShiftOrder;
  return { value: flipped, rngState: then.rngState };
}

/**
 * The next Shift Customer walks up to the counter, drawn from the Job's `templates` by the customer mix: their order,
 * any change of mind and their voice all come from the seeded RNG. Nothing changes with no Shift under way or no templates.
 */
export function nextShiftCustomer(state: GameState, templates: readonly ShiftTemplate[]): GameState {
  const { shift } = state.possessions;
  if (!shift || templates.length === 0) return state;
  const template = drawTemplate(state.rngState, state.proficiencyStep, templates);
  const first = drawOrder(template.rngState, template.value);
  const changed = template.value.changesMind ? drawChangeOfMind(first.rngState, template.value, first.value) : null;
  const voice = randomInt(changed?.rngState ?? first.rngState, 0, VOICE_SEEDS - 1);
  const customer = {
    templateId: template.value.id,
    order: changed?.value ?? first.value,
    changedFrom: changed ? first.value : null,
    voiceSeed: voice.value,
  };
  return { ...state, rngState: voice.rngState, possessions: { ...state.possessions, shift: { ...shift, customer } } };
}

/**
 * What was served is exactly what was ordered: the same items in the same numbers, whatever order the lines are in.
 * A drink ordered made a certain way (size, hot or iced, extras) must be made just so; one ordered alone may be made any way.
 */
function sameOrder(served: ShiftOrder, order: ShiftOrder): boolean {
  const withModifiers = order.some((line) => line.modifiers);
  const counts = (lines: ShiftOrder) => {
    const totals = new Map<string, number>();
    for (const line of lines) totals.set(lineKey(line, withModifiers), (totals.get(lineKey(line, withModifiers)) ?? 0) + line.quantity);
    return totals;
  };
  const [servedCounts, orderCounts] = [counts(served), counts(order)];
  return servedCounts.size === orderCounts.size && [...servedCounts].every(([key, quantity]) => orderCounts.get(key) === quantity);
}

/**
 * The customer at the counter is done with: `served` is what the Player handed over, checked exactly
 * against the hidden order with no model judgement, or null if they gave up unserved (out of Patience).
 * `translated`: the Player had translated their lines first. Each customer served correctly earns XP in the Job's Life Skill.
 */
export function applyShiftCustomer(
  state: GameState,
  served: ShiftOrder | null,
  { translated = false } = {},
): { state: GameState; correct: boolean } {
  const { shift } = state.possessions;
  if (!shift?.customer) return { state, correct: false };
  const correct = served !== null && sameOrder(served, shift.customer.order);
  const after = {
    ...shift,
    served: shift.served + (correct ? 1 : 0),
    failed: shift.failed + (correct ? 0 : 1),
    translated: shift.translated + (correct && translated ? 1 : 0),
    customer: null,
  };
  const dealtWith = { ...state, possessions: { ...state.possessions, shift: after } };
  return { state: correct ? gainLifeSkillXp(dealtWith, shift.jobId, LIFE_SKILLS.xpPerShiftCustomer) : dealtWith, correct };
}

/**
 * The Shift is over and paid: base × share of customers served × Mood modifier × the Job's Life Skill raise × the
 * stake multiplier for the highest step reached, minus the step's dock (a share of base pay) per failed customer
 * and a share of it per customer served after translating their lines, never below 0. Once paid, a Shift that makes
 * the days worked in the last week overwork costs Mood.
 */
export function endShift(state: GameState): { state: GameState; payInShifts: number } {
  const { shift } = state.possessions;
  if (!shift) return { state, payInShifts: 0 };
  const base = ECONOMY.shiftBasePayInShifts;
  const { stakeMultiplier, failedCustomerDock } = PROFICIENCY_STEP_TABLE[state.progression.highestStep];
  const raise = 1 + ECONOMY.jobLifeSkillPayRaisePerLevel * lifeSkillLevel(state.progression.lifeSkillXp[shift.jobId]);
  const earned = base * (shift.served / shift.customers) * moodModifier(state.character.mood) * raise * stakeMultiplier;
  const docked = shift.failed + shift.translated * ECONOMY.translatedCustomerDockShare;
  const payInShifts = Math.max(0, earned - docked * failedCustomerDock * base);
  const { day } = state.clock;
  const weekFrom = day - MOOD.overworkWeekDays + 1;
  const shiftDays = [...state.progression.shiftDays.filter((worked) => worked >= weekFrom && worked !== day), day];
  const overwork = shiftDays.length >= MOOD.overworkDaysPerWeek ? MOOD.overworkPenaltyPerShift : 0;
  return {
    state: {
      ...state,
      character: {
        ...state.character,
        moneyInShifts: state.character.moneyInShifts + payInShifts,
        mood: clampMeter(state.character.mood + overwork),
      },
      progression: { ...state.progression, shiftDays },
      possessions: { ...state.possessions, shift: null },
    },
    payInShifts,
  };
}

/**
 * The Shift can't go on through no fault of the Player's (no voice service at all). Before any customer has been
 * dealt with, it's as if it never started, so the day's Shift can still be worked; after, it ends and pays as usual.
 */
export function cancelShift(state: GameState): GameState {
  const { shift } = state.possessions;
  if (!shift || shift.served + shift.failed > 0) return endShift(state).state;
  return {
    ...state,
    progression: { ...state.progression, lastShiftDay: null },
    possessions: { ...state.possessions, shift: null },
  };
}
