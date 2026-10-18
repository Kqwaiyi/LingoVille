import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import {
  buildNpcSession,
  checkReadings,
  hasReadingAids,
  NOT_UNDERSTOOD_TOOL,
  OUT_OF_PATIENCE_SCENE,
  wordReading,
  type AnnotateRequest,
  type Annotation,
  type HelpLogEntry,
  type Hint,
  type HintRequest,
  type Hints,
  type NpcSession,
  type Recap,
  type RecapRequest,
  type Segment,
  type ToolResponse,
  type VoiceRequest,
} from '../ai/index.ts';
import {
  CULTURE_PACKS,
  DEFAULT_APPEARANCE,
  interactionStartedWithE,
  localNpcPlaceName,
  NAMED_NPCS,
  OPEN_AIR_PLACES,
  placeHours,
  placePhrasebook,
  worldSign,
  type Interaction,
  type NamedNpcId,
  type NpcLook,
  type PlacePhrase,
  type SignId,
  stopsBetween,
  TOWN_NPCS,
  townNpcLook,
  TRAM_LINE,
  type TownNpcId,
  type TramStopId,
} from '../content/index.ts';
import {
  addToPhrasebook,
  applyInteractionOutcome,
  applyRecapEvidence,
  CLOCK,
  createSave,
  enterPlace,
  gameMinutesFor,
  daylight,
  isOpen,
  isOutOfPatience,
  LANGUAGE_CODES,
  isUnreadableTranscript,
  losePatience,
  newPlayerTurn,
  npcExpression,
  rideTram,
  startPatience,
  tick,
  tramTripMinutes,
  weekdayOf,
  type ConversationEvidence,
  type GameState,
  type LanguageCode,
  type NewGameSetup,
  type NpcExpression,
  type OutcomeResult,
  type Patience,
  type PhrasebookEntry,
  type PlaceId,
} from '../sim/index.ts';
import {
  addUsage,
  hearItSaid,
  NO_USAGE,
  openVoiceSession,
  replaySpoken,
  VoiceServiceUnavailableError,
  type OpenVoiceSession,
  type SpokenTurn,
  type TokenUsage,
  type HearItSaid,
  type ToolCall,
  type TranscriptLine,
  type VoiceSession,
} from '../voice/index.ts';
import { browserLibraryReadings, type LibraryReadings } from './libraryReadings.ts';
import { browserJournal, journalPage, type Journal, type JournalEntry, type JournalPage, type NewJournalEntry } from './journal.ts';

/** Builds the NPC's session for a conversation. */
type SessionFor = () => NpcSession;

/** A fixed setup: the new game the store plays. */
export const DEV_SETUP: NewGameSetup = {
  characterName: 'Sam',
  targetLanguage: 'ja',
  culturePackId: 'ja',
  startingStep: 'A1',
  appearance: DEFAULT_APPEARANCE,
  rngSeed: 20261003,
};

/** The Native Language: the UI is in English. */
export const DEV_NATIVE_LANGUAGE: LanguageCode = 'en';

/** The one game's Journal is kept under this id. */
const JOURNAL_SLOT_ID = 'slot-1';

/** Speaking with the mic, or the Typed Fallback. */
export type InputMode = 'mic' | 'typed';

/** Something in the world the Character is close enough to use with E: an NPC to talk to, or a tram stop. */
export type Interactable = TownNpcId | TramStopId;

/** Where the tram can take the Character from a stop, and how long each trip takes. */
export type TramDestination = { stopId: TramStopId; minutes: number };

/** The tram has just set the Character down at this stop. Each trip is a new object, so the world moves the Character once per ride. */
export type TramArrival = { stopId: TramStopId };

/** A line of the conversation. A typed player line is marked, so the Recap knows it wasn't misheard. */
export type ChatLine = TranscriptLine & { typed?: true };

/** A short notice over the game that clears itself. */
export type Toast =
  /** A network abandonment: the NPC had to step away. */
  | { kind: 'npcSteppedAway'; npcId: TownNpcId }
  | { kind: 'recapSaved' };

/** The Recap in the conversation column: being written, ready as a Journal page, or not to be had. */
export type RecapView = { status: 'writing' } | { status: 'ready'; entry: JournalPage } | { status: 'failed' };

/** The full-screen Journal: its entries, newest first, or null while they load. */
export type JournalView = { entries: JournalEntry[] | null; failed: boolean };

/** Help's hints for one moment of the conversation: being written, ready, or not to be had. */
export type HintsView = { status: 'loading' } | { status: 'ready'; hints: Hint[] } | { status: 'failed' };

/** An NPC line's Native Language translation, from `/api/annotate`. */
export type TranslationView = { status: 'loading' } | { status: 'ready'; text: string } | { status: 'failed' };

/** An NPC line's reading aid: the library's at first, then the model's once it passes the checks. */
export type LineReading = { segments: Segment[]; corrected: boolean };

/** One line of a sign the Player is pointing at, with its library reading and, once translated, its gloss. */
export type SignTooltipLine = { text: string; note: string | null; segments: Segment[] | null; gloss: string | null };

/** The tooltip over a sign or menu the Player is pointing at. */
export type SignTooltip = {
  signId: SignId;
  translated: boolean;
  /** Every line is glossed in the Native Language. A sign in the Player's own language has nothing to translate. */
  canTranslate: boolean;
  lines: SignTooltipLine[];
};

/** A word from a Recap, kept with "+ Phrasebook". */
export type NewWord = Recap['newWords'][number];

/** How a Goal Interaction ended, and its effects, for the closing card. */
export type ClosingCard = Extract<OutcomeResult, { kind: 'success' | 'failure' }>;

/** Who the conversation is with: a Named NPC in a Goal Interaction. */
type Partner = { npcId: NamedNpcId; interaction: Interaction };

/**
 * A conversation under way. It lives only here, and leaving before its outcome
 * is decided changes nothing.
 */
