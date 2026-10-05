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

  it('asks the cashier where something is with F, only when E would pay for shopping', () => {
    expect(interactionStartedWithF('cashier', { shopping: true })).toBe(INTERACTIONS.findAnItem);
    expect(interactionStartedWithF('cashier', { shopping: false })).toBeNull();
    expect(interactionStartedWithF('barista')).toBeNull();
  });

  it('starts the convenience store order with E at the clerk', () => {
    expect(interactionStartedWithE('convenience-clerk')).toBe(INTERACTIONS.buyCounterFood);
  });
});
