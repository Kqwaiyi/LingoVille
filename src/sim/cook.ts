import { completeFirstMorningStep } from './firstMorning.ts';
import { isGoneOff } from './inventory.ts';
import { gainLifeSkillXp, lifeSkillLevel, todaysCounters } from './lifeSkills.ts';
import { clampMeter } from './meters.ts';
import type { GameState, InventoryItem } from './state.ts';
import { ILLNESS, LIFE_SKILLS, MOOD } from './tuning.ts';

/**
 * The grocery to cook: the fresh one that goes off soonest, or, with nothing fresh, the
 * gone-off one. Only groceries go off, so anything with an expiry day is a grocery, and
 * each one cooks one meal.
 */
function groceryToCook(inventory: InventoryItem[], day: number): InventoryItem | undefined {
  const groceries = inventory
    .filter((item) => item.expiresOnDay !== null)
    .sort((a, b) => Number(isGoneOff(a, day)) - Number(isGoneOff(b, day)) || a.expiresOnDay! - b.expiresOnDay!);
  return groceries[0];
}

/**
 * The Character cooks a meal at home from one grocery. Cooking level sets how much Hunger
 * it fills, and at max level the meal lifts Mood a little. The first few meals each day give
 * Cooking XP. Gone-off food adds to the food poisoning chance, less the better the cook.
 * A meal cooked counts as the First Morning's breakfast. Away from home, or with no groceries, nothing happens: the
 * same state comes back.
 */
export function cook(state: GameState): GameState {
  if (state.placeId !== 'home') return state;
  const grocery = groceryToCook(state.possessions.inventory, state.clock.day);
  if (!grocery) return state;

  const level = lifeSkillLevel(state.progression.lifeSkillXp.cooking);
  const share = level / LIFE_SKILLS.maxLevel;
  const { atZero, atMax } = LIFE_SKILLS.homeMealHunger;
  const poisoning = isGoneOff(grocery, state.clock.day)
    ? ILLNESS.expiredFoodPoisoningChance * (1 - LIFE_SKILLS.cookingFoodPoisoningReductionAtMax * share)
    : 0;
  const today = todaysCounters(state);
  // XP is earned at the Mood the Character cooked in, before the meal lifts it.
  const learnt =
    today.homeMeals < LIFE_SKILLS.homeMealsCountingPerDay ? gainLifeSkillXp(state, 'cooking', LIFE_SKILLS.xpPerHomeMeal) : state;
  const { character } = state;

  const cooked: GameState = {
    ...learnt,
    character: {
      ...character,
      hunger: clampMeter(character.hunger + atZero + (atMax - atZero) * share),
      mood: level === LIFE_SKILLS.maxLevel ? clampMeter(character.mood + MOOD.changes.goodHomeMeal) : character.mood,
      foodPoisoningChance: 1 - (1 - character.foodPoisoningChance) * (1 - poisoning),
    },
    progression: { ...learnt.progression, today: { ...today, homeMeals: today.homeMeals + 1 } },
    possessions: {
      ...state.possessions,
      inventory: state.possessions.inventory
        .map((item) => (item === grocery ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0),
    },
  };
  return completeFirstMorningStep(cooked, 'breakfast');
}
