import { describe, expect, it } from 'vitest';
import { CULTURE_PACKS } from '../src/content/index.ts';
import { LANGUAGE_CODES } from '../src/sim/index.ts';
import { setDressingProblems } from '../src/world/setDressing.ts';

// Holds every Culture Pack's set dressing to the spots the shared layout keeps for it: each prop stands in a spot of
// its own kind at its place (a door, a counter, a table, a floor, the park's lawn, a tram platform), and each grocery
// is a prop made for the supermarket's shelves.

describe('the set dressing', () => {
  it('fits every pack’s props into the spots at each place, and every grocery onto its shelf', () => {
    expect(LANGUAGE_CODES.flatMap((packId) => setDressingProblems(CULTURE_PACKS[packId]).map((problem) => `${packId}: ${problem}`))).toEqual([]);
  });

  it('fails a prop with no spot of its kind left at its place, and a grocery shown as something not made for a shelf', () => {
    const de = structuredClone(CULTURE_PACKS.de);
    de.props.home = ['vending-machine'];
    de.props.park = ['beer-bench', 'beer-bench', 'beer-bench'];
    de.shelves.eggs = 'teddy';

    expect(setDressingProblems(de)).toEqual([
      'the home has no platform spot for vending-machine.',
      'the park has no lawn spot left for beer-bench.',
      'eggs sit on the shelf as teddy, which is a floor prop.',
    ]);
  });
});
