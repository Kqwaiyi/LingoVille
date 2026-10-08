import { z } from 'zod';
import { ECONOMY, LANGUAGE_CODES, PLACE_IDS, type LanguageCode } from '../sim/index.ts';
import { BODY_PRESETS } from './appearance.ts';
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
 * allergen), converts every catalogue price and the postage, and
 * localises and dresses every Named NPC, keeping to the gift each one loves most and to the same build in every pack
 * (as the Japanese pack has it), and dresses each place in props of its own, not just as another pack does.
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
    for (const [speed, postageInShifts] of Object.entries(ECONOMY.postageInShifts)) {
      const problem = priceProblem(postageInShifts, pack.currency);
      if (problem) problems.push(`${speed} postage: ${problem}`);
    }
    for (const npcId of Object.keys(NAMED_NPCS) as NamedNpcId[]) {
      if (!pack.personas[npcId]) problems.push(`gives ${npcId} no local name.`);
      const { favouriteGift } = NAMED_NPCS[npcId];
      const favourite = pack.personas[npcId]?.favouriteGift;
      if (favourite && !favourite.includes(GIFT_WORDS[favouriteGift])) {
        problems.push(`gives ${npcId} a favourite gift that isn't ${GIFT_WORDS[favouriteGift]}, the one they love most.`);
      }
      const body = pack.appearances.npcs[npcId]?.body;
      const jaBody = packs.ja.appearances.npcs[npcId]?.body;
      const build = jaBody && BODY_PRESETS[jaBody]?.build;
      if (!pack.appearances.npcs[npcId]) problems.push(`gives ${npcId} no Appearance Preset.`);
      else if (body && build && BODY_PRESETS[body] && BODY_PRESETS[body].build !== build) {
        problems.push(`gives ${npcId} a ${BODY_PRESETS[body].build} build, not the ${build} one they have in every pack.`);
      }
    }
    for (const placeId of PLACE_IDS) {
      for (const otherId of LANGUAGE_CODES) {
        if (otherId !== packId && sameDressing(pack.props[placeId], packs[otherId].props[placeId])) {
          problems.push(`dresses the ${placeId} just as the ${otherId} pack does.`);
        }
      }
    }
    return problems.map((problem) => `${packId}: ${problem}`);
  });
}

/** The same props, in whatever order. */
function sameDressing(a: readonly string[] | undefined, b: readonly string[] | undefined) {
  return !!a?.length && !!b?.length && [...a].sort().join() === [...b].sort().join();
}
