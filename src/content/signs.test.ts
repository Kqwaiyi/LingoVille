import { describe, expect, it } from 'vitest';
import { LANGUAGE_CODES } from '../sim/index.ts';
import { CAFE_MENU, CULTURE_PACKS, formatLocalMoney, menuPrice, SIGN_IDS, worldSign } from './index.ts';

describe('worldSign', () => {
  it('writes the café menu board from the pack’s goods, with local prices', () => {
    const [title, ...items] = worldSign('cafe-menu', 'de');
    expect(title).toEqual({ text: 'Karte', note: null, glosses: CULTURE_PACKS.de.signs.menu.glosses });
    expect(items).toEqual(
      CAFE_MENU.map((id) => {
        const good = CULTURE_PACKS.de.goods[id];
        return { text: good.name, note: formatLocalMoney(menuPrice(id, 'de'), 'de'), glosses: good.glosses };
      }),
    );
  });

  it('shows the pack’s own opening hours on the café door', () => {
    expect(worldSign('cafe-hours', 'de')).toEqual([
      { text: 'Öffnungszeiten', note: '08:00–18:00', glosses: CULTURE_PACKS.de.signs.openingHours.glosses },
    ]);
  });

  it('falls back to the town’s hours where the pack doesn’t override them', () => {
    expect(worldSign('cafe-hours', 'zh')[0]?.note).toBe('07:00–19:00');
  });

  it('names the café over its door in the pack’s language', () => {
    expect(worldSign('cafe-name', 'zh')).toEqual([{ text: '星星咖啡', note: null, glosses: CULTURE_PACKS.zh.cafe.nameGlosses }]);
  });

  it.each(LANGUAGE_CODES)('glosses every line of every %s sign in the three other Native Languages', (packId) => {
    const others = LANGUAGE_CODES.filter((language) => language !== packId);
    for (const signId of SIGN_IDS) {
      for (const line of worldSign(signId, packId)) expect(Object.keys(line.glosses).sort()).toEqual([...others].sort());
    }
  });
});
