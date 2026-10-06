import { describe, expect, it } from 'vitest';
import { CULTURE_PACKS } from '../content/index.ts';
import { LANGUAGE_CODES, PROFICIENCY_STEPS, type LanguageCode, type ProficiencyStep, type ShiftCustomer } from '../sim/index.ts';
import {
  buildShiftCustomerSession,
  NOT_UNDERSTOOD_TOOL,
  readChangedOrder,
  readChangeScene,
  readShiftOrder,
  shiftCustomerChangeScene,
  shiftCustomerServedScene,
} from './index.ts';

const MID_MORNING = { day: 3, minuteOfDay: 10 * 60 + 20 };
const WANTS_A_LATTE: ShiftCustomer = { templateId: 'barista-single-drink', order: [{ itemId: 'latte', quantity: 1 }], changedFrom: null, voiceSeed: 4242 };
const ICED_TEA = [{ itemId: 'tea' as const, quantity: 1, modifiers: { size: 'large' as const, temperature: 'iced' as const, extras: ['lemon' as const] } }];
const HOT_COFFEE = [{ itemId: 'coffee' as const, quantity: 1, modifiers: { size: 'small' as const, temperature: 'hot' as const, extras: ['milk' as const] } }];
const WANTS_ICED_TEA: ShiftCustomer = { templateId: 'barista-made-to-order', order: ICED_TEA, changedFrom: null, voiceSeed: 7 };
const CHANGES_MIND: ShiftCustomer = { templateId: 'barista-change-of-mind', order: ICED_TEA, changedFrom: HOT_COFFEE, voiceSeed: 7 };

function customerSession(packId: LanguageCode, step: ProficiencyStep = 'A1', customer = WANTS_A_LATTE) {
  return buildShiftCustomerSession(customer, CULTURE_PACKS[packId], step, { clock: MID_MORNING });
}

describe('buildShiftCustomerSession', () => {
  it.each(LANGUAGE_CODES.flatMap((packId) => PROFICIENCY_STEPS.map((step) => [packId, step] as const)))(
    'builds a single-drink Shift Customer in the %s pack at %s',
    (packId, step) => {
      expect(customerSession(packId, step)).toMatchSnapshot();
    },
  );

  it('carries the hidden order as the customer’s goal, by its local name', () => {
    const { systemInstruction } = customerSession('ja');
    expect(systemInstruction).toContain('YOUR ORDER');
    expect(readShiftOrder(systemInstruction)).toBe(`1 × ${CULTURE_PACKS.ja.goods.latte.name}`);
  });

  it.each(LANGUAGE_CODES)('builds a customer ordering a drink made to order, and one who changes their mind, in the %s pack', (packId) => {
    expect(customerSession(packId, 'B1', WANTS_ICED_TEA).systemInstruction).toMatchSnapshot();
    expect(customerSession(packId, 'C1', CHANGES_MIND).systemInstruction).toMatchSnapshot();
  });

  it('says how a drink made to order is made: its size, hot or iced, and its extras, by their local names', () => {
    const { systemInstruction } = customerSession('ja', 'B1', WANTS_ICED_TEA);
    const { drinkOptions, goods } = CULTURE_PACKS.ja;
    expect(readShiftOrder(systemInstruction)).toBe(`1 × ${goods.tea.name} (${drinkOptions.large.name}, ${drinkOptions.iced.name}, ${drinkOptions.lemon.name})`);
    expect(systemInstruction).toMatch(/size/);
    expect(readChangedOrder(systemInstruction)).toBeNull();
  });

  it('has a customer who changes their mind order the first drink, then the final one once the scene says so', () => {
    const { systemInstruction } = customerSession('en', 'C1', CHANGES_MIND);
    const { drinkOptions, goods } = CULTURE_PACKS.en;
    expect(readShiftOrder(systemInstruction)).toBe(`1 × ${goods.coffee.name} (${drinkOptions.small.name}, ${drinkOptions.hot.name}, ${drinkOptions.milk.name})`);
    expect(readChangedOrder(systemInstruction)).toBe(`1 × ${goods.tea.name} (${drinkOptions.large.name}, ${drinkOptions.iced.name}, ${drinkOptions.lemon.name})`);
    expect(readChangeScene(shiftCustomerChangeScene())).toBe(true);
    expect(readChangeScene(shiftCustomerServedScene(ICED_TEA, true, CULTURE_PACKS.en))).toBe(false);
  });

  it('is anonymous, with no memory, and the voice its seed picks', () => {
    const { systemInstruction, voice } = customerSession('de');
    expect(systemInstruction).toMatch(/never met/);
    expect(voice).toEqual({ targetLanguage: 'de', shiftCustomerVoice: WANTS_A_LATTE.voiceSeed });
  });

  it('offers only not_understood: what is served is checked by the game, not the model', () => {
    expect(customerSession('en').tools.map((tool) => tool.name)).toEqual([NOT_UNDERSTOOD_TOOL]);
  });

  it('opens with the customer walking up, so they speak first', () => {
    expect(customerSession('zh').openingScene).toMatch(/^\[SCENE: .*walk up to the counter.*\]$/);
  });
});

describe('shiftCustomerServedScene', () => {
  it('tells the customer what they were handed, and whether it is what they ordered', () => {
    const right = shiftCustomerServedScene([{ itemId: 'latte', quantity: 1 }], true, CULTURE_PACKS.en);
    const wrong = shiftCustomerServedScene([{ itemId: 'tea', quantity: 1 }], false, CULTURE_PACKS.en);
    expect(right).toContain(`1 × ${CULTURE_PACKS.en.goods.latte.name}`);
    expect(right).toMatch(/is what you ordered/);
    expect(wrong).toContain(`1 × ${CULTURE_PACKS.en.goods.tea.name}`);
    expect(wrong).toMatch(/is not what you ordered/);
  });

  it('says how the drink handed over was made', () => {
    const { drinkOptions } = CULTURE_PACKS.de;
    expect(shiftCustomerServedScene(ICED_TEA, true, CULTURE_PACKS.de)).toContain(`${drinkOptions.large.name}, ${drinkOptions.iced.name}, ${drinkOptions.lemon.name}`);
  });
});
