import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { buildNpcSession, NOT_UNDERSTOOD_TOOL, OUT_OF_PATIENCE_SCENE, type NpcSession, type ToolResponse } from '../ai/index.ts';
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
import {
  addUsage,
  NO_USAGE,
  openVoiceSession,
  VoiceServiceUnavailableError,
  type OpenVoiceSession,
  type TokenUsage,
  type ToolCall,
  type TranscriptLine,
  type VoiceSession,
} from '../voice/index.ts';

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

export type ChatLine = TranscriptLine;

/** A short notice over the game that clears itself. */
export type Toast = { kind: 'npcSteppedAway'; npcId: NamedNpcId };

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
  /** The line the NPC is partway through saying, which its next piece joins. */
  npcLine: number | null;
  /** The line showing what the NPC heard of the Player's current turn, which late pieces still join. */
  heardLine: number | null;
  /** Push-to-talk is held. */
  listening: boolean;
  /** The connection dropped and its one retry is connecting. */
  reconnecting: boolean;
  /** The one retry is used up: another connection failure is a network abandonment. */
  retried: boolean;
  /** Tokens spent so far, added up turn by turn. */
  usage: TokenUsage;
  /** Hidden. The UI only ever sees it as the NPC's expression. */
  patience: Patience;
  /** The outcome is applied; the session closes once the NPC finishes saying goodbye. */
  outcome: ClosingCard | null;
  /** The session is over and the closing card shows. */
  closed: boolean;
};

export type GameStoreDeps = {
  /** How a conversation reaches its NPC. In mock mode the gateway hands it the scripted fake NPC. */
  openVoiceSession: OpenVoiceSession;
};

export type GameStore = {
  game: GameState;
  tabHidden: boolean;
  interactable: Interactable | null;
  conversation: Conversation | null;
  /** The typed field has focus, so keys type into it instead of moving or acting. */
  typing: boolean;
  /** How loud the Player is while push-to-talk is held, from 0 to 1. */
  micLevel: number;
  toast: Toast | null;
  /** No token could be minted for a conversation, so the "Voice service unavailable" screen shows. */
  voiceUnavailable: boolean;
  /** Called once per rendered frame with the real time since the last one. */
  advance: (realDeltaMs: number) => void;
  setTabHidden: (hidden: boolean) => void;
  enterPlace: (placeId: PlaceId) => void;
  setInteractable: (interactable: Interactable | null) => void;
  drinkWater: () => void;
  /** E near an NPC: opens a conversation, and the NPC speaks first. */
  talk: () => void;
  sendTypedLine: (text: string) => void;
  /** Space or the mic button pressed: interrupts the NPC and listens. */
  startTalking: () => void;
  /** Space or the mic button released: the Player's turn is over. */
  stopTalking: () => void;
  /**
   * Esc or Leave. Before the outcome is decided, this abandons the conversation
   * at no cost. During the goodbye it skips to the closing card, and on the card it closes it.
   */
  leaveConversation: () => void;
  /** Closes the closing card without a Recap. */
  skipRecap: () => void;
  setTyping: (typing: boolean) => void;
  dismissToast: () => void;
  dismissVoiceUnavailable: () => void;
};

const isNpc = (interactable: Interactable | null): interactable is NamedNpcId =>
  interactable !== null && interactable in NAMED_NPCS;

