import type { NamedNpcId } from '../content/index.ts';
import type { GameState, NpcMemory } from './state.ts';

/** What a Named NPC remembers of the Character: their record, or a stranger's if they have none yet. */
export function memoryOf(state: GameState, npcId: NamedNpcId): NpcMemory {
  return (
    state.people[npcId] ?? {
      familiarity: 0,
      todaysGain: { day: state.clock.day, amount: 0 },
      timesMet: 0,
      knowsName: false,
      usualOrder: null,
      lastTopic: null,
      favouriteKnown: false,
      lastGiftDay: null,
      registerOffered: false,
    }
  );
}

/** A conversation with this Named NPC has finished: they have met the Character once more. */
export function metNpc(state: GameState, npcId: NamedNpcId): GameState {
  const memory = memoryOf(state, npcId);
  return { ...state, people: { ...state.people, [npcId]: { ...memory, timesMet: memory.timesMet + 1 } } };
}
