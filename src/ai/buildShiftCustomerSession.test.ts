import { describe, expect, it } from 'vitest';
import { CULTURE_PACKS } from '../content/index.ts';
import { LANGUAGE_CODES, PROFICIENCY_STEPS, type LanguageCode, type ProficiencyStep, type ShiftCustomer } from '../sim/index.ts';
import { buildShiftCustomerSession, NOT_UNDERSTOOD_TOOL, readShiftOrder, shiftCustomerServedScene } from './index.ts';

const MID_MORNING = { day: 3, minuteOfDay: 10 * 60 + 20 };
const WANTS_A_LATTE: ShiftCustomer = { order: [{ itemId: 'latte', quantity: 1 }], voiceSeed: 4242 };

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
});
