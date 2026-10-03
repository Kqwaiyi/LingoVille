// Public interface of the content module. Other modules import from here.
export { CAFE_ITEM_IDS, CAFE_ITEMS, type CafeItem, type CafeItemId, type Restores } from './cafe.ts';
export { CULTURE_PACKS, type CulturePack } from './culturePacks.ts';
export { formatLocalMoney, PACK_CURRENCIES, toLocalMoney } from './currency.ts';
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
export { NAMED_NPCS, type NamedNpc, type NamedNpcId } from './npcs.ts';
export { PLACE_HOURS, type OpeningHours } from './places.ts';
export { toGeminiSchema, toToolDeclaration, type FunctionDeclaration, type ToolSchema } from './toolDeclaration.ts';
