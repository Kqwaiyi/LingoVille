import { describe, expect, it } from 'vitest';
import { CULTURE_PACKS, INTERACTIONS, NAMED_NPCS, type Interaction } from '../content/index.ts';
import {
  CLOCK,
  FAMILIARITY,
  LANGUAGE_CODES,
  PROFICIENCY_STEPS,
  type ApproachId,
  type LanguageCode,
  type NpcMemory,
  type ProficiencyStep,
  type RentStatement,
} from '../sim/index.ts';
import { buildNpcSession, buildSmallTalkSession, GREETING_SCENE, LEARN_NAME_TOOL, WRAP_UP_SCENE } from './index.ts';

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

    expect(tools.map((tool) => tool.name)).toEqual(['serve_order', LEARN_NAME_TOOL, 'not_understood']);
    expect(tools[0]).toEqual(INTERACTIONS.orderDrink.toolDeclaration);
  });

  it('plays the persona as the pack localises it: the local name and the local favourite gift', () => {
    const de = nurseSession('de').systemInstruction;
    const ja = nurseSession('ja').systemInstruction;

    expect(de).toContain('You are Petra, the nurse');
    expect(de).toContain('a tin of herbal tea');
    expect(ja).toContain('You are 高橋, the nurse');
    expect(ja).toContain('a tin of green tea');
    expect(ja).not.toContain('herbal');
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

  it('offers discharge_patient, learn_name and not_understood as tools', () => {
    expect(nurseSession('zh').tools.map((tool) => tool.name)).toEqual(['discharge_patient', LEARN_NAME_TOOL, 'not_understood']);
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
    expect(tools.map((tool) => tool.name)).toEqual(['complete_purchase', LEARN_NAME_TOOL, 'not_understood']);
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
    expect(tools.map((tool) => tool.name)).toEqual(['point_to', LEARN_NAME_TOOL, 'not_understood']);
  });

  it('says the convenience store never closes', () => {
    expect(counterSession('ja').systemInstruction).toContain('ニコニコマート is open 24 hours.');
  });
});

describe('buildNpcSession: the bookshop', () => {
  const MORNING = { day: 2, minuteOfDay: 11 * 60 };
  const shopkeeperSession = (interaction: Interaction, packId: LanguageCode, step: ProficiencyStep = 'A1') =>
    buildNpcSession(interaction, CULTURE_PACKS[packId], step, NAMED_NPCS.shopkeeper, { clock: MORNING });

  it.each(LANGUAGE_CODES)('builds the shopkeeper selling a book, a gift and a recommendation in the %s pack', (packId) => {
    expect(shopkeeperSession(INTERACTIONS.buyABook, packId)).toMatchSnapshot();
    expect(shopkeeperSession(INTERACTIONS.buyAGift, packId, 'B1')).toMatchSnapshot();
    expect(shopkeeperSession(INTERACTIONS.recommendABook, packId, 'C1')).toMatchSnapshot();
  });

  it('works at the bookshop by its local name, selling through complete_purchase', () => {
    const { systemInstruction, tools } = shopkeeperSession(INTERACTIONS.buyABook, 'en');
    expect(systemInstruction).toContain('The Book Nook');
    expect(systemInstruction).toContain('For sale: Crime novel, £15 (menu id "mystery-novel")');
    expect(tools.map((tool) => tool.name)).toEqual(['complete_purchase', LEARN_NAME_TOOL, 'not_understood']);
  });

  it('has the shopkeeper ask about wrapping a gift, and recommend by taste', () => {
    expect(shopkeeperSession(INTERACTIONS.buyAGift, 'de').systemInstruction).toMatch(/gift-wrapped/);
    expect(shopkeeperSession(INTERACTIONS.recommendABook, 'de', 'C1').systemInstruction).toMatch(/recommend.*taste/);
  });
});