export type Conversation = ConversationState & Partner;

type ConversationState = {
  /** Tells this conversation apart from later ones, so a late Recap only lands where it belongs. */
  id: number;
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
  /** Which tab of the column shows. While Help shows, the conversation waits: no time passes and Patience is frozen. */
  tab: 'chat' | 'help';
  /** The hints for the moment Help was last opened at: `atLine` is how many lines the conversation had then. */
  hints: { atLine: number; view: HintsView } | null;
  /** Each finished NPC line's annotation, by line index, asked for as the line finished. */
  annotations: Partial<Record<number, TranslationView>>;
  /** The NPC lines the Player pressed Translate on. */
  translated: number[];
  /** Each NPC line's reading aid, by line index, for zh and ja. */
  readings: Partial<Record<number, LineReading>>;
  /** The voice the NPC speaks in, once their session is open. */
  npcVoice: VoiceRequest | null;
  /** Each finished NPC line as the NPC said it aloud, by line index, to replay it. */
  spoken: Partial<Record<number, SpokenTurn>>;
  /** The Help used so far, in order, placed relative to the turns. It goes to the Recap. */
  helpLog: HelpLogEntry[];
};

export type GameStoreDeps = {
  /** How a conversation reaches its NPC. In mock mode the gateway hands it the scripted fake NPC. */
  openVoiceSession: OpenVoiceSession;
  /** Asks the gateway for a Recap. Rejects if none can be written. */
  requestRecap: (request: RecapRequest) => Promise<Recap>;
  /** Asks the gateway for Help's hints for this moment. Rejects if there are none to be had. */
  requestHints: (request: HintRequest) => Promise<Hint[]>;
  /** Asks the gateway to annotate a finished NPC line. Rejects if it can't. */
  requestAnnotation: (request: AnnotateRequest) => Promise<Annotation>;
  /** The library readings an NPC line shows the moment it appears. */
  readings: LibraryReadings;
  journal: Journal;
  hearItSaid: HearItSaid;
  /** Plays an NPC's line again just as they said it. */
  replaySpoken: (spoken: SpokenTurn) => void;
  /** Dev only: the hour a new game starts at instead of the usual morning's, or null. */
  devStartHour: () => number | null;
  /** Dev only: the Target Language of the new game the store plays, instead of `DEV_SETUP`'s, or null. */
  devNewGameTarget: () => LanguageCode | null;
};

/** POSTs a request to one of the gateway's prompted endpoints, and returns its answer. */
async function askGateway<Answer>(path: string, request: unknown): Promise<Answer> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`${path}: the gateway answered ${res.status}`);
  return (await res.json()) as Answer;
}

const BROWSER_DEPS: GameStoreDeps = {
  openVoiceSession,
  requestRecap: (request) => askGateway<Recap>('/api/recap', request),
  requestHints: async (request) => (await askGateway<Hints>('/api/hint', request)).hints,
  requestAnnotation: (request) => askGateway<Annotation>('/api/annotate', request),
  readings: browserLibraryReadings,
  journal: browserJournal,
  hearItSaid,
  replaySpoken,
  devStartHour: devStartHourFromUrl,
  devNewGameTarget: devNewGameTargetFromUrl,
};

/** Dev only: `?at=9` starts a new game at 09:00, so a place that isn't open first thing can be reached at once. */
function devStartHourFromUrl(): number | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const hour = Number(new URLSearchParams(window.location.search).get('at') ?? NaN);
  return Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour : null;
}

/**
 * Dev only: `?newGame` plays a new game learning Japanese or (`?newGame=de`) the
 * language named, to play the town in any Culture Pack.
 */
function devNewGameTargetFromUrl(): LanguageCode | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const target = url.searchParams.get('newGame');
  if (target === null) return null;
  const language = target === '' ? DEV_SETUP.targetLanguage : target;
  if ((LANGUAGE_CODES as readonly string[]).includes(language)) return language as LanguageCode;
  console.warn(`[dev] ?newGame=${target} names no Target Language, so the game learns Japanese`);
  return null;
}

export type GameStore = {
  game: GameState;
  /** The Player's own language, which Recaps are written in. */
  nativeLanguage: LanguageCode;
  /** Speaking with the mic, or the Typed Fallback. */
  inputMode: InputMode;
  tabHidden: boolean;
  /** The Character is out on the street, in no place: the place id stays the last one they were in. */
  onStreet: boolean;
  interactable: Interactable | null;
  /** The Player is choosing where to take the tram. */
  tramChoosing: boolean;
  tramArrival: TramArrival | null;
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
  /** The sign the Player is pointing at, and whether the pointer is on its tooltip, which keeps it open. */
  sign: { tooltip: SignTooltip; held: boolean } | null;
  /** Called once per rendered frame with the real time since the last one. */
  advance: (realDeltaMs: number) => void;
  setTabHidden: (hidden: boolean) => void;
  enterPlace: (placeId: PlaceId) => void;
  /** The world says, as the Character walks, whether they're out on the street or in a place. */
  setOnStreet: (onStreet: boolean) => void;
  setInteractable: (interactable: Interactable | null) => void;
  /** E at a tram stop while the trams run: choose a stop to ride to. */
  openTram: () => void;
  closeTram: () => void;
  /** Rides the tram from this stop to `stopId`: free, but time passes. */
  rideTram: (stopId: TramStopId) => void;
  /** The pointer is on a sign within range: shows its tooltip. */
  pointAtSign: (signId: SignId) => void;
  /** The pointer has left a sign, or (`outOfRange`) the Character has walked out of range of it, which closes it even while held. */
  unpointSign: (signId: SignId, outOfRange?: boolean) => void;
  /** The pointer is on the sign's tooltip, which keeps it open, or has left it, which closes it. */
  holdSignTooltip: (held: boolean) => void;
  /** Translate on the sign's tooltip: shows each line's gloss in the Native Language. */
  translateSign: () => void;
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
  /** 🔊 Replay under a finished NPC line: plays it again just as the NPC said it, or says it in their voice. */
  replayLine: (line: number) => void;
  /** H or the Help tab: opens Help, where the conversation waits, or goes back to the chat. */
  toggleHelp: () => void;
  /** Translate under a finished NPC line: shows its Native Language translation. */
  translateLine: (line: number) => void;
  /** "+ Phrasebook" on a Recap's new word: keeps it in the personal phrasebook. */
  addToPhrasebook: (word: NewWord, glossLanguage: LanguageCode) => void;
  /** J: opens the full-screen Journal, outside conversations. */
  openJournal: () => void;
  closeJournal: () => void;
  setTyping: (typing: boolean) => void;
  dismissToast: () => void;
  dismissVoiceUnavailable: () => void;
};

