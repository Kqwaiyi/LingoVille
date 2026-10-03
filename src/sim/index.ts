// Public interface of the sim module. Other modules import from here.
export { gameMinutesFor, weekdayOf, WEEKDAYS, type Weekday } from './clock.ts';
export { applyInteractionOutcome, type InteractionOutcome, type OutcomeResult } from './interactionOutcome.ts';
export { clampMeter } from './meters.ts';
export {
  isOutOfPatience,
  isUnreadableTranscript,
  losePatience,
  newPlayerTurn,
  npcExpression,
  startPatience,
  type NpcExpression,
  type Patience,
} from './patience.ts';
export { createSave, type GameState, type LanguageCode, type NewGameSetup, type PlaceId } from './state.ts';
export * from './tuning.ts';
export { drinkWater, enterPlace, tick } from './wellBeing.ts';
