import { describe, expect, it } from 'vitest';
import { APPROACH_IDS } from '../sim/index.ts';
import { approachInteraction, INTERACTIONS, interactionStartedWithE } from './index.ts';

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
});
