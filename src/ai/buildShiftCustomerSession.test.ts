import { describe, expect, it } from 'vitest';
import { CULTURE_PACKS } from '../content/index.ts';
import { LANGUAGE_CODES, PROFICIENCY_STEPS, type LanguageCode, type ProficiencyStep, type ShiftCustomer } from '../sim/index.ts';
import {
  buildShiftCustomerSession,
  NOT_UNDERSTOOD_TOOL,
  readChangedOrder,
  readChangeScene,
  readCheckout,
  readServedScene,
  readShiftOrder,
  shiftCustomerChangeScene,
  shiftCustomerServedScene,
} from './index.ts';

const MID_MORNING = { day: 3, minuteOfDay: 10 * 60 + 20 };
const WANTS_A_LATTE: ShiftCustomer = { templateId: 'barista-single-drink', order: [{ itemId: 'latte', quantity: 1 }], changedFrom: null, checkout: null, voiceSeed: 4242 };
const ICED_TEA = [{ itemId: 'tea' as const, quantity: 1, modifiers: { size: 'large' as const, temperature: 'iced' as const, extras: ['lemon' as const] } }];
const HOT_COFFEE = [{ itemId: 'coffee' as const, quantity: 1, modifiers: { size: 'small' as const, temperature: 'hot' as const, extras: ['milk' as const] } }];
const WANTS_ICED_TEA: ShiftCustomer = { templateId: 'barista-made-to-order', order: ICED_TEA, changedFrom: null, checkout: null, voiceSeed: 7 };
const CHANGES_MIND: ShiftCustomer = { templateId: 'barista-change-of-mind', order: ICED_TEA, changedFrom: HOT_COFFEE, checkout: null, voiceSeed: 7 };
/** At the till: eggs and cabbage, a bag but no points card, paying by card. */
const PAYS: ShiftCustomer = {
  templateId: 'cashier-pays',
  order: [{ itemId: 'eggs', quantity: 2 }, { itemId: 'vegetables', quantity: 1 }],
  changedFrom: null,
  checkout: { bag: true, pointsCard: false, fromBehindTheCounter: null, cashHanded: null, changeDue: null },
  voiceSeed: 11,
};
/** The same shopping and stamps from behind the counter, no bag but a points card, paying ¥2,000 in cash. */
const PAYS_CASH: ShiftCustomer = {
  templateId: 'cashier-pays-cash',
  order: [...PAYS.order, { itemId: 'stamps', quantity: 1 }],
  changedFrom: null,
  checkout: { bag: false, pointsCard: true, fromBehindTheCounter: 'stamps', cashHanded: 2000, changeDue: 800 },
  voiceSeed: 12,
};

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

  it.each(LANGUAGE_CODES)('builds a customer at the till paying by card, and one paying cash for something from behind the counter, in the %s pack', (packId) => {
    expect(customerSession(packId, 'A2', PAYS).systemInstruction).toMatchSnapshot();
    expect(customerSession(packId, 'B1', PAYS_CASH).systemInstruction).toMatchSnapshot();
  });

  it('puts a customer at the till at the supermarket, talking to the cashier', () => {
    const { systemInstruction, openingScene } = customerSession('ja', 'A2', PAYS);
    expect(systemInstruction).toContain(CULTURE_PACKS.ja.supermarket.name);
    expect(systemInstruction).toMatch(/The cashier serving you/);
    expect(systemInstruction).not.toMatch(/barista|café/);
    expect(openingScene).toMatch(/walk up to the till/);
  });

  it('carries what a customer at the till wants: their shopping, which the cashier sees, their bag and points card, and how they pay', () => {
    const { goods } = CULTURE_PACKS.ja;
    expect(readCheckout(customerSession('ja', 'A2', PAYS).systemInstruction)).toEqual({
      shopping: `2 × ${goods.eggs.name}, 1 × ${goods.vegetables.name}`,
      bag: true,
      pointsCard: false,
      fromBehindTheCounter: null,
      cashHanded: null,
    });
    expect(readCheckout(customerSession('ja', 'B1', PAYS_CASH).systemInstruction)).toEqual({
      shopping: `2 × ${goods.eggs.name}, 1 × ${goods.vegetables.name}`,
      bag: false,
      pointsCard: true,
      fromBehindTheCounter: goods.stamps.name,
      cashHanded: '¥2,000',
    });
    expect(readCheckout(customerSession('ja').systemInstruction)).toBeNull();
  });

  it('never tells a customer at the till their total or their change: the cashier works those out', () => {
    const { systemInstruction } = customerSession('ja', 'B1', PAYS_CASH);
    expect(systemInstruction).not.toContain('¥800');
    expect(systemInstruction).toMatch(/never talk about prices, the total or your change/);
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

  it('tells a customer at the till what the cashier rang up, about their bag and points card, and the change they were given', () => {
    const { goods } = CULTURE_PACKS.en;
    const right = shiftCustomerServedScene(PAYS_CASH.order, true, CULTURE_PACKS.en, { bag: false, pointsCard: true, change: 8.4 });
    expect(right).toContain(`The cashier rings up: 2 × ${goods.eggs.name}, 1 × ${goods.vegetables.name}, 1 × ${goods.stamps.name}`);
    expect(right).toMatch(/no bag/);
    expect(right).toMatch(/scans your points card/);
    expect(right).toContain('£8.40 in change');
    expect(readServedScene(right)).toBe(true);

    const wrong = shiftCustomerServedScene(PAYS.order, false, CULTURE_PACKS.en, { bag: true, pointsCard: false, change: 0 });
    expect(wrong).toMatch(/puts your shopping in a bag/);
    expect(wrong).toMatch(/no points card/);
    expect(wrong).toMatch(/no change/);
    expect(readServedScene(wrong)).toBe(false);
  });

  it('says how the drink handed over was made', () => {
    const { drinkOptions } = CULTURE_PACKS.de;
    expect(shiftCustomerServedScene(ICED_TEA, true, CULTURE_PACKS.de)).toContain(`${drinkOptions.large.name}, ${drinkOptions.iced.name}, ${drinkOptions.lemon.name}`);
  });
});
