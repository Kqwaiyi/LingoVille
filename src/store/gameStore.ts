import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import {
  buildNpcSession,
  NOT_UNDERSTOOD_TOOL,
  OUT_OF_PATIENCE_SCENE,
  type NpcSession,
  type Recap,
  type RecapRequest,
  type ToolResponse,
} from '../ai/index.ts';
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
  SAVE,
  startPatience,
  tick,
  weekdayOf,
  type GameState,
  type LanguageCode,
  type NewGameSetup,
  type NpcExpression,
  type OutcomeResult,
  type Patience,
  type PlaceId,
} from '../sim/index.ts';
import {
  addUsage,
  hearItSaid,
  NO_USAGE,
  openVoiceSession,
  VoiceServiceUnavailableError,
  type OpenVoiceSession,
  type TokenUsage,
  type HearItSaid,
  type ToolCall,
  type TranscriptLine,
  type VoiceSession,
} from '../voice/index.ts';
import { browserDeviceSettings, type DeviceSettingsStore } from './deviceSettings.ts';
import { browserJournal, journalPage, type Journal, type JournalEntry, type JournalPage, type NewJournalEntry } from './journal.ts';
import { browserSaves, type Save, type Saves } from './saves.ts';

/** The fixed setup every new game uses until New game setup lands (ticket 12). */
export const DEV_SETUP: NewGameSetup = {
  characterName: 'Sam',
  targetLanguage: 'ja',
  culturePackId: 'ja',
  startingStep: 'A1',
  appearancePresetId: 'preset-1',
  rngSeed: 20261003,
};

/** The Native Language until this browser's device settings are read. */
export const DEV_NATIVE_LANGUAGE: LanguageCode = 'en';

/** The 4 save slots. New game takes the first free one until the slot cards land (ticket 08). */
export const SLOT_IDS = ['slot-1', 'slot-2', 'slot-3', 'slot-4'] as const;

/** Which screen shows: the title, or the game itself. */
export type Screen = 'title' | 'playing';

/** What the title screen can offer, once it has looked for saves. */
export type TitleView =
  | { status: 'checking' }
  | { status: 'ready'; canContinue: boolean; canStartNew: boolean }
  | { status: 'failed'; message: string; canStartNew: boolean };

/** How the Character arrived in the world: the First Morning, or back from a save. The world picks the spawn point from it. */
export type Arrival = 'newGame' | 'continued';

/** Something in the world the Character is close enough to use with E: the tap, or an NPC to talk to. */
export type Interactable = 'tap' | NamedNpcId;

/** A line of the conversation. A typed player line is marked, so the Recap knows it wasn't misheard. */
export type ChatLine = TranscriptLine & { typed?: true };

/** A short notice over the game that clears itself. */
export type Toast = { kind: 'npcSteppedAway'; npcId: NamedNpcId } | { kind: 'recapSaved' };

/** The Recap in the conversation column: being written, ready as a Journal page, or not to be had. */
export type RecapView = { status: 'writing' } | { status: 'ready'; entry: JournalPage } | { status: 'failed' };

/** The full-screen Journal: its entries, newest first, or null while they load. */
export type JournalView = { entries: JournalEntry[] | null; failed: boolean };

/** How a Goal Interaction ended, and its effects, for the closing card. */
export type ClosingCard = Extract<OutcomeResult, { kind: 'success' | 'failure' }>;

/**
 * A conversation under way. It lives only here: it is never saved, and leaving
 * before the outcome is decided changes nothing.
 */
export type Conversation = {
  /** Tells this conversation apart from later ones, so a late Recap only lands where it belongs. */
  id: number;
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
  /** Started as soon as the session is over, if the outcome was decided. */
  recap: RecapView | null;
  /** See Recap was chosen: the Recap shows in the column instead of the chat. */
  showingRecap: boolean;
};

export type GameStoreDeps = {
  /** How a conversation reaches its NPC. In mock mode the gateway hands it the scripted fake NPC. */
  openVoiceSession: OpenVoiceSession;
  /** Asks the gateway for a Recap. Rejects if none can be written. */
  requestRecap: (request: RecapRequest) => Promise<Recap>;
  journal: Journal;
  saves: Saves;
  deviceSettings: DeviceSettingsStore;
  hearItSaid: HearItSaid;
};

