// Public interface of the sim module. Other modules import from here.
export { enterPlace, gameMinutesFor, isOpen, tick, weekdayOf, WEEKDAYS, type OpeningHours, type Weekday } from './clock.ts';
export { weighRecapEvidence, type EvidenceLine, type HelpShown, type RecapEvidence } from './helpEvidence.ts';
export { applyInteractionOutcome, type InteractionOutcome, type OutcomeResult } from './interactionOutcome.ts';
export { daylight, type Daylight, type LightingPreset, type SkyPosition } from './daylight.ts';
export { lookFromSeed, type LookWeights } from './looks.ts';
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
export { applyRecapEvidence, type ConversationEvidence } from './proficiency.ts';
export {
  createSave,
  LANGUAGE_CODES,
  PLACE_IDS,
  type GameState,
  type LanguageCode,
  type NewGameSetup,
  type PhrasebookEntry,
  type PlaceId,
} from './state.ts';
export { rideTram, tramTripMinutes } from './tram.ts';
export * from './tuning.ts';
