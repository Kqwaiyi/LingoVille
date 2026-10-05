import { describe, expect, it } from 'vitest';
import { CULTURE_PACKS, INTERACTIONS, NAMED_NPCS } from '../content/index.ts';
import { CLOCK, LANGUAGE_CODES, PROFICIENCY_STEPS, type LanguageCode, type ProficiencyStep } from '../sim/index.ts';
import { buildNpcSession } from './index.ts';

const FIRST_MORNING_CLOCK = { day: 1, minuteOfDay: CLOCK.wakeAt + 12 };

function baristaSession(packId: LanguageCode, step: ProficiencyStep = 'A1') {
  return buildNpcSession(INTERACTIONS.orderDrink, CULTURE_PACKS[packId], step, NAMED_NPCS.barista, {
    clock: FIRST_MORNING_CLOCK,
  });
}

describe('buildNpcSession', () => {
  it.each(LANGUAGE_CODES.flatMap((packId) => PROFICIENCY_STEPS.map((step) => [packId, step] as const)))(
    'builds the barista session in the %s pack at %s',
    (packId, step) => {
      expect(baristaSession(packId, step)).toMatchSnapshot();
    },
  );

  it('builds the instruction from the ordered blocks', () => {
    const { systemInstruction } = baristaSession('ja');
    const headings = ['WHO YOU ARE', 'YOU AND THIS PERSON', 'LANGUAGE RULES', 'HOW TO SPEAK', 'FACTS', 'YOUR GOAL', 'THE SITUATION'];
    const positions = headings.map((heading) => systemInstruction.indexOf(heading));

    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("offers the interaction's completion function and not_understood as tools", () => {
    const { tools } = baristaSession('en');

    expect(tools.map((tool) => tool.name)).toEqual(['serve_order', 'not_understood']);
    expect(tools[0]).toEqual(INTERACTIONS.orderDrink.toolDeclaration);
  });

  it('is pure: the same inputs give the same session', () => {
    expect(baristaSession('de')).toEqual(baristaSession('de'));
  });
});
