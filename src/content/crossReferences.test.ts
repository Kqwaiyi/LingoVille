import { describe, expect, it } from 'vitest';
import { BODY_IDS, BODY_PRESETS, CULTURE_PACKS, culturePackProblems, INTERACTIONS, type AppearancePreset, type CulturePack } from './index.ts';

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
    expect(culturePackProblems(packs, interactions)).toEqual([
      expect.stringMatching(/^de: .*"latte".*order-drink/),
      expect.stringMatching(/^de: .*"latte".*order-with-options/),
      expect.stringMatching(/^de: .*"latte".*order-avoiding-allergen/),
    ]);
  });

  it('fails a pack whose restaurant menu is missing a dish the server orders or recommends', () => {
    const packs = withGerman((de) => delete (de.goods as Partial<CulturePack['goods']>)['veggie-dish']);
    expect(culturePackProblems(packs, interactions)).toEqual([
      expect.stringMatching(/^de: .*"veggie-dish".*order-a-meal/),
      expect.stringMatching(/^de: .*"veggie-dish".*recommend-a-meal/),
    ]);
  });

  it('fails a pack that doesn’t say which allergens are in a café item the barista sells avoiding an allergen', () => {
    const packs = withGerman((de) => delete de.cafeAllergens.pastry);
    expect(culturePackProblems(packs, interactions)).toEqual([expect.stringMatching(/^de: .*allergens.*"pastry".*order-avoiding-allergen/)]);
  });

  it('fails a pack with no local name for an allergen, or for a drink option', () => {
    const packs = withGerman((de) => {
      delete (de.allergens as Partial<CulturePack['allergens']>).egg;
      delete (de.drinkOptions as Partial<CulturePack['drinkOptions']>).iced;
    });
    expect(culturePackProblems(packs, interactions)).toEqual([expect.stringMatching(/^de: .*drinkOptions\.iced.*allergens\.egg/s)]);
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

  it('fails a Named NPC whose build changes from pack to pack', () => {
    const jaBarista = BODY_PRESETS[CULTURE_PACKS.ja.appearances.npcs.barista.body];
    const otherBuild = BODY_IDS.find((body) => BODY_PRESETS[body].build !== jaBarista.build)!;
    const packs = withGerman((de) => (de.appearances.npcs.barista.body = otherBuild));
    expect(culturePackProblems(packs, interactions)).toEqual([expect.stringMatching(/^de: .*barista.*build/)]);
  });

  it('fails a Named NPC whose look is missing a part', () => {
    const packs = withGerman((de) => delete (de.appearances.npcs.barista as Partial<AppearancePreset>).hairColour);
    expect(culturePackProblems(packs, interactions)).toEqual([expect.stringMatching(/^de: .*appearances\.npcs\.barista\.hairColour/s)]);
  });

  it('fails Shift Customer weights that leave a part of a look with nothing to draw', () => {
    const packs = withGerman((de) => {
      de.appearances.customers.skinTone = {};
      de.appearances.customers.hairStyle.feminine = {};
    });
    const [problem, ...others] = culturePackProblems(packs, interactions);
    expect(others).toEqual([]);
    expect(problem).toMatch(/^de: .*customers\.skinTone/s);
    expect(problem).toMatch(/customers\.hairStyle\.feminine/);
  });

  it('fails a persona localisation with no favourite gift', () => {
    const packs = withGerman((de) => delete (de.personas['park-regular-1'] as { favouriteGift?: string }).favouriteGift);
    expect(culturePackProblems(packs, interactions)).toEqual([expect.stringMatching(/^de: .*park-regular-1.*favouriteGift/s)]);
  });

  it('fails a favourite gift that is not the one the persona loves most', () => {
    const packs = withGerman((de) => (de.personas['park-regular-1'].favouriteGift = 'a bag of birdseed'));
    expect(culturePackProblems(packs, interactions)).toEqual([expect.stringMatching(/^de: .*park-regular-1.*flowers/)]);
  });
});
