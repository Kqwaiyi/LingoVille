import { z } from 'zod';
import { LANGUAGE_CODES, type LanguageCode } from '../sim/index.ts';
import { culturePackSchema, type CulturePack } from './culturePacks.ts';
import { priceProblem } from './currency.ts';
import type { Interaction } from './defineInteraction.ts';
import { ITEMS, type GIFTS_SOLD } from './items.ts';
import { NAMED_NPCS, type NamedNpcId } from './npcs.ts';

/** How each gift is named in a persona's favourite gift, which the prompt reads in English. */
const GIFT_WORDS: Record<(typeof GIFTS_SOLD)[number], string> = { flowers: 'flowers', chocolates: 'chocolates', 'scented-candle': 'scented candle' };

/**
 * Everything wrong with the Culture Packs, one line each, or nothing: each pack
 * passes its schema (with glosses in exactly the three other Native Languages),
 * sells every item an interaction refers to (saying which allergens are in each one the barista sells avoiding an
 * allergen), converts every catalogue price, and
 * localises and dresses every Named NPC, keeping to the gift each one loves most.
 */
export function culturePackProblems(packs: Record<LanguageCode, CulturePack>, interactions: readonly Interaction[]): string[] {
  return LANGUAGE_CODES.flatMap((packId) => {
    const pack = packs[packId];
    const problems: string[] = [];
    const parsed = culturePackSchema(packId).safeParse(pack);
    if (!parsed.success) problems.push(z.prettifyError(parsed.error));

    for (const interaction of interactions) {
      for (const item of interaction.items) {
        if (!(item in pack.goods)) problems.push(`sells no "${item}", which ${interaction.id} refers to.`);
        if (interaction.facts.includes('allergens') && !pack.cafeAllergens[item]) {
          problems.push(`says nothing of the allergens in "${item}", which ${interaction.id} sells avoiding an allergen.`);
        }
      }
    }
    for (const [item, { priceInShifts }] of Object.entries(ITEMS)) {
      const problem = priceProblem(priceInShifts, pack.currency);
      if (problem) problems.push(`${item}: ${problem}`);
    }
    for (const npcId of Object.keys(NAMED_NPCS) as NamedNpcId[]) {
      if (!pack.personas[npcId]) problems.push(`gives ${npcId} no local name.`);
      const { favouriteGift } = NAMED_NPCS[npcId];
      const favourite = pack.personas[npcId]?.favouriteGift;
      if (favourite && !favourite.includes(GIFT_WORDS[favouriteGift])) {
        problems.push(`gives ${npcId} a favourite gift that isn't ${GIFT_WORDS[favouriteGift]}, the one they love most.`);
      }
      if (!pack.appearances.npcs[npcId]) problems.push(`gives ${npcId} no Appearance Preset.`);
    }
    return problems.map((problem) => `${packId}: ${problem}`);
  });
}
