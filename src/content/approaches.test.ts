import { describe, expect, it } from 'vitest';
import { APPROACH_IDS } from '../sim/index.ts';
import { approachInteraction, INTERACTIONS, interactionStartedWithE, interactionStartedWithF } from './index.ts';

describe('NPCs who start conversations themselves', () => {
  it('opens the ward conversation with the nurse when the Character wakes from Fainting', () => {
    expect(approachInteraction('nurseOnWaking')).toBe(INTERACTIONS.wakeInWard);
  });

  it('keeps a conversation an NPC opens out of reach of E', () => {
    for (const approachId of APPROACH_IDS) {
      const interaction = approachInteraction(approachId);
      expect(interactionStartedWithE(interaction.npcId)).not.toBe(interaction);
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
