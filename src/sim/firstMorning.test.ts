import { describe, expect, it } from 'vitest';
import { INTERACTIONS, placeHours } from '../content/index.ts';
import {
  applyInteractionOutcome,
  cook,
  createSave,
  drinkWater,
  enterPlace,
  FIRST_MORNING_STEPS,
  firstMorningStep,
  isFirstMorningCafeOrder,
  isOutOfPatience,
  losePatience,
  newPlayerTurn,
  npcExpression,
  PROFICIENCY_STEP_TABLE,
  skipFirstMorning,
  startPatience,
  type GameState,
} from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const { orderDrink, orderWithOptions, askBaristaForWork, buyCounterFood, getATable, orderAMeal, payForGroceries } = INTERACTIONS;
const firstMorning = () => createSave(TEST_SETUP);
const at = (state: GameState, placeId: GameState['placeId']): GameState => ({ ...state, placeId });
const succeed = (state: GameState, interaction: (typeof INTERACTIONS)[keyof typeof INTERACTIONS], args: unknown) =>
  applyInteractionOutcome(state, interaction, { kind: 'success', args }).state;
const cafeHours = placeHours('cafe', 'ja');

describe('the First Morning', () => {
  it('starts on its first step: drinking something', () => {
    expect(firstMorningStep(firstMorning())).toBe(FIRST_MORNING_STEPS[0]);
    expect(FIRST_MORNING_STEPS).toEqual(['drink', 'walkToCafe', 'breakfast']);
  });

  it('has no step at all when skipped from setup', () => {
    expect(firstMorningStep(createSave({ ...TEST_SETUP, skipFirstMorning: true }))).toBeNull();
  });

  it('goes drink water, then walk to the café, then order breakfast there, and is then over', () => {
    const drunk = drinkWater(firstMorning());
    expect(firstMorningStep(drunk)).toBe('walkToCafe');

    const inTheCafe = enterPlace(drunk, 'cafe', cafeHours);
    expect(firstMorningStep(inTheCafe)).toBe('breakfast');

    const breakfasted = succeed(inTheCafe, orderDrink, { items: [{ item: 'pastry', quantity: 1 }] });
    expect(firstMorningStep(breakfasted)).toBeNull();
    expect(breakfasted.onboarding).toEqual({ firstMorningStepsDone: FIRST_MORNING_STEPS.length, firstMorningSkipped: false });
  });

  it('counts any café order as breakfast, even just a drink', () => {
    const inTheCafe = at(drinkWater(firstMorning()), 'cafe');
    expect(firstMorningStep(succeed(inTheCafe, orderDrink, { items: [{ item: 'tea', quantity: 1 }] }))).toBeNull();
  });

  describe('any equivalent action completes a step', () => {
    it('a drink at the restaurant counts as drinking water', () => {
      const seated = succeed(at(firstMorning(), 'restaurant'), getATable, { party: 1, seating: 'table' });
      expect(firstMorningStep(seated)).toBe('drink');

      expect(firstMorningStep(succeed(seated, orderAMeal, { items: [{ item: 'juice', quantity: 1 }] }))).toBe('walkToCafe');
    });

    it('food eaten anywhere counts as breakfast', () => {
      const bento = succeed(at(firstMorning(), 'convenience-store'), buyCounterFood, { items: [{ item: 'bento', quantity: 1 }] });
      expect(firstMorningStep(bento)).toBeNull();
    });

    it('a meal cooked at home counts as breakfast', () => {
      const state = firstMorning();
      const withEggs: GameState = { ...state, possessions: { ...state.possessions, inventory: [{ itemId: 'eggs', quantity: 1, expiresOnDay: 3 }] } };
      expect(firstMorningStep(cook(withEggs))).toBeNull();
    });

    it('walking into the café before drinking anything goes on to breakfast: the prompts never send the Player back', () => {
      expect(firstMorningStep(enterPlace(firstMorning(), 'cafe', cafeHours))).toBe('breakfast');
    });
  });

  it('counts nothing that fills no meter: groceries are for cooking later', () => {
    const shopped = applyInteractionOutcome(at(firstMorning(), 'supermarket'), payForGroceries, {
      kind: 'success',
      args: { bag: false, card: false },
      basket: [{ itemId: 'eggs', quantity: 1 }],
    }).state;
    expect(firstMorningStep(shopped)).toBe('drink');
  });

  it('counts nothing for an order that failed', () => {
    const failed = applyInteractionOutcome(at(firstMorning(), 'cafe'), orderDrink, { kind: 'failure' }).state;
    expect(failed.onboarding).toEqual(firstMorning().onboarding);
  });

  it('never goes back a step', () => {
    const inTheCafe = enterPlace(firstMorning(), 'cafe', cafeHours);
    expect(firstMorningStep(drinkWater(at(inTheCafe, 'home')))).toBe('breakfast');
  });

  it('can be skipped part-way, and then nothing counts towards it', () => {
    const skipped = skipFirstMorning(drinkWater(firstMorning()));
    expect(firstMorningStep(skipped)).toBeNull();
    expect(skipped.onboarding).toEqual({ firstMorningStepsDone: 1, firstMorningSkipped: true });
    expect(enterPlace(skipped, 'cafe', cafeHours).onboarding).toEqual(skipped.onboarding);
  });
});

describe('the First Morning café order', () => {
  const inTheCafe = () => enterPlace(drinkWater(firstMorning()), 'cafe', cafeHours);

  it('is any order at the café while the First Morning is under way', () => {
    expect(isFirstMorningCafeOrder(inTheCafe(), orderDrink)).toBe(true);
    expect(isFirstMorningCafeOrder(inTheCafe(), orderWithOptions)).toBe(true);
    expect(isFirstMorningCafeOrder(at(firstMorning(), 'cafe'), orderDrink)).toBe(true);
  });

  it('is no other conversation, and no order once the First Morning is over or skipped', () => {
    expect(isFirstMorningCafeOrder(inTheCafe(), askBaristaForWork)).toBe(false);
    expect(isFirstMorningCafeOrder(at(firstMorning(), 'convenience-store'), buyCounterFood)).toBe(false);
    const breakfasted = succeed(inTheCafe(), orderDrink, { items: [{ item: 'tea', quantity: 1 }] });
    expect(isFirstMorningCafeOrder(breakfasted, orderDrink)).toBe(false);
    expect(isFirstMorningCafeOrder(skipFirstMorning(inTheCafe()), orderDrink)).toBe(false);
  });

  it('has Patience that can’t run out, though the barista’s face still shows the strain', () => {
    const turns = PROFICIENCY_STEP_TABLE.A1.startingPatience * 3;
    let patience = startPatience('A1', 'stranger', { canRunOut: false });
    for (let turn = 0; turn < turns; turn++) patience = losePatience(newPlayerTurn(patience));

    expect(isOutOfPatience(patience)).toBe(false);
    expect(npcExpression(patience)).toBe('strained');
    // Every turn still counts as evidence for Proficiency.
    expect(patience.turnsNotUnderstood).toBe(turns);
  });

  it('is unlike any other conversation, whose Patience runs out', () => {
    let patience = startPatience('A1');
    for (let turn = 0; turn < PROFICIENCY_STEP_TABLE.A1.startingPatience; turn++) patience = losePatience(newPlayerTurn(patience));
    expect(isOutOfPatience(patience)).toBe(true);
  });
});
