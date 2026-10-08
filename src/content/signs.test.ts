import { describe, expect, it } from 'vitest';
import { LANGUAGE_CODES, PLACE_IDS } from '../sim/index.ts';
import {
  CAFE_COUNTER,
  CULTURE_PACKS,
  formatLocalMoney,
  localPlaceName,
  menuPrice,
  placeHours,
  RESTAURANT_MENU,
  SIGN_IDS,
  TRAM_LINE,
  worldSign,
  type SignId,
} from './index.ts';

describe('worldSign', () => {
  it('writes the café menu board from the pack’s goods, Comfort Purchases included, with local prices', () => {
    const [title, ...items] = worldSign('cafe-menu', 'de');
    expect(title).toEqual({ text: 'Karte', note: null, glosses: CULTURE_PACKS.de.signs.menu.glosses });
    expect(items).toEqual(
      CAFE_COUNTER.map((id) => {
        const good = CULTURE_PACKS.de.goods[id];
        return { text: good.name, note: formatLocalMoney(menuPrice(id, 'de'), 'de'), glosses: good.glosses };
      }),
    );
  });

  it('writes the restaurant’s menu board from the pack’s dishes and drinks, with local prices', () => {
    const [title, ...items] = worldSign('restaurant-menu', 'ja');
    expect(title).toEqual({ ...CULTURE_PACKS.ja.signs.menu, note: null });
    expect(items).toEqual(
      RESTAURANT_MENU.map((id) => {
        const good = CULTURE_PACKS.ja.goods[id];
        return { text: good.name, note: formatLocalMoney(menuPrice(id, 'ja'), 'ja'), glosses: good.glosses };
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

  it('shows each place’s own hours on its door', () => {
    expect(worldSign('clinic-hours', 'en')[0]?.note).toBe('09:00–17:00');
    expect(worldSign('bathhouse-hours', 'ja')[0]?.note).toBe('10:00–24:00');
  });

  it('names the café over its door in the pack’s language', () => {
    expect(worldSign('cafe-name', 'zh')).toEqual([{ text: '星星咖啡', note: null, glosses: CULTURE_PACKS.zh.cafe.nameGlosses }]);
  });

  it.each(LANGUAGE_CODES)('names every place but the tram stops in the %s pack by its local name', (packId) => {
    for (const placeId of PLACE_IDS.filter((place) => place !== 'tram-stop')) {
      expect(worldSign(`${placeId}-name` as SignId, packId).map(({ text }) => text)).toEqual([localPlaceName(placeId, packId)]);
    }
  });

  it('names each tram stop on its pole', () => {
    for (const stopId of TRAM_LINE) {
      const { name, nameGlosses } = CULTURE_PACKS.de.tramStops[stopId];
      expect(worldSign(`${stopId}-name`, 'de')).toEqual([{ text: name, note: null, glosses: nameGlosses }]);
    }
  });

  it('hangs opening hours only where a place keeps hours behind a door', () => {
    const hoursSigns = SIGN_IDS.filter((signId) => signId.endsWith('-hours'));
    expect(hoursSigns.map((signId) => signId.replace(/-hours$/, ''))).toEqual(
      PLACE_IDS.filter((placeId) => !['park', 'tram-stop'].includes(placeId) && placeHours(placeId, 'ja') !== null),
    );
  });

  it.each(LANGUAGE_CODES)('glosses every line of every %s sign in the three other Native Languages', (packId) => {
    const others = LANGUAGE_CODES.filter((language) => language !== packId);
    for (const signId of SIGN_IDS) {
      for (const line of worldSign(signId, packId)) expect(Object.keys(line.glosses).sort()).toEqual([...others].sort());
    }
  });
});
