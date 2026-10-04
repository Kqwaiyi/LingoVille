// Public interface of the content module. Other modules import from here.
export { APPEARANCE_PRESET_IDS, type AppearancePresetId } from './appearance.ts';
export { culturePackProblems } from './crossReferences.ts';
export {
  CULTURE_PACKS,
  culturePackSchema,
  PROP_IDS,
  SIGN_WORDS,
  type Currency,
  type CulturePack,
  type Glosses,
  type Good,
  type PriceStep,
  type PropId,
  type SignWord,
} from './culturePacks.ts';
export { chargeInShifts, formatLocalMoney, localPrice, menuPrice, priceProblem } from './currency.ts';
export {
  defineInteraction,
  FACT_SOURCES,
  type Band,
  type FactSource,
  type Interaction,
  type InteractionDefinition,
  type OrderLine,
  type ParsedArgs,
  type ServedItem,
} from './defineInteraction.ts';
export { interactionFacts } from './facts.ts';
export { INTERACTIONS } from './interactions.ts';
export { CAFE_MENU, ITEM_IDS, ITEMS, type Item, type ItemId, type Restores } from './items.ts';
export { NAMED_NPCS, type NamedNpc, type NamedNpcId } from './npcs.ts';
export { PLACE_PHRASEBOOKS, placePhrasebook, placePhrasebookSchema, type PlacePhrase } from './phrasebooks.ts';
export { formatTime, PLACE_HOURS, placeHours, type OpeningHours } from './places.ts';
export { SIGN_IDS, worldSign, type SignId, type SignLine } from './signs.ts';
export { toGeminiSchema, toToolDeclaration, type FunctionDeclaration, type ToolSchema } from './toolDeclaration.ts';