describe('buildNpcSession: the landlord', () => {
  // Day 7, a Sunday: this week's rent of 1 Shift is due today, with 0.5 owed from before.
  const RENT: RentStatement = { today: 7, dueDay: 7, owedThisWeekInShifts: 1, debtInShifts: 0.5, weeklyRentInShifts: 1.2 };
  const HALLWAY_MORNING = { day: 7, minuteOfDay: 9 * 60 };

  function landlordSession(interaction: Interaction, packId: LanguageCode, approach?: ApproachId) {
    return buildNpcSession(interaction, CULTURE_PACKS[packId], 'A2', NAMED_NPCS.landlord, {
      clock: HALLWAY_MORNING,
      rent: RENT,
      ...(approach && { approach }),
    });
  }

  it.each(LANGUAGE_CODES)('builds the session for paying rent in the %s pack', (packId) => {
    expect(landlordSession(INTERACTIONS.payRent, packId)).toMatchSnapshot();
  });

  it('tells the landlord what the tenant owes, in local money and as accept_rent’s plain number', () => {
    const { systemInstruction } = landlordSession(INTERACTIONS.payRent, 'ja');
    expect(systemInstruction).toContain("This week's rent still to pay: ¥6,000, due by the end of today.");
    expect(systemInstruction).toContain('Unpaid rent from before, owed now: ¥3,000.');
    expect(systemInstruction).toContain('Altogether the tenant owes ¥9,000 (for accept_rent: 9000).');
  });

  it('speaks of a tenant, not a customer', () => {
    const { systemInstruction, openingScene } = landlordSession(INTERACTIONS.askForMoreTime, 'en');
    expect(openingScene).toBe('[SCENE: A tenant walks up to you. Greet them first.]');
    expect(systemInstruction).not.toMatch(/customer/i);
    expect(systemInstruction).toContain('tenant');
    expect(systemInstruction).toContain('Rosewood House');
  });

  it('offers accept_rent, or grant_extension for more time', () => {
    expect(landlordSession(INTERACTIONS.payRent, 'de').tools.map((tool) => tool.name)).toEqual(['accept_rent', LEARN_NAME_TOOL, 'not_understood']);
    expect(landlordSession(INTERACTIONS.askForMoreTime, 'de').tools.map((tool) => tool.name)).toEqual(['grant_extension', LEARN_NAME_TOOL, 'not_understood']);
  });

  it('catches the tenant in the hallway, speaking first, when rent is due', () => {
    const { openingScene } = landlordSession(INTERACTIONS.rentReminder, 'zh', 'landlordRentDue');
    expect(openingScene).not.toBe(GREETING_SCENE);
    expect(openingScene).toMatch(/^\[SCENE: .*hallway.*rent.*\]$/);
  });

  it.each(LANGUAGE_CODES)('announces a Newcomer Discount step-down with the new weekly rent, never a percentage, in the %s pack', (packId) => {
    const session = landlordSession(INTERACTIONS.newcomerDiscountNews, packId, 'landlordDiscountStepDown');
    expect(session).toMatchSnapshot();
    expect(session.openingScene).toMatch(/hallway/);
    expect(session.systemInstruction).toMatch(/Never speak of percentages/);
    expect(session.systemInstruction).not.toMatch(/\d+\s?%/);
  });

  it('gives the new weekly rent', () => {
    const { systemInstruction } = landlordSession(INTERACTIONS.newcomerDiscountNews, 'en', 'landlordDiscountStepDown');
    expect(systemInstruction).toContain("From now on the tenant's weekly rent is £72.");
  });
});

