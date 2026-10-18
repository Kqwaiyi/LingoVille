// Public interface of the sim module. Other modules import from here.
export { enterPlace, gameMinutesFor, isOpen, tick, weekdayOf, WEEKDAYS, type OpeningHours, type Weekday } from './clock.ts';
export { weighRecapEvidence, type EvidenceLine, type HelpShown, type RecapEvidence } from './helpEvidence.ts';
export { applyInteractionOutcome, type InteractionOutcome, type OutcomeResult } from './interactionOutcome.ts';
export { daylight, type Daylight, type LightingPreset, type SkyPosition } from './daylight.ts';
export { jobAids, lifeSkillLevel, lifeSkillLevels, type JobAid } from './lifeSkills.ts';
export { hire, namesMatch } from './jobs.ts';
export { lookFromSeed, type LookWeights } from './looks.ts';
export { applyShiftCustomer, cancelShift, endShift, nextShiftCustomer, shiftRefusal, startShift, type ShiftRefusal } from './shift.ts';
export { addToTray, clearTray, EMPTY_TRAY, redoTray, undoTray, type TrayHistory } from './tray.ts';
export { addPadLine, choosePadLine, EMPTY_PAD, kitchenOrder, noteOnPad, removePadLine, writeOnPad, type OrderPad } from './orderPad.ts';
export { changeOwed, coinsTotal, suggestChange, tillTotal, type Till } from './till.ts';
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
export { applyRecapEvidence, applyShiftEvidence, type ConversationEvidence, type ShiftCustomerEvidence, type ShiftEvidence } from './proficiency.ts';
export {
  createSave,
  JOB_IDS,
  LANGUAGE_CODES,
  LIFE_SKILL_IDS,
  PLACE_IDS,
  type Checkout,
  type Diner,
  type GameState,
  type JobId,
  type LanguageCode,
  type LifeSkillId,
  type NewGameSetup,
  type PhrasebookEntry,
  type Shift,
  type ShiftCustomer,
  type ShiftOrder,
  type ShiftOrderLine,
  type PadDiner,
  type TillWork,
  type PlaceId,
} from './state.ts';
export { rideTram, tramTripMinutes } from './tram.ts';
export * from './tuning.ts';