const isTownNpc = (interactable: Interactable | null): interactable is TownNpcId =>
  interactable !== null && interactable in TOWN_NPCS;

/** Someone with a name: anyone in town but the passers-by. */
const isNamedNpc = (interactable: Interactable | null): interactable is NamedNpcId => isTownNpc(interactable) && interactable in NAMED_NPCS;

const isTramStop = (interactable: Interactable | null): interactable is TramStopId =>
  (TRAM_LINE as readonly (Interactable | null)[]).includes(interactable);

/** It's open now in the Character's pack. Closing time stops new conversations from starting here. */
const isPlaceOpen = (placeId: PlaceId, game: GameState) => isOpen(placeHours(placeId, game.identity.culturePackId), game.clock);

/** A conversation that takes the Player's turns: not yet decided, and not reconnecting. */
const takesTurns = (conversation: Conversation | null): conversation is Conversation =>
  conversation !== null && !conversation.outcome && !conversation.reconnecting;

/** A Goal Interaction's outcome, which its closing card shows. */
const isClosingCard = (outcome: Conversation['outcome']): outcome is ClosingCard =>
  outcome?.kind === 'success' || outcome?.kind === 'failure';

/** Staff can be talked to only while their place is open. Closing time stops new conversations, never one under way. */
const isAtWork = (npcId: TownNpcId, game: GameState) =>
  isOpen(placeHours(TOWN_NPCS[npcId].hoursId, game.identity.culturePackId), game.clock);

/** The trams run now: the tram stop's hours are theirs. */
const tramsRunning = (game: GameState) => isPlaceOpen('tram-stop', game);

/**
 * A game store, already playing a game: the one given, or given null, a new
 * game from `DEV_SETUP`.
 */
