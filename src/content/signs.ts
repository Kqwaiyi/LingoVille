import type { LanguageCode, PlaceId } from '../sim/index.ts';
import { CULTURE_PACKS, localPlaceName, placeNameGlosses, type Glosses } from './culturePacks.ts';
import { formatLocalMoney, menuPrice } from './currency.ts';
import { CAFE_COUNTER, RESTAURANT_MENU, type ItemId } from './items.ts';
import { placeHours } from './openingHours.ts';
import { formatTime } from './places.ts';
import { TRAM_LINE, type TramStopId } from './townNpcs.ts';

// World text: the signs and menus the world paints as canvas textures, written
// from the Culture Pack. Pointing at one shows each line's reading aid, and
// Translate shows its gloss.

/** Every place with a name board: over a building's door, or at the park's way in. Each tram stop's is on its pole. */
const NAMED_PLACES = ['home', 'cafe', 'supermarket', 'convenience-store', 'restaurant', 'clinic', 'park', 'bookshop', 'bathhouse', 'town-office'] as const satisfies readonly PlaceId[];
/** The places that keep hours behind a door, with their hours beside it. */
const PLACES_WITH_HOURS = ['cafe', 'supermarket', 'restaurant', 'clinic', 'bookshop', 'bathhouse', 'town-office'] as const satisfies readonly PlaceId[];
/** The places with a menu board, and what it lists. */
const MENUS = { cafe: CAFE_COUNTER, restaurant: RESTAURANT_MENU } as const satisfies Partial<Record<PlaceId, readonly ItemId[]>>;

type NameSign = `${(typeof NAMED_PLACES)[number] | TramStopId}-name`;
type HoursSign = `${(typeof PLACES_WITH_HOURS)[number]}-hours`;
type MenuSign = `${keyof typeof MENUS}-menu`;
export type SignId = NameSign | HoursSign | MenuSign;

export const SIGN_IDS: readonly SignId[] = [
  ...NAMED_PLACES.map((placeId) => `${placeId}-name` as const),
  ...TRAM_LINE.map((stopId) => `${stopId}-name` as const),
  ...PLACES_WITH_HOURS.map((placeId) => `${placeId}-hours` as const),
  ...(Object.keys(MENUS) as (keyof typeof MENUS)[]).map((placeId) => `${placeId}-menu` as const),
];

/** One line of a sign: words in the Target Language, and a note beside them that needs no reading (a price or a time). */
export type SignLine = { text: string; note: string | null; glosses: Glosses };

const isTramStop = (id: string): id is TramStopId => (TRAM_LINE as readonly string[]).includes(id);

/** What a sign says in this pack, line by line. */
export function worldSign(signId: SignId, packId: LanguageCode): SignLine[] {
  const pack = CULTURE_PACKS[packId];
  const [, id, kind] = signId.match(/^(.+)-(name|hours|menu)$/)!;
  if (kind === 'name' && isTramStop(id!)) {
    const { name, nameGlosses } = pack.tramStops[id];
    return [{ text: name, note: null, glosses: nameGlosses }];
  }
  const placeId = id as PlaceId;
  switch (kind) {
    case 'name':
      return [{ text: localPlaceName(placeId, packId), note: null, glosses: placeNameGlosses(placeId, packId) }];
    case 'hours': {
      const hours = placeHours(placeId, packId);
      const note = hours ? `${formatTime(hours.opensAt)}–${formatTime(hours.closesAt)}` : null;
      return [{ ...pack.signs.openingHours, note }];
    }
    default:
      return [
        { ...pack.signs.menu, note: null },
        ...MENUS[placeId as keyof typeof MENUS].map((itemId) => {
          const { name, glosses } = pack.goods[itemId];
          return { text: name, note: formatLocalMoney(menuPrice(itemId, packId), packId), glosses };
        }),
      ];
  }
}
