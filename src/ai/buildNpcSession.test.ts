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

describe('buildNpcSession: the supermarket and convenience store', () => {
  const MORNING = { day: 2, minuteOfDay: 10 * 60 };
  const BASKET = [
    { itemId: 'eggs', quantity: 2 },
    { itemId: 'noodles', quantity: 1 },
  ] as const;

  const tillSession = (packId: LanguageCode) =>
    buildNpcSession(INTERACTIONS.payForGroceries, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.cashier, { clock: MORNING, basket: BASKET });
  const shelvesSession = (packId: LanguageCode) =>
    buildNpcSession(INTERACTIONS.findAnItem, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.cashier, { clock: MORNING });
  const counterSession = (packId: LanguageCode) =>
    buildNpcSession(INTERACTIONS.buyCounterFood, CULTURE_PACKS[packId], 'A1', NAMED_NPCS['convenience-clerk'], { clock: MORNING });

  it.each(LANGUAGE_CODES)('builds the cashier at the till, the cashier at the shelves and the clerk at the counter in the %s pack', (packId) => {
    expect(tillSession(packId)).toMatchSnapshot();
    expect(shelvesSession(packId)).toMatchSnapshot();
    expect(counterSession(packId)).toMatchSnapshot();
  });

  it('tells the cashier what is on the counter and the total, in the pack’s money', () => {
    const { systemInstruction } = tillSession('ja');
    expect(systemInstruction).toContain('2 × 卵, ¥360 each');
    expect(systemInstruction).toContain('1 × うどん, ¥360 each');
    expect(systemInstruction).toContain('Total: ¥1,080');
  });

  it('has the cashier read back the total, the bag and the points card before taking payment', () => {
    const { systemInstruction, tools } = tillSession('en');
    expect(systemInstruction).toMatch(/read back the total.*bag.*points card/i);
    expect(tools.map((tool) => tool.name)).toEqual(['complete_purchase', 'not_understood']);
  });

  it('works at Brooks Supermarket and the corner shop, by their local names', () => {
    expect(tillSession('en').systemInstruction).toContain('Brooks Supermarket');
    expect(counterSession('en').systemInstruction).toContain('Patel’s Corner Shop');
    expect(counterSession('en').systemInstruction).not.toMatch(/café/i);
  });

  it('gives the cashier the shelf ids to point to, and has them check the item first', () => {
    const { systemInstruction, tools } = shelvesSession('de');
    expect(systemInstruction).toContain('Eier (shelf id "eggs")');
    expect(systemInstruction).toMatch(/check.*which item/i);
    expect(tools.map((tool) => tool.name)).toEqual(['point_to', 'not_understood']);
  });

  it('says the convenience store never closes', () => {
    expect(counterSession('ja').systemInstruction).toContain('ニコニコマート is open 24 hours.');
  });
});
