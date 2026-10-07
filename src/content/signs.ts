import type { LanguageCode } from '../sim/index.ts';
import { CULTURE_PACKS, type Glosses } from './culturePacks.ts';
import { formatLocalMoney, menuPrice } from './currency.ts';
import { CAFE_COUNTER } from './items.ts';
import { placeHours } from './openingHours.ts';
import { formatTime } from './places.ts';

// World text: the signs and menus the world paints as canvas textures, written
// from the Culture Pack. Pointing at one shows each line's reading aid, and
// Translate shows its gloss.

export const SIGN_IDS = ['cafe-name', 'cafe-hours', 'cafe-menu'] as const;
export type SignId = (typeof SIGN_IDS)[number];

/** One line of a sign: words in the Target Language, and a note beside them that needs no reading (a price or a time). */
export type SignLine = { text: string; note: string | null; glosses: Glosses };

/** What a sign says in this pack, line by line. */
export function worldSign(signId: SignId, packId: LanguageCode): SignLine[] {
  const pack = CULTURE_PACKS[packId];
  switch (signId) {
    case 'cafe-name':
      return [{ text: pack.cafe.name, note: null, glosses: pack.cafe.nameGlosses }];
    case 'cafe-hours': {
      const hours = placeHours('cafe', packId);
      const note = hours ? `${formatTime(hours.opensAt)}–${formatTime(hours.closesAt)}` : null;
      return [{ ...pack.signs.openingHours, note }];
    }
    case 'cafe-menu':
      return [
        { ...pack.signs.menu, note: null },
        ...CAFE_COUNTER.map((id) => {
          const { name, glosses } = pack.goods[id];
          return { text: name, note: formatLocalMoney(menuPrice(id, packId), packId), glosses };
        }),
      ];
  }
}
