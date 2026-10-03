import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { buildNpcSession } from '../ai/index.ts';
import { CULTURE_PACKS, INTERACTIONS, NAMED_NPCS, type NamedNpcId } from '../content/index.ts';
import {
  CLOCK,
  createSave,
  drinkWater,
  enterPlace,
  gameMinutesFor,
  tick,
  weekdayOf,
  type GameState,
  type NewGameSetup,
  type PlaceId,
} from '../sim/index.ts';
import { openMockVoiceSession, type OpenVoiceSession, type VoiceSession } from '../voice/index.ts';

/** The fixed setup every new game uses until New game setup lands (ticket 12). */
export const DEV_SETUP: NewGameSetup = {
  characterName: 'Sam',
  targetLanguage: 'ja',
  culturePackId: 'ja',
  startingStep: 'A1',
  appearancePresetId: 'preset-1',
  rngSeed: 20261003,
};

/** Something in the world the Character is close enough to use with E: the tap, or an NPC to talk to. */
export type Interactable = 'tap' | NamedNpcId;

export type ChatLine = { speaker: 'npc' | 'player'; text: string };

/** A conversation under way. It lives only here: it is never saved, and leaving it changes nothing. */
export type Conversation = {
  npcId: NamedNpcId;
  lines: ChatLine[];
  /** The NPC is partway through a turn, so the next piece it says joins its last line. */
  npcTurnOpen: boolean;
};

export type GameStoreDeps = {
  /** How a conversation reaches its NPC. Mock mode uses the scripted fake NPC. */
  openVoiceSession: OpenVoiceSession;
};

export type GameStore = {
  game: GameState;
  tabHidden: boolean;
  interactable: Interactable | null;
  conversation: Conversation | null;
  /** The typed field has focus, so keys type into it instead of moving or acting. */
  typing: boolean;
  /** Called once per rendered frame with the real time since the last one. */
  advance: (realDeltaMs: number) => void;
  setTabHidden: (hidden: boolean) => void;
  enterPlace: (placeId: PlaceId) => void;
  setInteractable: (interactable: Interactable | null) => void;
  drinkWater: () => void;
  /** E near an NPC: opens a conversation, and the NPC speaks first. */
  talk: () => void;
  sendTypedLine: (text: string) => void;
  /** Esc, Leave or walking away: ends the conversation at no cost. */
  leaveConversation: () => void;
  setTyping: (typing: boolean) => void;
};

const isNpc = (interactable: Interactable | null): interactable is NamedNpcId =>
  interactable !== null && interactable in NAMED_NPCS;

export function createGameStore(initial: GameState, deps: GameStoreDeps = { openVoiceSession: openMockVoiceSession }) {
  // The live session belongs to the open conversation; it never goes into state.
  let voice: VoiceSession | null = null;

  return createStore<GameStore>()((set, get) => ({
    game: initial,
    tabHidden: false,
    interactable: null,
    conversation: null,
    typing: false,
    advance: (realDeltaMs) => {
      const dt = gameMinutesFor(realDeltaMs, selectTimeScale(get()));
      if (dt > 0) set({ game: tick(get().game, dt) });
    },
    setTabHidden: (tabHidden) => set({ tabHidden }),
    // The world calls these every frame, so they only notify on a change.
    enterPlace: (placeId) => {
      const game = enterPlace(get().game, placeId);
      if (game !== get().game) set({ game });
    },
    setInteractable: (interactable) => {
      if (get().interactable === interactable) return;
      const { conversation } = get();
      if (conversation && interactable !== conversation.npcId) get().leaveConversation();
      set({ interactable });
    },
    drinkWater: () => set({ game: drinkWater(get().game) }),

    talk: () => {
      const { interactable, conversation, game } = get();
      if (conversation || !isNpc(interactable)) return;
      const npc = NAMED_NPCS[interactable];
      const interaction = Object.values(INTERACTIONS).find((i) => i.npcId === npc.id)!;
      const npcSession = buildNpcSession(interaction, CULTURE_PACKS[game.identity.culturePackId], game.proficiencyStep, npc, {
        clock: game.clock,
      });

      const session = deps.openVoiceSession(npcSession, {
        onOutputTranscript: (text) => {
          const current = get().conversation;
          if (voice !== session || !current) return;
          const lines = current.npcTurnOpen
            ? [...current.lines.slice(0, -1), { speaker: 'npc' as const, text: current.lines.at(-1)!.text + text }]
            : [...current.lines, { speaker: 'npc' as const, text }];
          set({ conversation: { ...current, lines, npcTurnOpen: true } });
        },
        onTurnComplete: () => {
          const current = get().conversation;
          if (voice !== session || !current) return;
          set({ conversation: { ...current, npcTurnOpen: false } });
        },
      });
      voice = session;
      set({ conversation: { npcId: npc.id, lines: [], npcTurnOpen: false } });
      // A session that can't connect ends the conversation at no cost. Ticket 05 adds the retry.
      session.connect().catch(() => {
        if (voice === session) get().leaveConversation();
      });
    },
    sendTypedLine: (text) => {
      const conversation = get().conversation;
      const line = text.trim();
      if (!conversation || !voice || line === '') return;
      set({
        conversation: {
          ...conversation,
          lines: [...conversation.lines, { speaker: 'player', text: line }],
          npcTurnOpen: false,
        },
      });
      voice.sendText(line);
    },
    leaveConversation: () => {
      voice?.close();
      voice = null;
      set({ conversation: null, typing: false });
    },
    setTyping: (typing) => set({ typing }),
  }));
}

export const gameStore = createGameStore(createSave(DEV_SETUP));

/** Reads the game store from React. Pass one of the selectors below. */
export function useGame<T>(selector: (state: GameStore) => T): T {
  return useStore(gameStore, selector);
}

// --- Selectors: the only way world and UI read game state -------------------

export const selectTimeScale = (s: GameStore) => {
  if (s.tabHidden) return CLOCK.timeScale.paused;
  return s.conversation ? CLOCK.timeScale.conversation : CLOCK.timeScale.normal;
};
export const selectHealth = (s: GameStore) => s.game.character.health;
export const selectHunger = (s: GameStore) => s.game.character.hunger;
export const selectThirst = (s: GameStore) => s.game.character.thirst;
export const selectMood = (s: GameStore) => s.game.character.mood;
export const selectMoneyInShifts = (s: GameStore) => s.game.character.moneyInShifts;
export const selectCulturePackId = (s: GameStore) => s.game.identity.culturePackId;
export const selectDay = (s: GameStore) => s.game.clock.day;
export const selectWeekday = (s: GameStore) => weekdayOf(s.game.clock.day);
/** Whole game minutes since midnight, so the clock re-renders once a game minute. */
export const selectClockMinute = (s: GameStore) => Math.floor(s.game.clock.minuteOfDay);
export const selectPlaceId = (s: GameStore) => s.game.placeId;
export const selectInteractable = (s: GameStore) => s.interactable;
export const selectConversation = (s: GameStore) => s.conversation;
const NO_LINES: readonly ChatLine[] = [];
export const selectChatLines = (s: GameStore) => s.conversation?.lines ?? NO_LINES;
export const selectTyping = (s: GameStore) => s.typing;
