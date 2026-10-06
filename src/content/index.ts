// Public interface of the content module. Other modules import from here.
export { APPEARANCE_PRESET_IDS, type AppearancePresetId } from './appearance.ts';
export { approachInteraction, interactionStartedWithE, interactionStartedWithF } from './approaches.ts';
export { culturePackProblems } from './crossReferences.ts';
export {
  CULTURE_PACKS,
  culturePackSchema,
  localPlaceName,
  localShop,
  PROP_IDS,
  SIGN_WORDS,
  type Currency,
  type CulturePack,
  type Glosses,
  type Good,
  type PriceStep,
  type PropId,
  type Shop,
  type SignWord,
} from './culturePacks.ts';
export { chargeInShifts, formatLocalAmount, formatLocalMoney, localPrice, menuPrice, priceProblem, tillFor } from './currency.ts';
export {
  defineInteraction,
  FACT_SOURCES,
  type Band,
  type EffectKind,
  type FactSource,
  type Interaction,
  type InteractionDefinition,
  type JobApplication,
  type OrderLine,
  type ParsedArgs,
  type RentChange,
  type ResolvedCompletion,
  type ServedItem,
} from './defineInteraction.ts';
export { basketFacts, interactionFacts, readBasketTotal, readNewWeeklyRent, readRentOwed, type FactsContext } from './facts.ts';
export { INTERACTIONS, START_WHEN } from './interactions.ts';
export {
  DEFAULT_DRINK,
  isCheckout,
  isDrink,
  isTable,
  jobAt,
  JOB_PLACES,
  SHIFT_MENUS,
  SHIFT_TEMPLATES,
  shiftTemplates,
  type CheckoutTemplate,
  type DrinkTemplate,
  type ShiftTemplate,
  type TableTemplate,
} from './shifts.ts';
export {
  BEHIND_THE_COUNTER,
  CAFE_MENU,
  CONVENIENCE_MENU,
  DIETARY_NOTE_IDS,
  DIETARY_NOTES,
  dishFits,
  DRINK_EXTRAS,
  DRINK_OPTIONS,
  DRINK_SIZES,
  DRINK_TEMPERATURES,
  drinkModifiersSchema,
  GROCERIES_SOLD,
  ITEM_IDS,
  ITEMS,
  RESTAURANT_DISHES,
  RESTAURANT_DRINKS,
  RESTAURANT_MENU,
  type DietaryNoteId,
  type DrinkExtra,
  type DrinkModifiers,
  type DrinkOptionId,
  type DrinkSize,
  type DrinkTemperature,
  type GroceryId,
  type Item,
  type ItemId,
  type Restores,
} from './items.ts';
export { NAMED_NPCS, type NamedNpc, type NamedNpcId } from './npcs.ts';
export { PLACE_PHRASEBOOKS, placePhrasebook, placePhrasebookSchema, type PlacePhrase } from './phrasebooks.ts';
export { placeHours } from './openingHours.ts';
export { formatTime, HOURS_IDS, OPEN_AIR_PLACES, PLACE_HOURS, SERVICE_HOURS, type HoursId } from './places.ts';
export { SIGN_IDS, worldSign, type SignId, type SignLine } from './signs.ts';
export {
  ROLE_IDS,
  stopsBetween,
  TOWN_NPC_IDS,
  TOWN_NPCS,
  TRAM_LINE,
  type RoleId,
  type TownNpc,
  type TownNpcId,
  type TramStopId,
} from './townNpcs.ts';
export { toGeminiSchema, toToolDeclaration, type FunctionDeclaration, type ToolSchema } from './toolDeclaration.ts';