export function createGameStore(initial: GameState | null, overrides: Partial<GameStoreDeps> = {}) {
  const deps: GameStoreDeps = { ...BROWSER_DEPS, ...overrides };
  // The live session belongs to the open conversation; it never goes into state.
  let voice: VoiceSession | null = null;
  let conversations = 0;
  // Each conversation's NPC line readings and the annotations still on their way, kept past
  // the conversation's end until its Journal entry is written, so the Journal keeps the corrected readings.
  const lineReadings = new Map<number, { readings: Conversation['readings']; annotating: Promise<unknown>[] }>();

  return createStore<GameStore>()((set, get) => {
    /** A sign's tooltip in this game: each line with its library reading, and its gloss once translated. */
    const signTooltip = (signId: SignId, translated: boolean): SignTooltip => {
      const { game, nativeLanguage } = get();
      const packId = game.identity.culturePackId;
      const lines = worldSign(signId, packId);
      const canTranslate = lines.every((line) => line.glosses[nativeLanguage] !== undefined);
      const showGlosses = translated && canTranslate;
      return {
        signId,
        translated: showGlosses,
        canTranslate,
        lines: lines.map(({ text, note, glosses }) => ({
          text,
          note,
          segments: hasReadingAids(packId) ? deps.readings.read(packId, text) : null,
          gloss: showGlosses ? glosses[nativeLanguage]! : null,
        })),
      };
    };

    /** The new game the store plays unless given one: `DEV_SETUP`, in dev learning the language `?newGame` names, from the hour `?at` names. */
    const newGame = (): GameState => {
      const targetLanguage = deps.devNewGameTarget() ?? DEV_SETUP.targetLanguage;
      const game = createSave({ ...DEV_SETUP, targetLanguage, culturePackId: targetLanguage });
      const startHour = deps.devStartHour();
      return startHour === null ? game : { ...game, clock: { ...game.clock, minuteOfDay: (startHour / 24) * CLOCK.minutesPerDay } };
    };

    const updateConversation = (change: Partial<ConversationState>) => {
      const conversation = get().conversation;
      if (conversation) set({ conversation: { ...conversation, ...change } });
    };

    /** The outcome is decided and applied. The NPC says goodbye next, then the closing card shows. */
    const settleOutcome = (game: GameState, outcome: ClosingCard) => {
      set({ game });
      updateConversation({ outcome });
    };

    const updateRecap = (conversationId: number, recap: RecapView) => {
      if (get().conversation?.id === conversationId) updateConversation({ recap });
    };

    /** A Recap's evidence moves Proficiency. */
    const applyRecap = (conversation: Conversation, recap: Recap) => {
      const evidence: ConversationEvidence = {
        cefrEstimate: recap.cefrEstimate,
        lines: conversation.lines.map(({ speaker, text }) => ({ speaker, text })),
        helpLog: conversation.helpLog,
        notUnderstoodTurns: conversation.patience.turnsNotUnderstood,
      };
      set({ game: applyRecapEvidence(get().game, evidence) });
    };

    /** A Recap as the Journal keeps it: each new word with its reading if that passes the checks, or with the library's. */
    const journalRecap = (recap: Recap, targetLanguage: LanguageCode) => ({
      outcome: recap.outcome,
      corrections: recap.corrections,
      newWords: recap.newWords.map((word) =>
        hasReadingAids(targetLanguage) ? { ...word, reading: wordReading(targetLanguage, word, deps.readings.read(targetLanguage, word.base)) } : word,
      ),
    });

    /** A conversation's lines as a Recap reads them: a typed player line is marked, so it isn't taken as misheard. */
    const transcriptOf = (lines: ChatLine[]) => lines.map(({ speaker, text, typed }) => (typed ? { speaker, text, typed } : { speaker, text }));

    /**
     * Starts writing the Recap the moment the conversation ends. It goes to the
     * Journal whether or not the Player looks at it, and shows in the column only
     * while this conversation is still open.
     */
    const writeRecap = (conversation: Conversation, outcome: ClosingCard) => {
      const { game, nativeLanguage } = get();
      const { culturePackId, targetLanguage } = game.identity;
      const { npcId, interaction, helpLog } = conversation;
      const transcript = transcriptOf(conversation.lines);
      const step = game.proficiencyStep;
      // A Goal Interaction's Recap reads it against its goal.
      const request: RecapRequest = {
        kind: 'goal',
        culturePackId,
        step,
        nativeLanguage,
        conversation: { interactionId: interaction.id, outcome: outcome.kind, transcript, helpLog },
      };
      const entry = (recap: Recap | null): NewJournalEntry => {
        const page = {
          npcId,
          placeName: localNpcPlaceName(npcId, culturePackId),
          day: game.clock.day,
          minuteOfDay: game.clock.minuteOfDay,
          targetLanguage,
          nativeLanguage,
          recap: recap && journalRecap(recap, targetLanguage),
          lines: transcript.map((line, i) => {
            const reading = (lineReadings.get(conversation.id)?.readings ?? conversation.readings)[i];
            return reading && line.speaker === 'npc' ? { ...line, reading: reading.segments } : line;
          }),
          helpLog,
        };
        return { ...page, kind: 'goal', interactionId: interaction.id, outcome: outcome.kind };
      };
      updateConversation({ recap: { status: 'writing' } });
      deps
        .requestRecap(request)
        .then(
          (recap) => {
            applyRecap(conversation, recap);
            updateRecap(conversation.id, { status: 'ready', entry: journalPage(entry(recap)) });
            return recap;
          },
          (error: unknown) => {
            console.warn('[recap] could not be written:', error instanceof Error ? error.message : error);
            updateRecap(conversation.id, { status: 'failed' });
            return null;
          },
        )
        // The Journal keeps the corrected readings, so it waits for the last lines' annotations.
        .then(async (recap) => {
          await Promise.allSettled(lineReadings.get(conversation.id)?.annotating ?? []);
          return deps.journal.append(JOURNAL_SLOT_ID, entry(recap));
        })
        .catch((error: unknown) => console.error('[journal] could not save an entry:', error))
        .finally(() => lineReadings.delete(conversation.id));
    };

    /**
     * The NPC couldn't make sense of the Player's latest turn. Running out fails
     * the interaction. Returns whether the NPC is now out of Patience.
     */
    const notUnderstood = (conversation: Conversation) => {
      // Patience is frozen while Help is open.
      if (conversation.outcome || conversation.tab === 'help') return isOutOfPatience(conversation.patience);
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

      const { interaction } = conversation;
      const { state, result } = applyInteractionOutcome(get().game, interaction, { kind: 'success', args });
      switch (result.kind) {
        case 'success':
          settleOutcome(state, result);
          // An order is handed over.
          return { result: 'served' };
        case 'cannot_afford':
          return { result: 'cannot_afford' };
        case 'invalid_arguments':
          return { result: 'invalid_arguments', error: result.error };
        default:
          throw new Error(`A completion can't end as ${result.kind}`);
      }
    };

    /** Adds Help to the log, placed after the lines so far. Help already logged at this moment isn't logged twice. */
    const logHelp = (conversation: Conversation, kind: HelpLogEntry['kind'], texts: string[]): Conversation => {
      const afterLine = conversation.lines.length;
      const logged = (text: string) =>
        conversation.helpLog.some((entry) => entry.afterLine === afterLine && entry.kind === kind && entry.text === text);
      const fresh = [...new Set(texts)].filter((text) => !logged(text));
      if (fresh.length === 0) return conversation;
      return { ...conversation, helpLog: [...conversation.helpLog, ...fresh.map((text) => ({ afterLine, kind, text }))] };
    };

    /** The hints are Help used once they show in the open Help tab. */
    const logShownHints = (conversation: Conversation): Conversation => {
      const { hints } = conversation;
      if (conversation.tab !== 'help' || hints?.view.status !== 'ready') return conversation;
      return logHelp(
        conversation,
        'hint',
        hints.view.hints.map((hint) => hint.text),
      );
    };

    /** Asks for hints for this moment. They land only if the conversation hasn't moved on since. */
    const askForHints = (conversation: Conversation): Conversation => {
      const { game, nativeLanguage } = get();
      const atLine = conversation.lines.length;
      // Hints are written for a Goal Interaction's goal (free, like all Help).
      const landed = (view: HintsView) => {
        const current = get().conversation;
        if (current?.id !== conversation.id || current.hints?.atLine !== atLine) return;
        set({ conversation: logShownHints({ ...current, hints: { atLine, view } }) });
      };
      deps
        .requestHints({
          culturePackId: game.identity.culturePackId,
          step: game.proficiencyStep,
          nativeLanguage,
          interactionId: conversation.interaction.id,
          transcript: conversation.lines.map(({ speaker, text, typed }) => (typed ? { speaker, text, typed } : { speaker, text })),
        })
        .then(
          (hints) => landed({ status: 'ready', hints }),
          (error: unknown) => {
            console.warn('[help] no hints:', error instanceof Error ? error.message : error);
            landed({ status: 'failed' });
          },
        );
      return { ...conversation, hints: { atLine, view: { status: 'loading' } } };
    };

    /** Keeps a line's reading for its conversation, and shows it while the conversation is open. */
    const keepReading = (conversationId: number, line: number, reading: LineReading) => {
      const kept = lineReadings.get(conversationId);
      if (!kept) return;
      kept.readings = { ...kept.readings, [line]: reading };
      const current = get().conversation;
      if (current?.id === conversationId) set({ conversation: { ...current, readings: kept.readings } });
    };

    /** The library's reading of an NPC line as it comes in, unless the model's has already replaced it. */
    const readLine = (conversation: Conversation, line: number) => {
      const language = get().game.identity.targetLanguage;
      if (!hasReadingAids(language) || conversation.readings[line]?.corrected) return;
      const segments = deps.readings.read(language, conversation.lines[line]!.text);
      if (segments) keepReading(conversation.id, line, { segments, corrected: false });
    };

    /**
     * Asks for a finished NPC line's annotation, so Translate is instant. For zh
     * and ja, the model's reading replaces the library's if it passes the checks.
     */
    const annotate = (conversationId: number, line: number, text: string) => {
      if (text.trim() === '') return;
      const { game, nativeLanguage } = get();
      const { targetLanguage } = game.identity;
      const landed = (view: TranslationView) => {
        const current = get().conversation;
        if (current?.id === conversationId) set({ conversation: { ...current, annotations: { ...current.annotations, [line]: view } } });
      };
      landed({ status: 'loading' });
      const asked = deps.requestAnnotation({ targetLanguage, nativeLanguage, line: text }).then(
        ({ translation, segments }) => {
          landed({ status: 'ready', text: translation });
          if (!segments || !hasReadingAids(targetLanguage)) return;
          // The gateway reads the line without the transcript's spaces at either end.
          const check = checkReadings(targetLanguage, text.trim(), segments);
          if (check.ok) keepReading(conversationId, line, { segments, corrected: true });
          else console.warn('[annotate] the model’s reading failed a check, so the library’s stays:', check.rule, check.detail);
        },
        (error: unknown) => {
          console.warn('[annotate] no translation:', error instanceof Error ? error.message : error);
          landed({ status: 'failed' });
        },
      );
      lineReadings.get(conversationId)?.annotating.push(asked);
    };

    const closeSession = () => {
      voice?.close();
      voice = null;
    };

    /** The session is over. A Goal Interaction shows its closing card and starts its Recap. */
    const showClosingCard = () => {
      closeSession();
      updateConversation({ closed: true, npcLine: null, listening: false });
      set({ typing: false, micLevel: 0 });
      const conversation = get().conversation;
      if (conversation && isClosingCard(conversation.outcome) && !conversation.recap) {
        writeRecap(conversation, conversation.outcome);
      }
    };

    /** Closes the session and clears the conversation away, with whatever else should show instead. */
    const dropConversation = (instead: Partial<Pick<GameStore, 'toast' | 'voiceUnavailable'>> = {}) => {
      closeSession();
      // With no outcome there's no Journal entry to keep the readings for.
      const conversation = get().conversation;
      if (conversation && !conversation.outcome) lineReadings.delete(conversation.id);
      set({ conversation: null, typing: false, micLevel: 0, ...instead });
    };

    const endConversation = () => {
      const conversation = get().conversation;
      // Abandoning before the outcome is decided costs nothing.
      if (conversation?.interaction && !conversation.outcome) {
        set({ game: applyInteractionOutcome(get().game, conversation.interaction, { kind: 'abandon' }).state });
      }
      dropConversation();
    };

    /** The Player can take a turn: the conversation is under way, connected, and not yet decided. */
    const canTakeTurn = (conversation: Conversation | null): conversation is Conversation => voice !== null && takesTurns(conversation);

    /** Adds a piece of a turn to the line it belongs to, or starts that line. Returns the line's index. */
    const addPiece = (lines: ChatLine[], index: number | null, speaker: ChatLine['speaker'], text: string) => {
      if (index === null) return { lines: [...lines, { speaker, text }], index: lines.length };
      const joined = lines.map((line, i) => (i === index ? { ...line, text: line.text + text } : line));
      return { lines: joined, index };
    };

    /**
     * Opens a session for the conversation.
     * Every event from a session that has since been closed or replaced is ignored.
     */
    const openSession = (sessionFor: SessionFor, resumeFrom?: ChatLine[]) => {
      const npcSession = sessionFor();
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
            const conversation = { ...current, lines, npcLine: index };
            set({ conversation });
            readLine(conversation, index);
          }),
          onInputTranscript: live((current, text: string) => {
            const { lines, index } = addPiece(current.lines, current.heardLine, 'player', text);
            set({ conversation: { ...current, lines, heardLine: index } });
          }),
          onTurnComplete: live((current, spoken?: SpokenTurn) => {
            const finished = current.npcLine;
            if (finished !== null && spoken?.length) updateConversation({ spoken: { ...current.spoken, [finished]: spoken } });
            // Asked first, so the Journal entry the goodbye starts waits for its reading too.
            if (finished !== null) annotate(current.id, finished, current.lines[finished]!.text);
            // Once the outcome is decided, the turn that just ended was the goodbye.
            if (current.outcome) return showClosingCard();
            updateConversation({ npcLine: null });
          }),
          onToolCall: live((current, call: ToolCall) => session.sendToolResponse(call.id, answerToolCall(current, call))),
          onMicLevel: live((current, level: number) => {
            if (current.listening) set({ micLevel: level });
          }),
          onMicUnavailable: live(() => {
            // The Typed Fallback from now on, until the page is reloaded.
            set({ micLevel: 0, inputMode: 'typed' });
          }),
          onUsage: live((current, turn: TokenUsage) => set({ conversation: { ...current, usage: addUsage(current.usage, turn) } })),
          onDisconnect: live((current) => connectionFailed(current, sessionFor)),
        },
        { resumeFrom, typedOnly: get().inputMode === 'typed' },
      );
      voice = session;
      updateConversation({ npcVoice: npcSession.voice });
      session.connect().then(
        live(() => {
          updateConversation({ reconnecting: false });
        }),
        live((current, error: unknown) => connectionFailed(current, sessionFor, error)),
      );
    };

    /**
     * The session couldn't connect, or its connection dropped. With no token at
     * the start, voice can't work at all. Otherwise the game retries once with a
     * fresh session that carries on from the conversation so far, and a second
     * failure is a network abandonment: nothing is lost, and there's no Recap.
     */
    const connectionFailed = (conversation: Conversation, sessionFor: SessionFor, error?: unknown) => {
      closeSession();
      if (conversation.outcome) return showClosingCard();
      if (!conversation.retried && error instanceof VoiceServiceUnavailableError) {
        return dropConversation({ voiceUnavailable: true });
      }
      if (conversation.retried) {
        return dropConversation({ toast: { kind: 'npcSteppedAway', npcId: conversation.npcId } });
      }
      set({
        micLevel: 0,
        conversation: { ...conversation, retried: true, reconnecting: true, listening: false, npcLine: null, heardLine: null },
      });
      openSession(sessionFor, conversation.lines);
    };

    /** Opens a conversation with a Named NPC, who speaks first, greeting the Character. */
    const startConversation = (interaction: Interaction) => {
      const { game } = get();
      const npc = NAMED_NPCS[interaction.npcId];
      const sessionFor: SessionFor = () =>
        buildNpcSession(interaction, CULTURE_PACKS[game.identity.culturePackId], game.proficiencyStep, npc, { clock: game.clock });
      openConversation({ npcId: npc.id, interaction }, sessionFor);
    };

    /** Opens a conversation with `partner`, whose session `sessionFor` builds. They speak first. */
    const openConversation = (partner: Partner, sessionFor: SessionFor) => {
      const id = ++conversations;
      lineReadings.set(id, { readings: {}, annotating: [] });
      set({
        voiceUnavailable: false,
        conversation: {
          id,
          ...partner,
          lines: [],
          npcLine: null,
          heardLine: null,
          listening: false,
          reconnecting: false,
          retried: false,
          usage: NO_USAGE,
          patience: startPatience(get().game.proficiencyStep),
          outcome: null,
          closed: false,
          recap: null,
          showingRecap: false,
          tab: 'chat',
          hints: null,
          annotations: {},
          translated: [],
          readings: {},
          npcVoice: null,
          spoken: {},
          helpLog: [],
        },
      });
      openSession(sessionFor);
    };

    const game = initial ?? newGame();
    // While the town loads, so the first line doesn't wait for a dictionary.
    deps.readings.preload(game.identity.targetLanguage).then(
      () => {
        // A line that came in before the library had loaded gets its reading now.
        const conversation = get().conversation;
        conversation?.lines.forEach((line, i) => line.speaker === 'npc' && !conversation.readings[i] && readLine(conversation, i));
      },
      (error: unknown) => console.warn('[readings] the library could not load:', error instanceof Error ? error.message : error),
    );

    return {
      game,
      tabHidden: false,
      onStreet: false,
      interactable: null,
      tramChoosing: false,
      tramArrival: null,
      conversation: null,
      typing: false,
      micLevel: 0,
      toast: null,
      voiceUnavailable: false,
      nativeLanguage: DEV_NATIVE_LANGUAGE,
      inputMode: 'mic',
      journal: null,
      sign: null,
      advance: (realDeltaMs) => {
        const before = get().game;
        const dt = gameMinutesFor(realDeltaMs, selectTimeScale(get()));
        if (dt > 0) set({ game: tick(before, dt) });
      },
      setTabHidden: (tabHidden) => {
        set({ tabHidden });
      },
      // The world calls these every frame, so they only notify on a change.
      enterPlace: (placeId) => {
        const before = get().game;
        // Out in the open, there's no door to keep anyone out.
        const hours = OPEN_AIR_PLACES.includes(placeId) ? null : placeHours(placeId, before.identity.culturePackId);
        const game = enterPlace(before, placeId, hours);
        if (game === get().game) return;
        set({ game });
      },
      setOnStreet: (onStreet) => {
        if (onStreet !== get().onStreet) set({ onStreet });
      },
      setInteractable: (interactable) => {
        if (get().interactable === interactable) return;
        const { conversation } = get();
        // Walking away is like Leave: no cost before the outcome, the closing card after it.
        if (conversation && !conversation.closed && interactable !== conversation.npcId) get().leaveConversation();
        set({ interactable, tramChoosing: false });
      },
      openTram: () => {
        const { interactable, conversation, game } = get();
        if (conversation || !isTramStop(interactable) || !tramsRunning(game)) return;
        set({ tramChoosing: true });
      },
      closeTram: () => set({ tramChoosing: false }),
      rideTram: (stopId) => {
        const { interactable, conversation, game, tramChoosing } = get();
        if (!tramChoosing || conversation || !isTramStop(interactable)) return;
        const after = rideTram(game, stopsBetween(interactable, stopId), placeHours('tram-stop', game.identity.culturePackId));
        if (after === game) return;
        set({ game: after, tramChoosing: false, interactable: null, tramArrival: { stopId } });
      },
      pointAtSign: (signId) => {
        const { sign } = get();
        if (sign?.tooltip.signId === signId) return;
        set({ sign: { tooltip: signTooltip(signId, false), held: false } });
      },
      unpointSign: (signId, outOfRange = false) => {
        const { sign } = get();
        if (sign?.tooltip.signId === signId && (outOfRange || !sign.held)) set({ sign: null });
      },
      holdSignTooltip: (held) => {
        const { sign } = get();
        if (sign) set({ sign: held ? { ...sign, held } : null });
      },
      translateSign: () => {
        const { sign } = get();
        if (sign?.tooltip.canTranslate) set({ sign: { ...sign, tooltip: signTooltip(sign.tooltip.signId, true) } });
      },
      talk: () => {
        const { interactable, conversation, game } = get();
        if (conversation || get().journal || !isTownNpc(interactable) || !isAtWork(interactable, game)) return;
        const interaction = selectTalkWithE(get());
        if (!interaction) return;
        startConversation(interaction);
      },
      sendTypedLine: (text) => {
        const conversation = get().conversation;
        const line = text.trim();
        if (!canTakeTurn(conversation) || !voice || line === '') return;
        const turn: Conversation = {
          ...conversation,
          // Taking a turn ends the wait.
          tab: 'chat',
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
        if (!canTakeTurn(conversation) || !voice || conversation.listening || get().inputMode === 'typed') return;
        voice.startTalking();
        // A new turn: anything the NPC says next starts a new line, and so does what it hears.
        set({
          conversation: {
            ...conversation,
            tab: 'chat',
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
      replayLine: (line) => {
        const conversation = get().conversation;
        const npcLine = conversation?.lines[line];
        if (!conversation || npcLine?.speaker !== 'npc') return;
        const spoken = conversation.spoken[line];
        if (spoken) return deps.replaySpoken(spoken);
        // A line with nothing of it heard aloud (cut off, or from the scripted fake NPC) is said in the NPC's voice.
        deps
          .hearItSaid(npcLine.text, get().game.identity.targetLanguage, conversation.npcVoice ?? undefined)
          .catch((error: unknown) => console.warn('[hear-it-said]', error instanceof Error ? error.message : error));
      },
      toggleHelp: () => {
        const conversation = get().conversation;
        if (!conversation || conversation.closed) return;
        if (conversation.tab === 'help') return updateConversation({ tab: 'chat' });
        const { game } = get();
        const { hints } = conversation;
        const fresh = hints?.atLine === conversation.lines.length && hints.view.status !== 'failed';
        // Opening Help shows the place's phrasebook and the personal one, then this moment's hints.
        const open = logHelp({ ...conversation, tab: 'help' }, 'phrasebook', [
          ...placePhrasebook(game.identity.culturePackId, game.placeId).map((phrase) => phrase.text),
          ...game.phrasebook.map((entry) => entry.text),
        ]);
        set({ conversation: fresh ? logShownHints(open) : askForHints(open) });
      },
      translateLine: (line) => {
        const conversation = get().conversation;
        const npcLine = conversation?.lines[line];
        if (!conversation || npcLine?.speaker !== 'npc' || line === conversation.npcLine) return;
        let next = conversation.translated.includes(line) ? conversation : { ...conversation, translated: [...conversation.translated, line] };
        // The Recap was asked for as the session closed: reading back afterwards isn't Help used in the conversation.
        const readingBack = conversation.closed;
        if (!readingBack) next = logHelp(next, 'translate', [npcLine.text]);
        if (next !== conversation) set({ conversation: next });
        const annotation = conversation.annotations[line];
        if (!annotation || annotation.status === 'failed') annotate(conversation.id, line, npcLine.text);
      },
      addToPhrasebook: (word, glossLanguage) => {
        const game = addToPhrasebook(get().game, { text: word.base, reading: word.reading, gloss: word.gloss, glossLanguage });
        if (game === get().game) return;
        set({ game });
      },
      openJournal: () => {
        if (get().conversation || get().journal) return;
        set({ journal: { entries: null, failed: false } });
        deps.journal.list(JOURNAL_SLOT_ID).then(
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

export const selectInputMode = (s: GameStore) => s.inputMode;
export const selectAppearance = (s: GameStore) => s.game.identity.appearance;

export const selectTimeScale = (s: GameStore) => {
  if (s.tabHidden || s.journal || s.conversation?.tab === 'help') return CLOCK.timeScale.paused;
  return s.conversation ? CLOCK.timeScale.conversation : CLOCK.timeScale.normal;
};
export const selectMoneyInShifts = (s: GameStore) => s.game.character.moneyInShifts;
export const selectCulturePackId = (s: GameStore) => s.game.identity.culturePackId;
export const selectTargetLanguage = (s: GameStore) => s.game.identity.targetLanguage;
export const selectDay = (s: GameStore) => s.game.clock.day;
export const selectWeekday = (s: GameStore) => weekdayOf(s.game.clock.day);
/** Whole game minutes since midnight, so the clock re-renders once a game minute. */
export const selectClockMinute = (s: GameStore) => Math.floor(s.game.clock.minuteOfDay);
/**
 * How the town is lit now, for reading once a frame (`gameStore.getState()`) so it changes smoothly with the clock. Not
 * for `useGame`: it's a new object on every call, so it would re-render on every store update.
 */
export const selectDaylight = (s: GameStore) => daylight(s.game.clock.minuteOfDay);
/** Whether the street lights and the windows of open places are lit. */
export const selectLampsOn = (s: GameStore) => selectDaylight(s).lampsOn;
export const selectPlaceId = (s: GameStore) => s.game.placeId;
/** What E would use here. Staff at a closed place don't count: there's no one to talk to. */
export const selectInteractable = (s: GameStore) => {
  if (isTownNpc(s.interactable) && !isAtWork(s.interactable, s.game)) return null;
  return s.interactable;
};
/** The conversation `startedWith` starts with the Named NPC the Character is next to, given their Proficiency Step, or null. */
const talkWith = (s: GameStore, startedWith: typeof interactionStartedWithE): Interaction | null => {
  const npcId = selectInteractable(s);
  if (!isNamedNpc(npcId)) return null;
  const { proficiencyStep } = s.game;
  return startedWith(npcId, { step: proficiencyStep });
};
/** The conversation E starts with the NPC the Character is next to, or null. */
export const selectTalkWithE = (s: GameStore) => talkWith(s, interactionStartedWithE);
/** The tram stop the Character is standing at, or null. */
export const selectTramStop = (s: GameStore) => (isTramStop(s.interactable) ? s.interactable : null);
/** A tram runs now. Outside the trams' hours, the stop says none is running. */
export const selectTramRunning = (s: GameStore) => tramsRunning(s.game);
/** The trams' hours in this pack: the tram stop's. */
export const selectTramHours = (s: GameStore) => placeHours('tram-stop', s.game.identity.culturePackId);
export const selectTramChoosing = (s: GameStore) => s.tramChoosing;
export const selectTramArrival = (s: GameStore) => s.tramArrival;
const TRAM_DESTINATIONS = new Map(
  TRAM_LINE.map((from) => [
    from,
    TRAM_LINE.filter((to) => to !== from).map((stopId) => ({ stopId, minutes: tramTripMinutes(stopsBetween(from, stopId)) })),
  ]),
);
/** The other stops on the line from this one, and each trip's time. */
export const selectTramDestinations = (from: TramStopId): readonly TramDestination[] => TRAM_DESTINATIONS.get(from)!;
/** The current place's opening hours in this pack, for the place line above the dock. */
export const selectPlaceHours = (s: GameStore) => placeHours(s.game.placeId, s.game.identity.culturePackId);
/** Any place is open now: the world shuts the door of one that isn't. */
export const selectIsOpen = (placeId: PlaceId) => (s: GameStore) => isPlaceOpen(placeId, s.game);
export const selectPlaceOpen = (s: GameStore) => selectIsOpen(s.game.placeId)(s);
export const selectConversation = (s: GameStore) => s.conversation;
const NO_LINES: readonly ChatLine[] = [];
export const selectChatLines = (s: GameStore) => s.conversation?.lines ?? NO_LINES;
export const selectTyping = (s: GameStore) => s.typing;
/** Keys belong to the UI, not the world: the typed field has focus, the Journal is open, or the Player is choosing a tram stop. */
export const selectWorldKeysOff = (s: GameStore) => s.typing || s.journal !== null || s.tramChoosing;
export const selectListening = (s: GameStore) => s.conversation?.listening ?? false;
export const selectMicLevel = (s: GameStore) => s.micLevel;
export const selectReconnecting = (s: GameStore) => s.conversation?.reconnecting ?? false;
/** The Player can take a turn: not while the NPC says goodbye once the outcome is decided, nor while reconnecting. */
export const selectCanTakeTurn = (s: GameStore) => takesTurns(s.conversation);
export const selectConversationUsage = (s: GameStore) => s.conversation?.usage ?? NO_USAGE;
export const selectToast = (s: GameStore) => s.toast;
export const selectVoiceUnavailable = (s: GameStore) => s.voiceUnavailable;
/** The closing card, once the session is over. */
export const selectClosingCard = (s: GameStore): ClosingCard | null => (s.conversation?.closed && isClosingCard(s.conversation.outcome) ? s.conversation.outcome : null);
/** The Recap in the column, once See Recap is chosen. */
export const selectRecap = (s: GameStore) => (s.conversation?.showingRecap ? s.conversation.recap : null);
export const selectJournal = (s: GameStore) => s.journal;
/** This town NPC's face while the Player talks to them, or null when they aren't. */
export const selectNpcExpressionOf = (npcId: TownNpcId) => (s: GameStore) => (s.conversation?.npcId === npcId ? selectNpcExpression(s) : null);
/** How the NPC the Player is talking to looks, for their face, as the pack dresses them. */
export const selectNpcLook = (s: GameStore): NpcLook | null => {
  if (!s.conversation) return null;
  return townNpcLook(s.conversation.npcId, s.game.identity.culturePackId);
};
/** The NPC's face: Patience shows only like this, never as a number. */
export const selectNpcExpression = (s: GameStore): NpcExpression | null =>
  s.conversation ? npcExpression(s.conversation.patience) : null;
export const selectNativeLanguage = (s: GameStore) => s.nativeLanguage;
/** The Help tab shows, and the conversation waits. */
export const selectHelpOpen = (s: GameStore) => s.conversation?.tab === 'help';
/** The hints for the moment Help was opened at, while it is open. The NPC finishing a line meanwhile doesn't hide them. */
export const selectHints = (s: GameStore): HintsView | null =>
  s.conversation?.tab === 'help' ? (s.conversation.hints?.view ?? null) : null;
const TRANSLATING: TranslationView = { status: 'loading' };
/** An NPC line's translation, once the Player has pressed Translate on it. */
export const selectTranslation =
  (line: number) =>
  (s: GameStore): TranslationView | null =>
    s.conversation?.translated.includes(line) ? (s.conversation.annotations[line] ?? TRANSLATING) : null;

export const selectSignTooltip = (s: GameStore) => s.sign?.tooltip ?? null;
/** An NPC line's reading aid. */
export const selectLineReading =
  (line: number) =>
  (s: GameStore): Segment[] | null =>
    s.conversation?.readings[line]?.segments ?? null;
/** The NPC partway through saying a line, for the "speaking…" indicator over them. */
export const selectNpcSpeaking = (s: GameStore): TownNpcId | null =>
  s.conversation && !s.conversation.closed && s.conversation.npcLine !== null ? s.conversation.npcId : null;
const NO_PHRASES: readonly PlacePhrase[] = [];
/** The phrasebook for the place the Character is at. */
export const selectPlacePhrasebook = (s: GameStore): readonly PlacePhrase[] => {
  const phrases = placePhrasebook(s.game.identity.culturePackId, s.game.placeId);
  return phrases.length > 0 ? phrases : NO_PHRASES;
};
/** The personal phrasebook, oldest first. */
export const selectPhrasebook = (s: GameStore): readonly PhrasebookEntry[] => s.game.phrasebook;
/** A word is already kept in the personal phrasebook, glossed in this Native Language. */
export const selectInPhrasebook = (text: string, glossLanguage: LanguageCode) => (s: GameStore) =>
  s.game.phrasebook.some((entry) => entry.text === text && entry.glossLanguage === glossLanguage);