async function requestRecapFromGateway(request: RecapRequest): Promise<Recap> {
  const res = await fetch('/api/recap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`No Recap: the gateway answered ${res.status}`);
  return (await res.json()) as Recap;
}

const BROWSER_DEPS: GameStoreDeps = {
  openVoiceSession,
  requestRecap: requestRecapFromGateway,
  journal: browserJournal,
  saves: browserSaves,
  deviceSettings: browserDeviceSettings,
  hearItSaid,
};

export type GameStore = {
  screen: Screen;
  /** The title screen, while it shows. */
  title: TitleView | null;
  arrival: Arrival;
  /** The slot the game is saved into. */
  slotId: string;
  /** How many saves have finished, so the dock can flash "Saved ✓" on each one. */
  savedCount: number;
  game: GameState;
  /** The Player's own language, which Recaps are written in. */
  nativeLanguage: LanguageCode;
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
  /** The full-screen Journal, while it is open. */
  journal: JournalView | null;
  /** Looks for saves and reads this browser's device settings, for the title screen. */
  openTitle: () => void;
  /** Continue: plays the most recently played save. */
  continueGame: () => void;
  /** New game: the First Morning, from the fixed dev setup until New game setup lands (ticket 12). */
  newGame: () => void;
  /** Saves now, as the page is closed. */
  saveNow: () => void;
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
  /** Closes the closing card without showing the Recap. It is still saved to the Journal. */
  skipRecap: () => void;
  /** Shows the Recap in the column, or its loading state until it arrives. */
  seeRecap: () => void;
  /** Done: closes the Recap and the conversation. */
  closeRecap: () => void;
  /** 🔊: says a phrase aloud in the Target Language. */
  hearItSaid: (text: string) => void;
  /** J: opens the full-screen Journal, outside conversations. */
  openJournal: () => void;
  closeJournal: () => void;
  setTyping: (typing: boolean) => void;
  dismissToast: () => void;
  dismissVoiceUnavailable: () => void;
};

const isNpc = (interactable: Interactable | null): interactable is NamedNpcId =>
  interactable !== null && interactable in NAMED_NPCS;

/**
 * A game store. Given a game, it is already playing it in the first slot;
 * given null, it starts on the title screen.
 */
export function createGameStore(initial: GameState | null, overrides: Partial<GameStoreDeps> = {}) {
  const deps: GameStoreDeps = { ...BROWSER_DEPS, ...overrides };
  // The live session belongs to the open conversation; it never goes into state.
  let voice: VoiceSession | null = null;
  let conversations = 0;
  // The game as it was when the open conversation began: what a save holds until its outcome is decided.
  let gameBeforeConversation: GameState | null = null;
  let realMsSinceSave = 0;
  // Found by the title screen, and played by Continue.
  let latestSave: Save | null = null;
  let freeSlot: string | null = null;

  return createStore<GameStore>()((set, get) => {
    /**
     * Saves the game into its slot. A conversation is never saved in progress:
     * until its outcome is decided, the save keeps the game from before it.
     */
    const save = () => {
      const { screen, conversation, slotId } = get();
      if (screen !== 'playing') return;
      const game = conversation && !conversation.outcome && gameBeforeConversation ? gameBeforeConversation : get().game;
      realMsSinceSave = 0;
      // Started at once: IndexedDB runs writes in the order they began, so an older game never lands after a newer one.
      deps.saves.write(slotId, game).then(
        () => set({ savedCount: get().savedCount + 1 }),
        (error: unknown) => console.error('[save] could not save:', error),
      );
    };

    const play = (game: GameState, slotId: string, arrival: Arrival) => {
      realMsSinceSave = 0;
      set({ screen: 'playing', title: null, game, slotId, arrival });
    };

    const updateConversation = (change: Partial<Conversation>) => {
      const conversation = get().conversation;
      if (conversation) set({ conversation: { ...conversation, ...change } });
    };

    /** The outcome is decided and applied, then saved. The NPC says goodbye next, then the closing card shows. */
    const settleOutcome = (game: GameState, outcome: ClosingCard) => {
      set({ game });
      updateConversation({ outcome });
      save();
    };

    const updateRecap = (conversationId: number, recap: RecapView) => {
      if (get().conversation?.id === conversationId) updateConversation({ recap });
    };

    /**
     * Starts writing the Recap the moment the conversation ends. It goes to the
     * Journal whether or not the Player looks at it, and shows in the column only
     * while this conversation is still open.
     */
    const writeRecap = (conversation: Conversation, outcome: ClosingCard) => {
      const { game, nativeLanguage } = get();
      const { culturePackId, targetLanguage } = game.identity;
      const transcript = conversation.lines.map(({ speaker, text, typed }) => (typed ? { speaker, text, typed } : { speaker, text }));
      const request: RecapRequest = {
        kind: 'goal',
        culturePackId,
        step: game.proficiencyStep,
        nativeLanguage,
        conversation: { interactionId: conversation.interaction.id, outcome: outcome.kind, transcript, helpLog: [] },
      };
      const entry = (recap: Recap | null): NewJournalEntry => ({
        kind: 'goal',
        npcId: conversation.npcId,
        interactionId: conversation.interaction.id,
        placeName: CULTURE_PACKS[culturePackId].cafe.name,
        day: game.clock.day,
        minuteOfDay: game.clock.minuteOfDay,
        targetLanguage,
        nativeLanguage,
        outcome: outcome.kind,
        recap: recap && { outcome: recap.outcome, corrections: recap.corrections, newWords: recap.newWords },
        lines: transcript,
        helpLog: [],
      });

      updateConversation({ recap: { status: 'writing' } });
      deps
        .requestRecap(request)
        .then(
          (recap) => {
            updateRecap(conversation.id, { status: 'ready', entry: journalPage(entry(recap)) });
            return entry(recap);
          },
          (error: unknown) => {
            console.warn('[recap] could not be written:', error instanceof Error ? error.message : error);
            updateRecap(conversation.id, { status: 'failed' });
            return entry(null);
          },
        )
        .then((written) => deps.journal.append(get().slotId, written))
        .catch((error: unknown) => console.error('[journal] could not save an entry:', error));
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
      const conversation = get().conversation;
      if (conversation?.outcome && !conversation.recap) writeRecap(conversation, conversation.outcome);
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
      screen: initial ? 'playing' : 'title',
      title: initial ? null : { status: 'checking' },
      arrival: 'newGame',
      slotId: SLOT_IDS[0],
      savedCount: 0,
      // On the title screen, a First Morning stands in until a game is chosen.
      game: initial ?? createSave(DEV_SETUP),
      tabHidden: false,
      interactable: null,
      conversation: null,
      typing: false,
      micLevel: 0,
      toast: null,
      voiceUnavailable: false,
      nativeLanguage: DEV_NATIVE_LANGUAGE,
      journal: null,
      openTitle: () => {
        set({ title: { status: 'checking' } });
        const settings = deps.deviceSettings.load().then(
          ({ nativeLanguage }) => set({ nativeLanguage }),
          (error: unknown) => console.warn('[settings] could not be read:', error),
        );
        const slots = deps.saves.usedSlots().then(
          (used) => (freeSlot = SLOT_IDS.find((slot) => !used.includes(slot)) ?? null),
          () => (freeSlot = null),
        );
        const latest = deps.saves.mostRecent().then((found) => (latestSave = found));
        Promise.all([latest, slots, settings]).then(
          () => set({ title: { status: 'ready', canContinue: latestSave !== null, canStartNew: freeSlot !== null } }),
          async (error: unknown) => {
            console.error('[save] the latest save could not be loaded:', error);
            await Promise.allSettled([slots, settings]);
            const message = error instanceof Error ? error.message : String(error);
            set({ title: { status: 'failed', message, canStartNew: freeSlot !== null } });
          },
        );
      },
      continueGame: () => {
        if (get().screen === 'playing' || !latestSave) return;
        play(latestSave.game, latestSave.slotId, 'continued');
      },
      newGame: () => {
        if (get().screen === 'playing' || !freeSlot) return;
        play(createSave(DEV_SETUP), freeSlot, 'newGame');
        save();
      },
      saveNow: save,
      advance: (realDeltaMs) => {
        if (get().screen !== 'playing') return;
        const before = get().game;
        const dt = gameMinutesFor(realDeltaMs, selectTimeScale(get()));
        if (dt > 0) set({ game: tick(before, dt) });
        realMsSinceSave += realDeltaMs;
        if (get().game.clock.day !== before.clock.day || realMsSinceSave >= SAVE.everyRealMs) save();
      },
      setTabHidden: (tabHidden) => {
        set({ tabHidden });
        if (tabHidden) save();
      },
      // The world calls these every frame, so they only notify on a change.
      enterPlace: (placeId) => {
        const game = enterPlace(get().game, placeId);
        if (game === get().game) return;
        set({ game });
        // Through a door.
        save();
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
        if (conversation || get().journal || !isNpc(interactable)) return;
        const npc = NAMED_NPCS[interactable];
        const interaction = Object.values(INTERACTIONS).find((i) => i.npcId === npc.id)!;
        gameBeforeConversation = game;
        const npcSession = buildNpcSession(interaction, CULTURE_PACKS[game.identity.culturePackId], game.proficiencyStep, npc, {
          clock: game.clock,
        });

        set({
          voiceUnavailable: false,
          conversation: {
            id: ++conversations,
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
            recap: null,
            showingRecap: false,
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
          lines: [...conversation.lines, { speaker: 'player', text: line, typed: true }],
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
      skipRecap: () => {
        const writing = get().conversation?.recap;
        endConversation();
        if (writing) set({ toast: { kind: 'recapSaved' } });
      },
      seeRecap: () => {
        if (get().conversation?.recap) updateConversation({ showingRecap: true });
      },
      closeRecap: () => endConversation(),
      hearItSaid: (text) => {
        deps
          .hearItSaid(text, get().game.identity.targetLanguage)
          .catch((error: unknown) => console.warn('[hear-it-said]', error instanceof Error ? error.message : error));
      },
      openJournal: () => {
        if (get().conversation || get().journal) return;
        set({ journal: { entries: null, failed: false } });
        deps.journal.list(get().slotId).then(
          (entries) => {
            if (get().journal) set({ journal: { entries, failed: false } });
          },
          (error: unknown) => {
            console.error('[journal] could not be read:', error);
            if (get().journal) set({ journal: { entries: [], failed: true } });
          },
        );
      },
      closeJournal: () => set({ journal: null }),
      setTyping: (typing) => set({ typing }),
      dismissToast: () => set({ toast: null }),
      dismissVoiceUnavailable: () => set({ voiceUnavailable: false }),
    };
  });
}

export const gameStore = createGameStore(null);

/** Reads the game store from React. Pass one of the selectors below. */
export function useGame<T>(selector: (state: GameStore) => T): T {
  return useStore(gameStore, selector);
}

// --- Selectors: the only way world and UI read game state -------------------

export const selectScreen = (s: GameStore) => s.screen;
export const selectTitle = (s: GameStore) => s.title;
export const selectArrival = (s: GameStore) => s.arrival;
export const selectSavedCount = (s: GameStore) => s.savedCount;

export const selectTimeScale = (s: GameStore) => {
  if (s.tabHidden || s.journal) return CLOCK.timeScale.paused;
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
/** Keys belong to the UI, not the world: the typed field has focus, or the Journal is open. */
export const selectWorldKeysOff = (s: GameStore) => s.typing || s.journal !== null;
export const selectListening = (s: GameStore) => s.conversation?.listening ?? false;
export const selectMicLevel = (s: GameStore) => s.micLevel;
export const selectReconnecting = (s: GameStore) => s.conversation?.reconnecting ?? false;
export const selectConversationUsage = (s: GameStore) => s.conversation?.usage ?? NO_USAGE;
export const selectToast = (s: GameStore) => s.toast;
export const selectVoiceUnavailable = (s: GameStore) => s.voiceUnavailable;
/** The closing card, once the session is over. */
export const selectClosingCard = (s: GameStore) => (s.conversation?.closed ? s.conversation.outcome : null);
/** The Recap in the column, once See Recap is chosen. */
export const selectRecap = (s: GameStore) => (s.conversation?.showingRecap ? s.conversation.recap : null);
export const selectJournal = (s: GameStore) => s.journal;
/** The NPC's face: Patience shows only like this, never as a number. */
export const selectNpcExpression = (s: GameStore): NpcExpression | null =>
  s.conversation ? npcExpression(s.conversation.patience) : null;
