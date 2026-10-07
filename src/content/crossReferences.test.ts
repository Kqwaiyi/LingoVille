import { describe, expect, it } from 'vitest';
import { CULTURE_PACKS, culturePackProblems, INTERACTIONS, type CulturePack } from './index.ts';

const interactions = Object.values(INTERACTIONS);

/** The real packs, with the German one changed by `change`. */
function withGerman(change: (pack: CulturePack) => unknown) {
  const de = structuredClone(CULTURE_PACKS.de);
  change(de);
  return { ...CULTURE_PACKS, de };
}

describe('culturePackProblems', () => {
  it('finds nothing wrong with the four Culture Packs', () => {
    expect(culturePackProblems(CULTURE_PACKS, interactions)).toEqual([]);
  });

  it('fails a pack that is missing an item an interaction refers to', () => {
    const packs = withGerman((de) => delete (de.goods as Partial<CulturePack['goods']>).latte);
    expect(culturePackProblems(packs, interactions)).toEqual([expect.stringMatching(/^de: .*"latte".*order-drink/)]);
  });

  it('fails a pack whose restaurant menu is missing a dish the server orders or recommends', () => {
    const packs = withGerman((de) => delete (de.goods as Partial<CulturePack['goods']>)['veggie-dish']);
    expect(culturePackProblems(packs, interactions)).toEqual([
      expect.stringMatching(/^de: .*"veggie-dish".*order-a-meal/),
      expect.stringMatching(/^de: .*"veggie-dish".*recommend-a-meal/),
    ]);
  });

  it('fails a gloss missing in one of the three other Native Languages', () => {
    const packs = withGerman((de) => delete de.goods.tea.glosses.zh);
    expect(culturePackProblems(packs, interactions)).toEqual([expect.stringMatching(/^de: .*goods\.tea\.glosses\.zh/s)]);
  });

  it('fails a gloss for the pack’s own language, which nobody reads', () => {
    const packs = withGerman((de) => (de.signs.menu.glosses.de = 'Karte'));
    expect(culturePackProblems(packs, interactions)).toEqual([expect.stringMatching(/^de: .*signs\.menu\.glosses/s)]);
  });

  it('fails a price that doesn’t convert to a local price point', () => {
    // Euros only in hundreds: no café price survives the rounding.
    const packs = withGerman((de) => (de.currency.priceSteps = [{ step: 100 }]));
    expect(culturePackProblems(packs, interactions)).toContainEqual(expect.stringMatching(/^de: coffee: .*does not convert/));
  });

  it('fails a Named NPC with no localisation or no appearance', () => {
    const packs = withGerman((de) => {
      delete (de.personas as Partial<CulturePack['personas']>).barista;
      delete (de.appearances.npcs as Partial<CulturePack['appearances']['npcs']>).barista;
    });
    expect(culturePackProblems(packs, interactions)).toEqual([
      expect.stringMatching(/^de: .*barista.*name/),
      expect.stringMatching(/^de: .*barista.*appearance/i),
    ]);
  });

  it('fails a persona localisation with no favourite gift', () => {
    const packs = withGerman((de) => delete (de.personas['park-regular-1'] as { favouriteGift?: string }).favouriteGift);
    expect(culturePackProblems(packs, interactions)).toEqual([expect.stringMatching(/^de: .*park-regular-1.*favouriteGift/s)]);
  });
});
