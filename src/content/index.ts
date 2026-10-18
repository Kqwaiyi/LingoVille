// Public interface of the content module. Other modules import from here.
export {
  ACCESSORY_COLOUR_IDS,
  ACCESSORY_COLOURS,
  AppearancePresetSchema,
  BUILDS,
  DEFAULT_APPEARANCE,
  EYEWEAR_IDS,
  HAT_IDS,
  NECKWEAR_IDS,
  NpcLookSchema,
  type AccessoryColourId,
  type AppearancePreset,
  type Build,
  type CustomerWeights,
  type EyewearId,
  type HatId,
  type NeckwearId,
  type NpcLook,
  type Weights,
} from './appearance.ts';
export { interactionStartedWithE } from './approaches.ts';
export { culturePackProblems } from './crossReferences.ts';
export {
  CULTURE_PACKS,
  culturePackSchema,
  cafeAllergensIn,
  customerLookWeights,
  localNpcPlaceName,
  townNpcLook,
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
export { chargeInShifts, formatLocalAmount, formatLocalMoney, localPrice, menuPrice, priceProblem } from './currency.ts';
export {
  defineInteraction,
  FACT_SOURCES,
  type Band,
  type EffectKind,
  type FactSource,
  type Interaction,
  type InteractionDefinition,
  type OrderLine,
  type ParsedArgs,
  type ResolvedCompletion,
  type ServedItem,
} from './defineInteraction.ts';
export { interactionFacts } from './facts.ts';
export { INTERACTIONS } from './interactions.ts';
export {
  ALLERGENS,
  CAFE_COUNTER,
  CAFE_MENU,
  CAFE_TREATS,
  DRINK_EXTRAS,
  DRINK_OPTIONS,
  DRINK_SIZES,
  DRINK_TEMPERATURES,
  GROCERIES_SOLD,
  isMadeToOrder,
  ITEM_IDS,
  ITEMS,
  MADE_TO_ORDER_EXTRAS,
  RESTAURANT_DISHES,
  RESTAURANT_DRINKS,
  RESTAURANT_MENU,
  type Allergen,
  type DrinkExtra,
  type DrinkOptionId,
  type DrinkSize,
  type DrinkTemperature,
  type GroceryId,
  type Item,
  type ItemId,
} from './items.ts';
export { NAMED_NPC_IDS, NAMED_NPCS, namedNpcSchema, type NamedNpc, type NamedNpcId } from './npcs.ts';
export { placeHours } from './openingHours.ts';
export { formatTime, HOURS_IDS, OPEN_AIR_PLACES, PLACE_HOURS, SERVICE_HOURS, type HoursId } from './places.ts';
export { SIGN_IDS, worldSign, type SignId, type SignLine } from './signs.ts';
export {
  isPasserBy,
  PASSER_BY_IDS,
  PASSER_BY_STOPS,
  ROLE_IDS,
  stopsBetween,
  TOWN_NPC_IDS,
  TOWN_NPCS,
  TRAM_LINE,
  type PasserById,
  type RoleId,
  type TownNpc,
  type TownNpcId,
  type TramStopId,
} from './townNpcs.ts';
export { toGeminiSchema, toToolDeclaration, type FunctionDeclaration, type ToolSchema } from './toolDeclaration.ts';
