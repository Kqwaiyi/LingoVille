import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { buildNpcSession, NOT_UNDERSTOOD_TOOL, OUT_OF_PATIENCE_SCENE, type ToolResponse } from '../ai/index.ts';
import { CULTURE_PACKS, INTERACTIONS, NAMED_NPCS, type Interaction, type NamedNpcId } from '../content/index.ts';
import {
  applyInteractionOutcome,
  CLOCK,
  createSave,
  drinkWater,
  enterPlace,
  gameMinutesFor,
  isOutOfPatience,
  isUnreadableTranscript,
  losePatience,
  newPlayerTurn,
  npcExpression,
  startPatience,
  tick,
  weekdayOf,
  type GameState,
  type NewGameSetup,
  type NpcExpression,
  type OutcomeResult,
  type Patience,
  type PlaceId,
} from '../sim/index.ts';
import { openMockVoiceSession, type OpenVoiceSession, type ToolCall, type VoiceSession } from '../voice/index.ts';

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

/** How a Goal Interaction ended, and its effects, for the closing card. */
export type ClosingCard = Extract<OutcomeResult, { kind: 'success' | 'failure' }>;

/**
 * A conversation under way. It lives only here: it is never saved, and leaving
 * before the outcome is decided changes nothing.
 */
export type Conversation = {
  npcId: NamedNpcId;
  interaction: Interaction;
  lines: ChatLine[];
  /** The NPC is partway through a turn, so the next piece it says joins its last line. */
  npcTurnOpen: boolean;
  /** Hidden. The UI only ever sees it as the NPC's expression. */
  patience: Patience;
  /** The outcome is applied; the session closes once the NPC finishes saying goodbye. */
  outcome: ClosingCard | null;
  /** The session is over and the closing card shows. */
  closed: boolean;
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
  /**
   * Esc or Leave. Before the outcome is decided, this abandons the conversation
   * at no cost. During the goodbye it skips to the closing card, and on the card it closes it.
   */
  leaveConversation: () => void;
  /** Closes the closing card without a Recap. */
  skipRecap: () => void;
  setTyping: (typing: boolean) => void;
};

const isNpc = (interactable: Interactable | null): interactable is NamedNpcId =>
  interactable !== null && interactable in NAMED_NPCS;

export function createGameStore(initial: GameState, deps: GameStoreDeps = { openVoiceSession: openMockVoiceSession }) {
  // The live session belongs to the open conversation; it never goes into state.
  let voice: VoiceSession | null = null;

  return createStore<GameStore>()((set, get) => {
    const updateConversation = (change: Partial<Conversation>) => {
      const conversation = get().conversation;
      if (conversation) set({ conversation: { ...conversation, ...change } });
    };

    /** The outcome is decided and applied. The NPC says goodbye next, then the closing card shows. */
    const settleOutcome = (game: GameState, outcome: ClosingCard) => {
      set({ game });
      updateConversation({ outcome });
    };

    /**
     * The NPC couldn't make sense of the Player's latest turn. Running out fails
     * the interaction. Returns whether the NPC is now out of Patience.
     */
    const notUnderstood = (conversation: Conversation) => {
      if (conversation.outcome) return isOutOfPatience(conversation.patience);
      const patience = losePatience(conversation.patience);
      updateConversation({ patience });
      if (!isOutOfPatience(patience)) return false;
      const { state, result } = applyInteractionOutcome(get().game, conversation.interaction, { kind: 'failure' });
      if (result.kind === 'failure') settleOutcome(state, result);
      return true;
    };

    const answerToolCall = (conversation: Conversation, { name, args }: ToolCall): ToolResponse => {
      if (name === NOT_UNDERSTOOD_TOOL) return { result: notUnderstood(conversation) ? 'out_of_patience' : 'noted' };
      if (name !== conversation.interaction.completion.name || conversation.outcome) return { result: 'unknown_tool' };

      const { state, result } = applyInteractionOutcome(get().game, conversation.interaction, { kind: 'success', args });
      switch (result.kind) {
        case 'success':
          settleOutcome(state, result);
          return { result: 'served' };
        case 'cannot_afford':
          return { result: 'cannot_afford' };
        case 'invalid_arguments':
          return { result: 'invalid_arguments', error: result.error };
        default:
          throw new Error(`A completion can't end as ${result.kind}`);
      }
    };

    const closeSession = () => {
      voice?.close();
      voice = null;
    };

    const showClosingCard = () => {
      closeSession();
      updateConversation({ closed: true, npcTurnOpen: false });
      set({ typing: false });
    };

    const endConversation = () => {
      const conversation = get().conversation;
      // Abandoning before the outcome is decided costs nothing.
      if (conversation && !conversation.outcome) {
        set({ game: applyInteractionOutcome(get().game, conversation.interaction, { kind: 'abandon' }).state });
      }
      closeSession();
      set({ conversation: null, typing: false });
    };

    return {
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
        // Walking away is like Leave: no cost before the outcome, the closing card after it.
        if (conversation && !conversation.closed && interactable !== conversation.npcId) get().leaveConversation();
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
            // Once the outcome is decided, the turn that just ended was the goodbye.
            if (current.outcome) showClosingCard();
            else set({ conversation: { ...current, npcTurnOpen: false } });
          },
          onToolCall: (call) => {
            const current = get().conversation;
            if (voice !== session || !current) return;
            session.sendToolResponse(call.id, answerToolCall(current, call));
          },
        });
        voice = session;
        set({
          conversation: {
            npcId: npc.id,
            interaction,
            lines: [],
            npcTurnOpen: false,
            patience: startPatience(game.proficiencyStep),
            outcome: null,
            closed: false,
          },
        });
        // A session that can't connect ends the conversation at no cost. Ticket 05 adds the retry.
        session.connect().catch(() => {
          if (voice === session) get().leaveConversation();
        });
      },
      sendTypedLine: (text) => {
        const conversation = get().conversation;
        const line = text.trim();
        if (!conversation || !voice || conversation.outcome || line === '') return;
        const turn: Conversation = {
          ...conversation,
          lines: [...conversation.lines, { speaker: 'player', text: line }],
          npcTurnOpen: false,
          patience: newPlayerTurn(conversation.patience),
        };
        set({ conversation: turn });
        // The backstop: a turn with nothing to make sense of costs Patience whatever the NPC does.
        if (isUnreadableTranscript(line) && notUnderstood(turn)) {
          voice.sendText(OUT_OF_PATIENCE_SCENE);
          return;
        }
        voice.sendText(line);
      },
      leaveConversation: () => {
        const conversation = get().conversation;
        if (conversation?.outcome && !conversation.closed) showClosingCard();
        else endConversation();
      },
      skipRecap: () => endConversation(),
      setTyping: (typing) => set({ typing }),
    };
  });
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
/** The closing card, once the session is over. */
export const selectClosingCard = (s: GameStore) => (s.conversation?.closed ? s.conversation.outcome : null);
/** The NPC's face: Patience shows only like this, never as a number. */
export const selectNpcExpression = (s: GameStore): NpcExpression | null =>
  s.conversation ? npcExpression(s.conversation.patience) : null;