describe('buildNpcSession: asking the barista for work', () => {
  const hiringSession = (packId: LanguageCode) =>
    buildNpcSession(INTERACTIONS.askBaristaForWork, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.barista, { clock: FIRST_MORNING_CLOCK });

  it.each(LANGUAGE_CODES)('builds the hiring session in the %s pack', (packId) => {
    expect(hiringSession(packId)).toMatchSnapshot();
  });

  it('offers hire_applicant and not_understood as tools', () => {
    expect(hiringSession('ja').tools.map((tool) => tool.name)).toEqual(['hire_applicant', 'not_understood']);
  });

  it('lets the barista ask the applicant’s name, which a customer is never asked', () => {
    const { systemInstruction } = hiringSession('en');
    expect(systemInstruction).not.toMatch(/don't ask for it/);
    expect(systemInstruction).toMatch(/ask their name/);
  });

  it('has the barista ask the name again when it was misheard', () => {
    expect(hiringSession('de').systemInstruction).toMatch(/"wrong_name".*again/);
  });
});

describe('buildNpcSession: the restaurant', () => {
  const LUNCHTIME = { day: 3, minuteOfDay: 12 * 60 };
  const hiringSession = (packId: LanguageCode) =>
    buildNpcSession(INTERACTIONS.askServerForWork, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.server, { clock: LUNCHTIME });

  it.each(LANGUAGE_CODES)('builds the server taking an application for work in the %s pack', (packId) => {
    expect(hiringSession(packId)).toMatchSnapshot();
  });

  const BILL = [
    { itemId: 'veggie-dish', quantity: 1 },
    { itemId: 'juice', quantity: 1 },
  ] as const;
  const guestSessions = (packId: LanguageCode) => ({
    table: buildNpcSession(INTERACTIONS.getATable, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.server, { clock: LUNCHTIME }),
    order: buildNpcSession(INTERACTIONS.orderAMeal, CULTURE_PACKS[packId], 'B1', NAMED_NPCS.server, { clock: LUNCHTIME }),
    recommend: buildNpcSession(INTERACTIONS.recommendAMeal, CULTURE_PACKS[packId], 'C1', NAMED_NPCS.server, { clock: LUNCHTIME }),
    bill: buildNpcSession(INTERACTIONS.payTheBill, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.server, { clock: LUNCHTIME, bill: BILL }),
  });

  it.each(LANGUAGE_CODES)('builds the server seating a guest, taking an order, recommending within a diet and taking the bill in the %s pack', (packId) => {
    expect(guestSessions(packId)).toMatchSnapshot();
  });

  it('offers seat_guest, serve_order (with the dietary need for a recommendation) and settle_bill', () => {
    const { table, order, recommend, bill } = guestSessions('en');
    expect([table, order, recommend, bill].map(({ tools }) => tools[0]!.name)).toEqual(['seat_guest', 'serve_order', 'serve_order', 'settle_bill']);
    expect(recommend.tools[0]!.parameters.required).toContain('restriction');
    expect(recommend.systemInstruction).toContain('has meat and pork in it');
    expect(bill.systemInstruction).toMatch(/Bill total: £/);
  });

  it('has the server work at the restaurant by its local name, and hire with the name check', () => {
    const { systemInstruction, tools } = hiringSession('ja');
    expect(systemInstruction).toContain(`${CULTURE_PACKS.ja.restaurant.name}, a restaurant`);
    expect(systemInstruction).toMatch(/ask for work as a server/);
    expect(tools.map((tool) => tool.name)).toEqual(['hire_applicant', 'not_understood']);
  });
});

const STRANGER: NpcMemory = {
  familiarity: 0,
  todaysGain: { day: 1, amount: 0 },
  timesMet: 0,
  knowsName: false,
  usualOrder: null,
  lastTopic: null,
  favouriteKnown: false,
  lastGiftDay: null,
  registerOffered: false,
};
const FRIEND: NpcMemory = {
  ...STRANGER,
  familiarity: FAMILIARITY.tierThresholds.friend,
  timesMet: 14,
  knowsName: true,
  lastTopic: 'their trip to the seaside',
  favouriteKnown: true,
};

function youAndThisPerson(systemInstruction: string) {
  return systemInstruction.slice(systemInstruction.indexOf('YOU AND THIS PERSON'), systemInstruction.indexOf('LANGUAGE RULES'));
}

function baristaWho(memory: NpcMemory) {
  return buildNpcSession(INTERACTIONS.orderDrink, CULTURE_PACKS.en, 'B1', NAMED_NPCS.barista, {
    clock: FIRST_MORNING_CLOCK,
    relationship: { memory, characterName: 'Sam' },
  }).systemInstruction;
}

describe('buildNpcSession: you and this person', () => {
  it('treats a stranger as one', () => {
    expect(youAndThisPerson(baristaWho(STRANGER))).toMatchSnapshot();
  });

  it('treats a friend as one, by name, following up on the last topic', () => {
    expect(youAndThisPerson(baristaWho(FRIEND))).toMatchSnapshot();
  });

  it('is the stranger default with no NPC Memory', () => {
    const none = buildNpcSession(INTERACTIONS.orderDrink, CULTURE_PACKS.en, 'B1', NAMED_NPCS.barista, { clock: FIRST_MORNING_CLOCK });

    expect(youAndThisPerson(none.systemInstruction)).toBe(youAndThisPerson(baristaWho(STRANGER)));
  });

  it('greets the Character by name from acquaintance up, once the name is known', () => {
    const acquaintance = { ...STRANGER, familiarity: FAMILIARITY.tierThresholds.acquaintance };

    expect(youAndThisPerson(baristaWho({ ...acquaintance, knowsName: true }))).toMatch(/by name: Sam/);
    expect(youAndThisPerson(baristaWho(acquaintance))).not.toContain('Sam');
    expect(youAndThisPerson(baristaWho({ ...STRANGER, knowsName: true }))).not.toMatch(/by name/);
  });

  it('follows up on the last topic only from acquaintance up', () => {
    const topic = { ...STRANGER, lastTopic: 'the rain' };

    expect(baristaWho({ ...topic, familiarity: FAMILIARITY.tierThresholds.acquaintance })).toContain('the rain');
    expect(baristaWho(topic)).not.toContain('the rain');
  });

  it('asks the NPC to call learn_name when they are told the name they did not know', () => {
    expect(youAndThisPerson(baristaWho(STRANGER))).toContain(LEARN_NAME_TOOL);
    expect(youAndThisPerson(baristaWho(FRIEND))).not.toContain(LEARN_NAME_TOOL);
  });

  it("has someone the NPC knows ask their name when hiring, with no learn_name to call", () => {
    const acquaintance = { ...STRANGER, familiarity: FAMILIARITY.tierThresholds.acquaintance };
    const { systemInstruction } = buildNpcSession(INTERACTIONS.askBaristaForWork, CULTURE_PACKS.en, 'A1', NAMED_NPCS.barista, {
      clock: FIRST_MORNING_CLOCK,
      relationship: { memory: acquaintance, characterName: 'Sam' },
    });

    expect(youAndThisPerson(systemInstruction)).toContain('asking for it is part of hiring them');
    expect(systemInstruction).not.toContain(LEARN_NAME_TOOL);
  });

  it("doesn't offer learn_name when hiring, which takes the name itself", () => {
    const { tools } = buildNpcSession(INTERACTIONS.askBaristaForWork, CULTURE_PACKS.en, 'A1', NAMED_NPCS.barista, {
      clock: FIRST_MORNING_CLOCK,
    });

    expect(tools.map((tool) => tool.name)).not.toContain(LEARN_NAME_TOOL);
  });
});

function smallTalk(npcId: keyof typeof NAMED_NPCS, memory: NpcMemory = STRANGER, packId: LanguageCode = 'en') {
  return buildSmallTalkSession(CULTURE_PACKS[packId], 'A2', NAMED_NPCS[npcId], {
    clock: FIRST_MORNING_CLOCK,
    relationship: { memory, characterName: 'Sam' },
  });
}

describe('buildSmallTalkSession', () => {
  it('builds Small Talk with a park regular who is a stranger', () => {
    expect(smallTalk('park-regular-1')).toMatchSnapshot();
  });

  it('builds Small Talk with a barista who is a friend', () => {
    expect(smallTalk('barista', FRIEND, 'ja')).toMatchSnapshot();
  });

  it('has no completion function: only learn_name and not_understood', () => {
    expect(smallTalk('barista').tools.map((tool) => tool.name)).toEqual([LEARN_NAME_TOOL, 'not_understood']);
  });

  it('points a stated goal to the counter instead of switching to it', () => {
    expect(smallTalk('barista').systemInstruction).toMatch(/come to the counter/);
  });

  it('wraps up only when a scene says so', () => {
    expect(smallTalk('park-regular-2').systemInstruction).toMatch(/Don't end the chat yourself/);
    expect(WRAP_UP_SCENE).toMatch(/^\[SCENE: .*goodbye.*\]$/);
  });

  it('meets every Named NPC where they are, by its local name', () => {
    for (const npcId of Object.keys(NAMED_NPCS) as (keyof typeof NAMED_NPCS)[]) expect(() => smallTalk(npcId)).not.toThrow();
    expect(smallTalk('park-regular-1').systemInstruction).toContain('one of the regulars at Victoria Park');
    expect(smallTalk('doctor').systemInstruction).not.toContain('ward');
  });

  it('opens with the Character walking up, so the NPC speaks first', () => {
    expect(smallTalk('shopkeeper').openingScene).toMatch(/^\[SCENE: /);
  });
});