export function createGameStore(initial: GameState, deps: GameStoreDeps = { openVoiceSession }) {
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
      updateConversation({ closed: true, npcLine: null, listening: false });
      set({ typing: false, micLevel: 0 });
    };

    /** Closes the session and clears the conversation away, with whatever else should show instead. */
    const dropConversation = (instead: Partial<Pick<GameStore, 'toast' | 'voiceUnavailable'>> = {}) => {
      closeSession();
      set({ conversation: null, typing: false, micLevel: 0, ...instead });
    };

    const endConversation = () => {
      const conversation = get().conversation;
      // Abandoning before the outcome is decided costs nothing.
      if (conversation && !conversation.outcome) {
        set({ game: applyInteractionOutcome(get().game, conversation.interaction, { kind: 'abandon' }).state });
      }
      dropConversation();
    };

    /** The Player can take a turn: the conversation is under way, connected, and not yet decided. */
    const canTakeTurn = (conversation: Conversation | null): conversation is Conversation =>
      conversation !== null && voice !== null && !conversation.outcome && !conversation.reconnecting;

    /** Adds a piece of a turn to the line it belongs to, or starts that line. Returns the line's index. */
    const addPiece = (lines: ChatLine[], index: number | null, speaker: ChatLine['speaker'], text: string) => {
      if (index === null) return { lines: [...lines, { speaker, text }], index: lines.length };
      const joined = lines.map((line, i) => (i === index ? { ...line, text: line.text + text } : line));
      return { lines: joined, index };
    };

    /**
     * Opens a session for the conversation. Every event from a session that has
     * since been closed or replaced is ignored.
     */
    const openSession = (npcSession: NpcSession, resumeFrom?: ChatLine[]) => {
      const live =
        <A extends unknown[]>(handle: (conversation: Conversation, ...args: A) => void) =>
        (...args: A) => {
          const conversation = get().conversation;
          if (voice === session && conversation) handle(conversation, ...args);
        };

      const session: VoiceSession = deps.openVoiceSession(
        npcSession,
        {
          onOutputTranscript: live((current, text: string) => {
            const { lines, index } = addPiece(current.lines, current.npcLine, 'npc', text);
            set({ conversation: { ...current, lines, npcLine: index } });
          }),
          onInputTranscript: live((current, text: string) => {
            const { lines, index } = addPiece(current.lines, current.heardLine, 'player', text);
            set({ conversation: { ...current, lines, heardLine: index } });
          }),
          onTurnComplete: live((current) => {
            // Once the outcome is decided, the turn that just ended was the goodbye.
            if (current.outcome) showClosingCard();
            else set({ conversation: { ...current, npcLine: null } });
          }),
          onToolCall: live((current, call: ToolCall) => session.sendToolResponse(call.id, answerToolCall(current, call))),
          onMicLevel: live((current, level: number) => {
            if (current.listening) set({ micLevel: level });
          }),
          onUsage: live((current, turn: TokenUsage) => set({ conversation: { ...current, usage: addUsage(current.usage, turn) } })),
          onDisconnect: live((current) => connectionFailed(current, npcSession)),
        },
        { resumeFrom },
      );
      voice = session;
      session.connect().then(
        live(() => updateConversation({ reconnecting: false })),
        live((current, error: unknown) => connectionFailed(current, npcSession, error)),
      );
    };

    /**
     * The session couldn't connect, or its connection dropped. With no token at
     * the start, voice can't work at all. Otherwise the game retries once with a
     * fresh session that carries on from the conversation so far, and a second
     * failure is a network abandonment: nothing is lost, and there's no Recap.
     */
    const connectionFailed = (conversation: Conversation, npcSession: NpcSession, error?: unknown) => {
      closeSession();
      if (conversation.outcome) return showClosingCard();
      if (!conversation.retried && error instanceof VoiceServiceUnavailableError) return dropConversation({ voiceUnavailable: true });
      if (conversation.retried) return dropConversation({ toast: { kind: 'npcSteppedAway', npcId: conversation.npcId } });
      set({
        micLevel: 0,
        conversation: { ...conversation, retried: true, reconnecting: true, listening: false, npcLine: null, heardLine: null },
      });
      openSession(npcSession, conversation.lines);
    };

    return {
      game: initial,
      tabHidden: false,
      interactable: null,
      conversation: null,
      typing: false,
      micLevel: 0,
      toast: null,
      voiceUnavailable: false,
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

        set({
          voiceUnavailable: false,
          conversation: {
            npcId: npc.id,
            interaction,
            lines: [],
            npcLine: null,
            heardLine: null,
            listening: false,
            reconnecting: false,
            retried: false,
            usage: NO_USAGE,
            patience: startPatience(game.proficiencyStep),
            outcome: null,
            closed: false,
          },
        });
        openSession(npcSession);
      },
      sendTypedLine: (text) => {
        const conversation = get().conversation;
        const line = text.trim();
        if (!canTakeTurn(conversation) || !voice || line === '') return;
        const turn: Conversation = {
          ...conversation,
          lines: [...conversation.lines, { speaker: 'player', text: line }],
          npcLine: null,
          heardLine: null,
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
      startTalking: () => {
        const conversation = get().conversation;
        if (!canTakeTurn(conversation) || !voice || conversation.listening) return;
        voice.startTalking();
        // A new turn: anything the NPC says next starts a new line, and so does what it hears.
        set({
          conversation: {
            ...conversation,
            listening: true,
            npcLine: null,
            heardLine: null,
            patience: newPlayerTurn(conversation.patience),
          },
        });
      },
      stopTalking: () => {
        const conversation = get().conversation;
        if (!conversation?.listening) return;
        voice?.stopTalking();
        set({ conversation: { ...conversation, listening: false }, micLevel: 0 });
      },
      leaveConversation: () => {
        const conversation = get().conversation;
        if (conversation?.outcome && !conversation.closed) showClosingCard();
        else endConversation();
      },
      skipRecap: () => endConversation(),
      setTyping: (typing) => set({ typing }),
      dismissToast: () => set({ toast: null }),
      dismissVoiceUnavailable: () => set({ voiceUnavailable: false }),
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
export const selectListening = (s: GameStore) => s.conversation?.listening ?? false;
export const selectMicLevel = (s: GameStore) => s.micLevel;
export const selectReconnecting = (s: GameStore) => s.conversation?.reconnecting ?? false;
export const selectConversationUsage = (s: GameStore) => s.conversation?.usage ?? NO_USAGE;
export const selectToast = (s: GameStore) => s.toast;
export const selectVoiceUnavailable = (s: GameStore) => s.voiceUnavailable;
/** The closing card, once the session is over. */
export const selectClosingCard = (s: GameStore) => (s.conversation?.closed ? s.conversation.outcome : null);
/** The NPC's face: Patience shows only like this, never as a number. */
export const selectNpcExpression = (s: GameStore): NpcExpression | null =>
  s.conversation ? npcExpression(s.conversation.patience) : null;
