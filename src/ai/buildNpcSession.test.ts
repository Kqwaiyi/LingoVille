import { describe, expect, it } from 'vitest';
import { CULTURE_PACKS, INTERACTIONS, NAMED_NPCS } from '../content/index.ts';
import { CLOCK, LANGUAGE_CODES, PROFICIENCY_STEPS, type LanguageCode, type ProficiencyStep } from '../sim/index.ts';
import { buildNpcSession, GREETING_SCENE } from './index.ts';

const FIRST_MORNING_CLOCK = { day: 1, minuteOfDay: CLOCK.wakeAt + 12 };

function baristaSession(packId: LanguageCode, step: ProficiencyStep = 'A1') {
  return buildNpcSession(INTERACTIONS.orderDrink, CULTURE_PACKS[packId], step, NAMED_NPCS.barista, {
    clock: FIRST_MORNING_CLOCK,
  });
}

const WARD_MORNING_CLOCK = { day: 5, minuteOfDay: CLOCK.faintWakeAt };

function nurseSession(packId: LanguageCode, step: ProficiencyStep = 'A1') {
  return buildNpcSession(INTERACTIONS.wakeInWard, CULTURE_PACKS[packId], step, NAMED_NPCS.nurse, {
    clock: WARD_MORNING_CLOCK,
    approach: 'nurseOnWaking',
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

  it('opens with the customer walking up when the Player pressed E', () => {
    expect(baristaSession('ja').openingScene).toBe(GREETING_SCENE);
  });
});

describe('buildNpcSession: an NPC who starts the conversation', () => {
  it.each(LANGUAGE_CODES)('builds the nurse session on waking from Fainting in the %s pack', (packId) => {
    expect(nurseSession(packId)).toMatchSnapshot();
  });

  it('opens with the scene the NPC approaches in, so the NPC speaks first', () => {
    const { openingScene } = nurseSession('en');
    expect(openingScene).not.toBe(GREETING_SCENE);
    expect(openingScene).toMatch(/^\[SCENE: .*woken up.*\]$/);
  });

  it('speaks of a patient on the ward, not a customer at a café', () => {
    const { systemInstruction } = nurseSession('de');
    expect(systemInstruction).not.toMatch(/customer|café/i);
    expect(systemInstruction).toContain('patient');
  });

  it('offers discharge_patient and not_understood as tools', () => {
    expect(nurseSession('zh').tools.map((tool) => tool.name)).toEqual(['discharge_patient', 'not_understood']);
  });
});
