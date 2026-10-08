import { describe, expect, it } from 'vitest';
import { APPROACH_IDS, namedNpcOf } from '../sim/index.ts';
import { approachInteraction, INTERACTIONS, interactionStartedWithE, interactionStartedWithF, interactionStartedWithR } from './index.ts';

describe('NPCs who start conversations themselves', () => {
  it('opens the ward conversation with the nurse when the Character wakes from Fainting', () => {
    expect(approachInteraction('nurseOnWaking')).toBe(INTERACTIONS.wakeInWard);
  });

  it('keeps a conversation an NPC opens out of reach of E', () => {
    for (const approachId of APPROACH_IDS) {
      const interaction = approachInteraction(approachId);
      expect(interactionStartedWithE(namedNpcOf(interaction)!)).not.toBe(interaction);
    }
    expect(interactionStartedWithE('nurse')).toBeNull();
  });

  it('starts the barista’s order with E', () => {
    expect(interactionStartedWithE('barista')).toBe(INTERACTIONS.orderDrink);
  });

  it('starts paying at the cashier when the Character brings shopping, and asking where something is when not', () => {
    expect(interactionStartedWithE('cashier', { shopping: true })).toBe(INTERACTIONS.payForGroceries);
    expect(interactionStartedWithE('cashier', { shopping: false })).toBe(INTERACTIONS.findAnItem);
  });

  it('asks the cashier where something is with F when E would pay for shopping', () => {
    expect(interactionStartedWithF('cashier', { shopping: true })).toBe(INTERACTIONS.findAnItem);
    expect(interactionStartedWithF('cashier', { shopping: true, jobsHired: ['cashier'] })).toBe(INTERACTIONS.findAnItem);
  });

  it('asks the cashier for work with F, without shopping, until the Character is hired as a cashier', () => {
    expect(interactionStartedWithF('cashier', { shopping: false })).toBe(INTERACTIONS.askCashierForWork);
    expect(interactionStartedWithF('cashier', { shopping: false, jobsHired: ['barista'] })).toBe(INTERACTIONS.askCashierForWork);
    expect(interactionStartedWithF('cashier', { shopping: false, jobsHired: ['cashier'] })).toBeNull();
  });

  it('asks the barista for work with F until the Character is hired as a barista', () => {
    expect(interactionStartedWithF('barista')).toBe(INTERACTIONS.askBaristaForWork);
    expect(interactionStartedWithF('barista', { shopping: false, jobsHired: ['cashier'] })).toBe(INTERACTIONS.askBaristaForWork);
    expect(interactionStartedWithF('barista', { shopping: false, jobsHired: ['barista'] })).toBeNull();
  });

  it('never starts hiring with E: E at the barista orders a drink', () => {
    expect(interactionStartedWithE('barista', { shopping: false, jobsHired: [] })).toBe(INTERACTIONS.orderDrink);
  });

  it('opens a rent reminder or the Newcomer Discount news when the landlord catches the Character in the hallway', () => {
    expect(approachInteraction('landlordRentDue')).toBe(INTERACTIONS.rentReminder);
    expect(approachInteraction('landlordDiscountStepDown')).toBe(INTERACTIONS.newcomerDiscountNews);
  });

  it('pays the rent with E at the landlord, and asks for more time with F', () => {
    expect(interactionStartedWithE('landlord')).toBe(INTERACTIONS.payRent);
    expect(interactionStartedWithF('landlord')).toBe(INTERACTIONS.askForMoreTime);
  });

  it('starts the convenience store order with E at the clerk', () => {
    expect(interactionStartedWithE('convenience-clerk')).toBe(INTERACTIONS.buyCounterFood);
  });
});

describe('the barista at the café', () => {
  it.each([
    ['A1', INTERACTIONS.orderDrink],
    ['A2', INTERACTIONS.orderDrink],
    ['B1', INTERACTIONS.orderWithOptions],
    ['B2', INTERACTIONS.orderWithOptions],
    ['C1', INTERACTIONS.orderAvoidingAllergen],
    ['C2', INTERACTIONS.orderAvoidingAllergen],
  ] as const)('takes the order with E at %s by the band: a drink, then one made to order with food, then avoiding an allergen', (step, order) => {
    expect(interactionStartedWithE('barista', { shopping: false, step })).toBe(order);
  });

  it('still takes an application with F at any step, until the Character is a barista', () => {
    expect(interactionStartedWithF('barista', { shopping: false, step: 'C2' })).toBe(INTERACTIONS.askBaristaForWork);
  });
});

