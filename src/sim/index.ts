// Public interface of the sim module. Other modules import from here.
export { gameMinutesFor, weekdayOf, WEEKDAYS, type Weekday } from './clock.ts';
export { weighRecapEvidence, type EvidenceLine, type HelpShown, type RecapEvidence } from './helpEvidence.ts';
export { applyInteractionOutcome, type InteractionOutcome, type OutcomeResult } from './interactionOutcome.ts';
export { clampMeter } from './meters.ts';
export { addToPhrasebook } from './phrasebook.ts';
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
export {
  createSave,
  DEBT_KINDS,
  ILLNESS_IDS,
  JOB_IDS,
  LANGUAGE_CODES,
  LIFE_SKILL_IDS,
  PLACE_IDS,
  type Debt,
  type GameState,
  type IllnessId,
  type InventoryItem,
  type JobId,
  type LanguageCode,
  type LifeSkillId,
  type NewGameSetup,
  type NpcMemory,
  type PaymentPlan,
  type PhrasebookEntry,
  type PlaceId,
} from './state.ts';
export * from './tuning.ts';
export { drinkWater, enterPlace, tick } from './wellBeing.ts';
