// Public interface of the sim module. Other modules import from here.
export { gameMinutesFor, isOpen, weekdayOf, WEEKDAYS, type OpeningHours, type Weekday } from './clock.ts';
export { weighRecapEvidence, type EvidenceLine, type HelpShown, type RecapEvidence } from './helpEvidence.ts';
export { applyInteractionOutcome, type InteractionOutcome, type OutcomeResult } from './interactionOutcome.ts';
export { addToBasket, putBackFromBasket, type Basket } from './basket.ts';
export {
  APPROACH_IDS,
  approachDue,
  hallwayApproach,
  hallwayApproachMade,
  parkWaveDue,
  parkWaveMade,
  type ApproachId,
  type HallwayApproachId,
} from './approaches.ts';
export { cook } from './cook.ts';
export { faint, faintedBetween } from './faint.ts';
export { jobAids, lifeSkillLevel, lifeSkillLevels, type JobAid } from './lifeSkills.ts';
export { isGoneOff } from './inventory.ts';
export { hire, namesMatch } from './jobs.ts';
export { applyShiftCustomer, cancelShift, endShift, nextShiftCustomer, shiftRefusal, startShift, type ShiftRefusal } from './shift.ts';
export { addToTray, clearTray, EMPTY_TRAY, redoTray, undoTray, type TrayHistory } from './tray.ts';
export { addPadLine, choosePadLine, EMPTY_PAD, kitchenOrder, noteOnPad, removePadLine, writeOnPad, type OrderPad } from './orderPad.ts';
export { changeOwed, coinsTotal, suggestChange, tillTotal, type Till } from './till.ts';
export { clampMeter } from './meters.ts';
export { MOOD_FACES, moodFace, moodModifier, type MoodFace } from './mood.ts';
export { announceNewcomerDiscount, newcomerDiscountStepDownDue } from './newcomerDiscount.ts';
export { addToPhrasebook } from './phrasebook.ts';
export {
  endSmallTalk,
  familiarityTier,
  FAMILIARITY_TIERS,
  giveGift,
  isFamiliarAtLeast,
  learnName,
  rememberTopic,
  revealFavourite,
  smallTalkExchange,
  startSmallTalk,
  type FamiliarityTier,
} from './familiarity.ts';
export { memoryOf } from './npcMemory.ts';
export { casualRegisterDue, casualRegisterOffered, onTheHouseGiven, rollOnTheHouse, usualOffered } from './regulars.ts';
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
  DEBT_KINDS,
  ILLNESS_IDS,
  JOB_IDS,
  LANGUAGE_CODES,
  LIFE_SKILL_IDS,
  PLACE_IDS,
  type Checkout,
  type Diner,
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
  type Shift,
  type ShiftCustomer,
  type ShiftOrder,
  type ShiftOrderLine,
  type PadDiner,
  type TillWork,
  type PlaceId,
  type RestaurantTable,
} from './state.ts';
export { grantExtension, payRent, rentDebt, rentOwed, rentStatement, type RentPayment, type RentStatement } from './rent.ts';
export { weeklyRent } from './rentPrice.ts';
export { restaurantDebt } from './restaurant.ts';
export { bedUsable, sleep } from './sleep.ts';
export { rideTram, tramTripMinutes } from './tram.ts';
export * from './tuning.ts';
export { drinkWater, enterPlace, tick } from './wellBeing.ts';