describe('the shopkeeper at the bookshop', () => {
  it('sells a book with E in the Beginner and Intermediate bands', () => {
    for (const step of ['A1', 'A2', 'B1', 'B2'] as const) {
      expect(interactionStartedWithE('shopkeeper', { shopping: false, step })).toBe(INTERACTIONS.buyABook);
    }
  });

  it('recommends a book by taste with E in the Advanced band', () => {
    for (const step of ['C1', 'C2'] as const) {
      expect(interactionStartedWithE('shopkeeper', { shopping: false, step })).toBe(INTERACTIONS.recommendABook);
    }
  });

  it('sells a gift with F, at any step', () => {
    expect(interactionStartedWithF('shopkeeper')).toBe(INTERACTIONS.buyAGift);
    expect(interactionStartedWithF('shopkeeper', { shopping: false, step: 'C2' })).toBe(INTERACTIONS.buyAGift);
  });
});

describe('the server at the restaurant', () => {
  const NO_TABLE = { seated: false, bill: [] };
  const SEATED = { seated: true, bill: [] };
  const EATEN = { seated: true, bill: [{ itemId: 'fish-dish' as const, quantity: 1, priceInShifts: 0.2 }] };

  it('gets a table with E, then takes the order, then the bill once anything is on it', () => {
    expect(interactionStartedWithE('server')).toBe(INTERACTIONS.getATable);
    expect(interactionStartedWithE('server', { shopping: false, restaurant: NO_TABLE })).toBe(INTERACTIONS.getATable);
    expect(interactionStartedWithE('server', { shopping: false, restaurant: SEATED })).toBe(INTERACTIONS.orderAMeal);
    expect(interactionStartedWithE('server', { shopping: false, restaurant: EATEN })).toBe(INTERACTIONS.payTheBill);
  });

  it('takes payment with E, and seats no one, while the Character owes for a bill they walked out on', () => {
    expect(interactionStartedWithE('server', { shopping: false, restaurant: NO_TABLE, owesRestaurant: true })).toBe(INTERACTIONS.payTheBill);
  });

  it('asks for a recommendation within a dietary restriction with F at the table, at any step', () => {
    for (const restaurant of [SEATED, EATEN]) {
      expect(interactionStartedWithF('server', { shopping: false, restaurant, step: 'A1' })).toBe(INTERACTIONS.recommendAMeal);
    }
  });

  it('asks the server for work with F away from a table, until the Character is hired as a server', () => {
    expect(interactionStartedWithF('server', { shopping: false, restaurant: NO_TABLE })).toBe(INTERACTIONS.askServerForWork);
    expect(interactionStartedWithF('server', { shopping: false, restaurant: NO_TABLE, jobsHired: ['server'] })).toBeNull();
  });
});

describe('the attendant at the bathhouse', () => {
  it('buys a bath with E, whatever the gym membership', () => {
    for (const gymMembership of ['none', 'active', 'expired'] as const) {
      expect(interactionStartedWithE('attendant', { shopping: false, gymMembership })).toBe(INTERACTIONS.buyBathEntry);
    }
  });

  it('joins the gym with F, renews it with F once it has run out, and has nothing on F while it runs', () => {
    expect(interactionStartedWithF('attendant', { shopping: false, gymMembership: 'none' })).toBe(INTERACTIONS.joinTheGym);
    expect(interactionStartedWithF('attendant', { shopping: false, gymMembership: 'expired' })).toBe(INTERACTIONS.renewGymMembership);
    expect(interactionStartedWithF('attendant', { shopping: false, gymMembership: 'active' })).toBeNull();
  });
});

describe('the clerk at the town office and post office', () => {
  it('sends a parcel with E', () => {
    expect(interactionStartedWithE('office-clerk')).toBe(INTERACTIONS.sendAParcel);
    expect(interactionStartedWithE('office-clerk', { shopping: false, addressRegistered: true })).toBe(INTERACTIONS.sendAParcel);
  });

  it('registers the Character’s address with F, until it is registered', () => {
    expect(interactionStartedWithF('office-clerk')).toBe(INTERACTIONS.registerAddress);
    expect(interactionStartedWithF('office-clerk', { shopping: false, addressRegistered: true })).toBeNull();
  });
});

describe('returning something to the supermarket', () => {
  it('starts with R at the cashier while the Character has something bought there to bring back, and nothing to pay for', () => {
    expect(interactionStartedWithR('cashier', { shopping: false, returnable: true })).toBe(INTERACTIONS.returnAnItem);
    expect(interactionStartedWithR('cashier', { shopping: true, returnable: true })).toBeNull();
    expect(interactionStartedWithR('cashier', { shopping: false, returnable: false })).toBeNull();
    expect(interactionStartedWithR('cashier')).toBeNull();
  });

  it('is only the cashier’s', () => {
    expect(interactionStartedWithR('barista', { shopping: false, returnable: true })).toBeNull();
  });
});
