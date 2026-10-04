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
} from '../ai/index.ts';
import {
  APPEARANCE_PRESET_IDS,
  CULTURE_PACKS,
  INTERACTIONS,
  NAMED_NPCS,
  placeHours,
  placePhrasebook,
  worldSign,
  type AppearancePresetId,
  type Interaction,
  type NamedNpcId,
  type PlacePhrase,
  type SignId,
} from '../content/index.ts';
import {
  addToPhrasebook,
  applyInteractionOutcome,
  CHARACTER_NAME,
  CLOCK,
  createSave,
  drinkWater,
  enterPlace,
  gameMinutesFor,
  isOpen,
  isOutOfPatience,
  LANGUAGE_CODES,
  isUnreadableTranscript,
  MIC_CHECK,
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
  type PhrasebookEntry,
  type PlaceId,
  type StartingStep,
} from '../sim/index.ts';
import {
  addUsage,
  hearItSaid,
  NO_USAGE,
  openBrowserMic,
  openVoiceSession,
  VoiceServiceUnavailableError,
  type OpenMic,
  type OpenVoiceSession,
  type TokenUsage,
  type HearItSaid,
  type ToolCall,
  type TranscriptLine,
  type VoiceSession,
} from '../voice/index.ts';
import { browserDeviceSettings, DEFAULT_DEVICE_SETTINGS, type DeviceSettings, type DeviceSettingsStore } from './deviceSettings.ts';
import { browserLibraryReadings, type LibraryReadings } from './libraryReadings.ts';
import { browserJournal, journalPage, type Journal, type JournalEntry, type JournalPage, type NewJournalEntry } from './journal.ts';
import {
  deleteSave,
  exportRawSave,
  exportSave,
  importSave,
  ImportRefused,
  type ImportProblem,
  type SaveFile,
  type SlotStores,
} from './saveFiles.ts';
import { browserSaves, SLOT_IDS, type LoadedSave, type Saves, type Slot, type SlotId } from './saves.ts';

/** A fixed setup: the First Morning that stands in behind the title screen, and the one store tests play. */
export const DEV_SETUP: NewGameSetup = {
  characterName: 'Sam',
  targetLanguage: 'ja',
  culturePackId: 'ja',
  startingStep: 'A1',
  appearancePresetId: 'preset-1',
  skipFirstMorning: false,
  rngSeed: 20261003,
};

/** The Native Language until this browser's device settings are read. */
export const DEV_NATIVE_LANGUAGE: LanguageCode = 'en';

/** Which screen shows: the title, New game setup, or the game itself. */
export type Screen = 'title' | 'setup' | 'playing';

/** New game setup's screens, in order. A browser that has passed the mic check skips it. */
export const SETUP_STEPS = ['nativeLanguage', 'targetLanguage', 'aboutYou', 'appearance', 'micCheck'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** Speaking with the mic, or the Typed Fallback. A device setting. */
export type InputMode = DeviceSettings['inputMode'];

/**
 * The mic check: waiting for the browser to open the mic, listening for the
 * Player, heard them, or no mic to be had (refused or missing).
 */
export type MicCheckStatus = 'asking' | 'listening' | 'heard' | 'unavailable';

/** New game setup, while it shows: the slot the new game goes into, the screen showing and the answers so far. */
export type Setup = {
  slotId: SlotId;
  step: SetupStep;
  targetLanguage: LanguageCode | null;
  /** From the self-assessment. */
  startingStep: StartingStep | null;
  characterName: string;
  appearancePresetId: AppearancePresetId;
  /** The mic check, while its screen shows. */
  mic: MicCheckStatus | null;
  /** "Skip tutorial": the game starts without the First Morning. */
  skipFirstMorning: boolean;
};

/** A slot on the title screen: empty, a save to play, or a save that can't be loaded at all. */
export type SlotCard =
  | { slotId: SlotId; status: 'empty' }
  | {
      slotId: SlotId;
      status: 'ready';
      characterName: string;
      targetLanguage: LanguageCode;
      culturePackId: LanguageCode;
      day: number;
      placeId: PlaceId;
      moneyInShifts: number;
      /** Real time, as an ISO string. */
      lastPlayedAt: string;
      /** It will load from this morning's backup. */
      fromBackup: boolean;
    }
  | { slotId: SlotId; status: 'damaged'; characterName: string | null; lastPlayedAt: string };

/** What came of the Player's last import, export or delete on the title screen. */
export type TitleNotice =
  | { kind: 'imported'; slotId: SlotId }
  | { kind: 'importRefused'; problem: ImportProblem }
  /** The file was fine, but it couldn't be stored. */
  | { kind: 'importFailed' }
  | { kind: 'exportFailed' }
  | { kind: 'deleteFailed' };

/** What the title screen can offer, once it has looked for saves. */
export type TitleView =
  | { status: 'checking' }
  | {
      status: 'ready';
      slots: SlotCard[];
      /** The most recently played slot, which Continue loads, or null with no saves. */
      continueSlotId: SlotId | null;
      /** The first empty slot, which New game and Import use, or null when all 4 are full. */
      freeSlotId: SlotId | null;
      notice: TitleNotice | null;
    }
  /** The saves couldn't be looked at at all. */
  | { status: 'failed'; message: string };

/** How the Character arrived in the world: the First Morning, or back from a save. The world picks the spawn point from it. */
export type Arrival = 'newGame' | 'continued';

/** Something in the world the Character is close enough to use with E: the tap, or an NPC to talk to. */
export type Interactable = 'tap' | NamedNpcId;

/** A line of the conversation. A typed player line is marked, so the Recap knows it wasn't misheard. */
export type ChatLine = TranscriptLine & { typed?: true };

/** A short notice over the game that clears itself. */
export type Toast = { kind: 'npcSteppedAway'; npcId: NamedNpcId } | { kind: 'recapSaved' } | { kind: 'loadedBackup' };

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

/** The reading aids device settings. Hiding reading aids hides romaji too. */
export type ReadingAidsSettings = { show: boolean; romaji: boolean };

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
  saves: Saves;
  deviceSettings: DeviceSettingsStore;
  hearItSaid: HearItSaid;
  /** Asks the browser to keep this site's data when space runs low. */
  storage: StoragePersistence;
  /** Hands the Player a file to keep. */
  downloadFile: (file: SaveFile) => void;
  /** The RNG seed for a new game. */
  newRngSeed: () => number;
  /** Dev only: the hour a new game starts at instead of the First Morning's, or null. */
  devStartHour: () => number | null;
  /** Opens the mic for the mic check. */
  openMic: OpenMic;
};

/** The parts of `navigator.storage` that keep saves from being cleared. Each answers whether storage is persistent. */
export type StoragePersistence = { persisted: () => Promise<boolean>; persist: () => Promise<boolean> };

/** The device settings tooltip id that remembers the persist-refused callout was dismissed. */
const PERSIST_REFUSED = 'persist-refused';

/** Where the browser can't keep data on request, there's nothing to ask for or warn about. */
const browserStorage: StoragePersistence = {
  persisted: () => (typeof navigator !== 'undefined' && navigator.storage?.persisted ? navigator.storage.persisted() : Promise.resolve(true)),
  persist: () => (typeof navigator !== 'undefined' && navigator.storage?.persist ? navigator.storage.persist() : Promise.resolve(true)),
};

function downloadInBrowser({ fileName, contents }: SaveFile) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A slot's card on the title screen. */
function slotCard(slot: Slot): SlotCard {
  switch (slot.status) {
    case 'empty':
      return slot;
    case 'damaged':
      return { slotId: slot.slotId, status: 'damaged', characterName: slot.characterName, lastPlayedAt: slot.lastPlayedAt };
    case 'ready': {
      const { identity, clock, placeId, character } = slot.save.game;
      return {
        slotId: slot.slotId,
        status: 'ready',
        characterName: identity.characterName,
        targetLanguage: identity.targetLanguage,
        culturePackId: identity.culturePackId,
        day: clock.day,
        placeId,
        moneyInShifts: character.moneyInShifts,
        lastPlayedAt: slot.lastPlayedAt,
        fromBackup: slot.fromBackup,
      };
    }
  }
}

/** What the Player types to delete a save: the Character's name or, if the save is too damaged to tell, "delete". */
export function nameToDelete(card: Exclude<SlotCard, { status: 'empty' }>) {
  return card.characterName ?? 'delete';
}

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
  saves: browserSaves,
  deviceSettings: browserDeviceSettings,
  hearItSaid,
  storage: browserStorage,
  downloadFile: downloadInBrowser,
  newRngSeed: () => Math.floor(Math.random() * 2 ** 31),
  devStartHour: devStartHourFromUrl,
  openMic: openBrowserMic,
};

/** Dev only: `?at=9` starts a new game at 09:00, so a smoke test can reach a place that opens after the First Morning. */
function devStartHourFromUrl(): number | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const hour = Number(new URLSearchParams(window.location.search).get('at') ?? NaN);
  return Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour : null;
}

export type GameStore = {
  screen: Screen;
  /** The title screen, while it shows. */
  title: TitleView | null;
  /** New game setup, while it shows. */
  setup: Setup | null;
  arrival: Arrival;
  /** The slot the game is saved into. */
  slotId: string;
  /** How many saves have finished, so the dock can flash "Saved ✓" on each one. */
  savedCount: number;
  game: GameState;
  /** The Player's own language, which Recaps are written in. */
  nativeLanguage: LanguageCode;
  /** Whether readings show over zh and ja lines, and romaji under ja ones. A device setting. */
  readingAids: ReadingAidsSettings;
  /** Speaking with the mic, or the Typed Fallback. A device setting. */
  inputMode: InputMode;
  /** This browser has heard the Player in a mic check, so New game skips it. A device setting. */
  micCheckPassed: boolean;
  tabHidden: boolean;
  interactable: Interactable | null;
  conversation: Conversation | null;
  /** The typed field has focus, so keys type into it instead of moving or acting. */
  typing: boolean;
  /** How loud the Player is while push-to-talk is held, or on the mic check, from 0 to 1. */
  micLevel: number;
  toast: Toast | null;
  /** No token could be minted for a conversation, so the "Voice service unavailable" screen shows. */
  voiceUnavailable: boolean;
  /** The full-screen Journal, while it is open. */
  journal: JournalView | null;
  /** The sign the Player is pointing at, and whether the pointer is on its tooltip, which keeps it open. */
  sign: { tooltip: SignTooltip; held: boolean } | null;
  /** The browser refused to keep saves safe from clearing, and the Player hasn't dismissed the callout yet. */
  persistCallout: boolean;
  /** Looks for saves and reads this browser's device settings, for the title screen. */
  openTitle: () => void;
  /** Continue: plays the most recently played save. */
  continueGame: () => void;
  /** Load a save: plays the save in this slot. */
  playSlot: (slotId: SlotId) => void;
  /** New game: opens setup for the first empty slot, on the Native Language screen. */
  newGame: () => void;
  /** Chooses the Native Language: the UI switches at once, and this browser's device settings keep it. */
  setNativeLanguage: (nativeLanguage: LanguageCode) => void;
  /** Chooses the Target Language, which is also the Culture Pack. Never the Native Language. */
  chooseTargetLanguage: (targetLanguage: LanguageCode) => void;
  /** The self-assessment: the step the Player's description of their level maps to. */
  chooseStartingStep: (startingStep: StartingStep) => void;
  /** Names the Character, cut to the longest a name may be. */
  nameCharacter: (characterName: string) => void;
  chooseAppearance: (appearancePresetId: AppearancePresetId) => void;
  /** "Skip tutorial", on the last setup screen: whether the game starts without the First Morning. */
  chooseSkipFirstMorning: (skip: boolean) => void;
  /** On to the next setup screen once this one is answered; after the last, the First Morning in its slot. */
  setupNext: () => void;
  /** Back to the setup screen before, keeping the answers; from the first, to the title screen. */
  setupBack: () => void;
  /** Skip on the mic check: starts the game without waiting for the mic, and leaves the input mode as it was. */
  skipMicCheck: () => void;
  /** Downloads the slot as one file: its save, its Journal and its backups' metadata. */
  exportSave: (slotId: SlotId) => void;
  /** Downloads everything stored for a slot, as found, for a save that can't be loaded. */
  exportRawSave: (slotId: SlotId) => void;
  /** Imports an exported file's contents into the first empty slot. */
  importSave: (contents: string) => void;
  /** Deletes the slot's save, its backups and its Journal, if `typedName` is the Character's name. */
  deleteSave: (slotId: SlotId, typedName: string) => void;
  dismissTitleNotice: () => void;
  dismissPersistCallout: () => void;
  /** Saves now, as the page is closed. */
  saveNow: () => void;
  /** Called once per rendered frame with the real time since the last one. */
  advance: (realDeltaMs: number) => void;
  setTabHidden: (hidden: boolean) => void;
  enterPlace: (placeId: PlaceId) => void;
  setInteractable: (interactable: Interactable | null) => void;
  /** The pointer is on a sign within range: shows its tooltip. */
  pointAtSign: (signId: SignId) => void;
  /** The pointer has left a sign, or (`outOfRange`) the Character has walked out of range of it, which closes it even while held. */
  unpointSign: (signId: SignId, outOfRange?: boolean) => void;
  /** The pointer is on the sign's tooltip, which keeps it open, or has left it, which closes it. */
  holdSignTooltip: (held: boolean) => void;
  /** Translate on the sign's tooltip: shows each line's gloss in the Native Language. */
  translateSign: () => void;
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
  /** H or the Help tab: opens Help, where the conversation waits, or goes back to the chat. */
  toggleHelp: () => void;
  /** Translate under a finished NPC line: shows its Native Language translation. */
  translateLine: (line: number) => void;
  /** Shows or hides reading aids, or romaji, and keeps the choice on this device. */
  setReadingAids: (change: Partial<ReadingAidsSettings>) => void;
  /** "+ Phrasebook" on a Recap's new word: keeps it in the personal phrasebook. */
  addToPhrasebook: (word: NewWord, glossLanguage: LanguageCode) => void;
  /** J: opens the full-screen Journal, outside conversations. */
  openJournal: () => void;
  closeJournal: () => void;
  setTyping: (typing: boolean) => void;
  dismissToast: () => void;
  dismissVoiceUnavailable: () => void;
};

const isNpc = (interactable: Interactable | null): interactable is NamedNpcId =>
  interactable !== null && interactable in NAMED_NPCS;

/** It's open now in the Character's pack. Closing time stops new conversations and Shifts from starting here. */
const isPlaceOpen = (placeId: PlaceId, game: GameState) => isOpen(placeHours(placeId, game.identity.culturePackId), game.clock);

/** Staff can be talked to only while their place is open. Closing time stops new conversations, never one under way. */
const isAtWork = (npcId: NamedNpcId, game: GameState) => isPlaceOpen(NAMED_NPCS[npcId].placeId, game);

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
  // Found by the title screen: what Continue and Load a save play.
  let slots: Slot[] = [];
  let askedToPersist = false;
  const stores: SlotStores = { saves: deps.saves, journal: deps.journal };
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

    /**
     * Saves the game into its slot. A conversation is never saved in progress:
     * until its outcome is decided, the save keeps the game from before it.
     */
    const save = () => {
      const { screen, conversation, slotId } = get();
      if (screen !== 'playing') return;
      askToPersist();
      const game = conversation && !conversation.outcome && gameBeforeConversation ? gameBeforeConversation : get().game;
      realMsSinceSave = 0;
      // Started at once: IndexedDB runs writes in the order they began, so an older game never lands after a newer one.
      deps.saves.write(slotId, game).then(
        () => set({ savedCount: get().savedCount + 1 }),
        (error: unknown) => console.error('[save] could not save:', error),
      );
    };

    const play = (game: GameState, slotId: string, arrival: Arrival, toast: Toast | null = null) => {
      realMsSinceSave = 0;
      set({ screen: 'playing', title: null, game, slotId, arrival, toast });
      // While the town loads, so the first line doesn't wait for a dictionary.
      deps.readings.preload(game.identity.targetLanguage).then(
        () => {
          // A line that came in before the library had loaded gets its reading now.
          const conversation = get().conversation;
          conversation?.lines.forEach((line, i) => line.speaker === 'npc' && !conversation.readings[i] && readLine(conversation, i));
        },
        (error: unknown) => console.warn('[readings] the library could not load:', error instanceof Error ? error.message : error),
      );
    };

    const playLoaded = ({ save, fromBackup }: LoadedSave) =>
      play(save.game, save.slotId, 'continued', fromBackup ? { kind: 'loadedBackup' } : null);

    /** Shows the persist-refused callout, unless the Player has dismissed it before. */
    const offerPersistCallout = () =>
      deps.deviceSettings.load().then(
        ({ tooltipsSeen }) => {
          if (!tooltipsSeen.includes(PERSIST_REFUSED)) set({ persistCallout: true });
        },
        (error: unknown) => console.warn('[settings] could not be read:', error),
      );

    /** Offers the callout if saves aren't kept safe: checked, or with `ask`, asked for first. */
    const checkPersisted = (ask: boolean) =>
      deps.storage
        .persisted()
        .then((persisted) => persisted || (ask && deps.storage.persist()))
        .then(
          (kept) => {
            if (!kept) void offerPersistCallout();
          },
          (error: unknown) => console.warn('[storage] could not check persistence:', error),
        );

    /** On the first write, asks the browser to keep saves from being cleared when space runs low. */
    const askToPersist = () => {
      if (askedToPersist) return;
      askedToPersist = true;
      void checkPersisted(true);
    };

    // Each device settings change starts writing at once, from the one before, so neither a quick run of
    // changes nor a reload right after one loses it. Reads wait for the writes still going.
    let settingsWrites: Promise<unknown> = Promise.resolve();
    const updateDeviceSettings = (change: (settings: DeviceSettings) => DeviceSettings | null) => {
      const written = deps.deviceSettings.update(change).catch((error: unknown) => console.warn('[settings] could not be saved:', error));
      settingsWrites = settingsWrites.then(() => written);
    };

    const answerSetup = (answers: Partial<Setup>) => {
      const setup = get().setup;
      if (get().screen === 'setup' && setup) set({ setup: { ...setup, ...answers } });
    };

    // The mic check's mic, while its screen shows. Each check is its own run, so a late answer from one already left is ignored.
    let micCheckRun = 0;
    let closeMicCheck: (() => void) | null = null;
    const onMicCheck = (run: number) => run === micCheckRun && get().setup?.step === 'micCheck';

    const setInputMode = (inputMode: InputMode, micCheckPassed = get().micCheckPassed) => {
      set({ inputMode, micCheckPassed });
      updateDeviceSettings((settings) => ({ ...settings, inputMode, micCheckPassed }));
    };

    const startMicCheck = () => {
      const run = ++micCheckRun;
      deps
        .openMic((level) => {
          if (!onMicCheck(run)) return;
          set({ micLevel: level });
          if (level < MIC_CHECK.heardLevel || get().setup?.mic === 'heard') return;
          answerSetup({ mic: 'heard' });
          setInputMode('mic', true);
        })
        .then(
          (close) => {
            if (!onMicCheck(run)) return close();
            closeMicCheck = close;
            if (get().setup?.mic === 'asking') answerSetup({ mic: 'listening' });
          },
          (error: unknown) => {
            console.warn('[mic] none to be had, so the Typed Fallback:', error instanceof Error ? error.message : error);
            // Refused after Skip is still refused.
            setInputMode('typed');
            if (onMicCheck(run)) answerSetup({ mic: 'unavailable' });
          },
        );
    };

    const stopMicCheck = () => {
      micCheckRun++;
      closeMicCheck?.();
      closeMicCheck = null;
      set({ micLevel: 0 });
    };

    /** Setup is over: the First Morning starts in its slot, saved at once. */
    const startNewGame = (setup: Setup) => {
      stopMicCheck();
      const { targetLanguage, startingStep, characterName, appearancePresetId, skipFirstMorning } = setup;
      set({ setup: null });
      // The pre-selected language counts as chosen too, so it no longer follows the browser's.
      const nativeLanguage = get().nativeLanguage;
      updateDeviceSettings((settings) => ({ ...settings, nativeLanguage }));
      const game = createSave({
        characterName: characterName.trim(),
        targetLanguage: targetLanguage!,
        culturePackId: targetLanguage!,
        startingStep: startingStep!,
        appearancePresetId,
        skipFirstMorning,
        rngSeed: deps.newRngSeed(),
      });
      const startHour = deps.devStartHour();
      play(
        startHour === null ? game : { ...game, clock: { ...game.clock, minuteOfDay: (startHour / 24) * CLOCK.minutesPerDay } },
        setup.slotId,
        'newGame',
      );
      save();
    };

    const readyTitle = () => {
      const title = get().title;
      return get().screen === 'title' && title?.status === 'ready' ? title : null;
    };

    /** Looks at every slot again, for the title screen. */
    const checkSlots = (notice: TitleNotice | null = null) =>
      deps.saves.slots().then(
        (found) => {
          slots = found;
          if (get().screen !== 'title') return;
          const played = found
            .filter((slot) => slot.status !== 'empty')
            .sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt));
          set({
            title: {
              status: 'ready',
              slots: found.map(slotCard),
              continueSlotId: played[0]?.slotId ?? null,
              freeSlotId: found.find((slot) => slot.status === 'empty')?.slotId ?? null,
              notice,
            },
          });
          // Saves from an earlier visit may not have been kept safe.
          if (played.length > 0) void checkPersisted(false);
        },
        (error: unknown) => {
          console.error('[save] the saves could not be read:', error);
          slots = [];
          set({ title: { status: 'failed', message: error instanceof Error ? error.message : String(error) } });
        },
      );

    const setNotice = (notice: TitleNotice) => {
      const title = readyTitle();
      if (title) set({ title: { ...title, notice } });
    };

    /** Hands the Player a file made from a slot, or says it couldn't be made. */
    const download = (make: () => Promise<SaveFile>) =>
      make().then(deps.downloadFile, (error: unknown) => {
        console.error('[save] could not export:', error);
        setNotice({ kind: 'exportFailed' });
      });

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
        conversation: { interactionId: conversation.interaction.id, outcome: outcome.kind, transcript, helpLog: conversation.helpLog },
      };
      const entry = (recap: Recap | null): NewJournalEntry => ({
        kind: 'goal',
        npcId: conversation.npcId,
        npcName: game.people[conversation.npcId]?.knowsName ? CULTURE_PACKS[culturePackId].personas[conversation.npcId].name : null,
        interactionId: conversation.interaction.id,
        placeName: CULTURE_PACKS[culturePackId].cafe.name,
        day: game.clock.day,
        minuteOfDay: game.clock.minuteOfDay,
        targetLanguage,
        nativeLanguage,
        outcome: outcome.kind,
        recap: recap && { outcome: recap.outcome, corrections: recap.corrections, newWords: recap.newWords.map(checkedWord) },
        lines: transcript.map((line, i) => {
          const reading = (lineReadings.get(conversation.id)?.readings ?? conversation.readings)[i];
          return reading && line.speaker === 'npc' ? { ...line, reading: reading.segments } : line;
        }),
        helpLog: conversation.helpLog,
      });
      /** A new word with its reading if that passes the checks, or with the library's. */
      const checkedWord = (word: NewWord): NewWord =>
        hasReadingAids(targetLanguage)
          ? { ...word, reading: wordReading(targetLanguage, word, deps.readings.read(targetLanguage, word.base)) }
          : word;

      updateConversation({ recap: { status: 'writing' } });
      deps
        .requestRecap(request)
        .then(
          (recap) => {
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
          return deps.journal.append(get().slotId, entry(recap));
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
      // With no outcome there's no Journal entry to keep the readings for.
      const conversation = get().conversation;
      if (conversation && !conversation.outcome) lineReadings.delete(conversation.id);
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
            const conversation = { ...current, lines, npcLine: index };
            set({ conversation });
            readLine(conversation, index);
          }),
          onInputTranscript: live((current, text: string) => {
            const { lines, index } = addPiece(current.lines, current.heardLine, 'player', text);
            set({ conversation: { ...current, lines, heardLine: index } });
          }),
          onTurnComplete: live((current) => {
            const finished = current.npcLine;
            // Asked first, so the Journal entry the goodbye starts waits for its reading too.
            if (finished !== null) annotate(current.id, finished, current.lines[finished]!.text);
            // Once the outcome is decided, the turn that just ended was the goodbye.
            if (current.outcome) showClosingCard();
            else updateConversation({ npcLine: null });
          }),
          onToolCall: live((current, call: ToolCall) => session.sendToolResponse(call.id, answerToolCall(current, call))),
          onMicLevel: live((current, level: number) => {
            if (current.listening) set({ micLevel: level });
          }),
          onUsage: live((current, turn: TokenUsage) => set({ conversation: { ...current, usage: addUsage(current.usage, turn) } })),
          onDisconnect: live((current) => connectionFailed(current, npcSession)),
        },
        { resumeFrom, typedOnly: get().inputMode === 'typed' },
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
      setup: null,
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
      readingAids: { show: DEFAULT_DEVICE_SETTINGS.readingAids, romaji: DEFAULT_DEVICE_SETTINGS.showRomaji },
      inputMode: DEFAULT_DEVICE_SETTINGS.inputMode,
      micCheckPassed: DEFAULT_DEVICE_SETTINGS.micCheckPassed,
      journal: null,
      persistCallout: false,
      sign: null,
      openTitle: () => {
        set({ title: { status: 'checking' } });
        // The settings come first, so the title shows in the Player's language.
        settingsWrites
          .then(() => deps.deviceSettings.load())
          .then(
            ({ nativeLanguage, readingAids, showRomaji, inputMode, micCheckPassed }) =>
              set({ nativeLanguage, readingAids: { show: readingAids, romaji: showRomaji }, inputMode, micCheckPassed }),
            (error: unknown) => console.warn('[settings] could not be read:', error),
          )
          .then(() => checkSlots());
      },
      continueGame: () => {
        const continueSlotId = readyTitle()?.continueSlotId;
        if (continueSlotId) get().playSlot(continueSlotId);
      },
      playSlot: (slotId) => {
        const slot = readyTitle() ? slots.find((s) => s.slotId === slotId) : undefined;
        if (slot?.status === 'ready') playLoaded(slot);
      },
      newGame: () => {
        const freeSlotId = readyTitle()?.freeSlotId;
        if (!freeSlotId) return;
        // The Native Language from the device settings: the one the browser suggests, until the Player chooses.
        set({
          screen: 'setup',
          title: null,
          setup: {
            slotId: freeSlotId,
            step: 'nativeLanguage',
            targetLanguage: null,
            startingStep: null,
            characterName: '',
            appearancePresetId: APPEARANCE_PRESET_IDS[0],
            mic: null,
            skipFirstMorning: false,
          },
        });
      },
      setNativeLanguage: (nativeLanguage) => {
        const setup = get().setup;
        // A Target Language can't be the Native Language, so one just made it is forgotten.
        set({ nativeLanguage, setup: setup?.targetLanguage === nativeLanguage ? { ...setup, targetLanguage: null } : setup });
        updateDeviceSettings((settings) => ({ ...settings, nativeLanguage }));
      },
      chooseTargetLanguage: (targetLanguage) => {
        if (targetLanguage !== get().nativeLanguage) answerSetup({ targetLanguage });
      },
      chooseStartingStep: (startingStep) => answerSetup({ startingStep }),
      nameCharacter: (characterName) => answerSetup({ characterName: [...characterName.trimStart()].slice(0, CHARACTER_NAME.maxLength).join('') }),
      chooseAppearance: (appearancePresetId) => answerSetup({ appearancePresetId }),
      chooseSkipFirstMorning: (skipFirstMorning) => answerSetup({ skipFirstMorning }),
      setupNext: () => {
        const { setup, nativeLanguage, micCheckPassed } = get();
        if (get().screen !== 'setup' || !setup || !setupAnswered(setup, nativeLanguage)) return;
        const next = nextSetupStep(setup.step, micCheckPassed);
        if (!next) return startNewGame(setup);
        set({ setup: { ...setup, step: next, mic: next === 'micCheck' ? 'asking' : null } });
        if (next === 'micCheck') startMicCheck();
      },
      setupBack: () => {
        const setup = get().setup;
        if (get().screen !== 'setup' || !setup) return;
        if (setup.step === 'micCheck') stopMicCheck();
        const before = SETUP_STEPS[SETUP_STEPS.indexOf(setup.step) - 1];
        if (before) return set({ setup: { ...setup, step: before, mic: null } });
        set({ screen: 'title', setup: null, title: { status: 'checking' } });
      },
      skipMicCheck: () => {
        const setup = get().setup;
        if (get().screen === 'setup' && setup?.step === 'micCheck') startNewGame(setup);
      },
      exportSave: (slotId) => void download(() => exportSave(stores, slotId)),
      exportRawSave: (slotId) => void download(() => exportRawSave(stores, slotId)),
      importSave: (contents) => {
        const freeSlotId = readyTitle()?.freeSlotId;
        if (!freeSlotId) return;
        askToPersist();
        importSave(stores, freeSlotId, contents).then(
          () => checkSlots({ kind: 'imported', slotId: freeSlotId }),
          (error: unknown) => {
            console.warn('[save] import refused:', error instanceof Error ? error.message : error);
            setNotice(error instanceof ImportRefused ? { kind: 'importRefused', problem: error.problem } : { kind: 'importFailed' });
          },
        );
      },
      deleteSave: (slotId, typedName) => {
        const card = readyTitle()?.slots.find((slot) => slot.slotId === slotId);
        if (!card || card.status === 'empty' || typedName.trim() !== nameToDelete(card)) return;
        deleteSave(stores, slotId).then(
          () => checkSlots(),
          (error: unknown) => {
            console.error('[save] could not delete:', error);
            setNotice({ kind: 'deleteFailed' });
          },
        );
      },
      dismissTitleNotice: () => {
        const title = readyTitle();
        if (title?.notice) set({ title: { ...title, notice: null } });
      },
      dismissPersistCallout: () => {
        set({ persistCallout: false });
        updateDeviceSettings((settings) =>
          settings.tooltipsSeen.includes(PERSIST_REFUSED) ? null : { ...settings, tooltipsSeen: [...settings.tooltipsSeen, PERSIST_REFUSED] },
        );
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
        const before = get().game;
        const game = enterPlace(before, placeId, placeHours(placeId, before.identity.culturePackId));
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
        if (conversation || get().journal || !isNpc(interactable) || !isAtWork(interactable, game)) return;
        const npc = NAMED_NPCS[interactable];
        const interaction = Object.values(INTERACTIONS).find((i) => i.npcId === npc.id)!;
        gameBeforeConversation = game;
        const id = ++conversations;
        lineReadings.set(id, { readings: {}, annotating: [] });
        const npcSession = buildNpcSession(interaction, CULTURE_PACKS[game.identity.culturePackId], game.proficiencyStep, npc, {
          clock: game.clock,
        });

        set({
          voiceUnavailable: false,
          conversation: {
            id,
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
            tab: 'chat',
            hints: null,
            annotations: {},
            translated: [],
            readings: {},
            helpLog: [],
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
        if (!conversation.closed) next = logHelp(next, 'translate', [npcLine.text]);
        if (next !== conversation) set({ conversation: next });
        const annotation = conversation.annotations[line];
        if (!annotation || annotation.status === 'failed') annotate(conversation.id, line, npcLine.text);
      },
      setReadingAids: (change) => {
        const readingAids = { ...get().readingAids, ...change };
        set({ readingAids });
        updateDeviceSettings((settings) => ({ ...settings, readingAids: readingAids.show, showRomaji: readingAids.romaji }));
      },
      addToPhrasebook: (word, glossLanguage) => {
        const game = addToPhrasebook(get().game, { text: word.base, reading: word.reading, gloss: word.gloss, glossLanguage });
        if (game === get().game) return;
        set({ game });
        save();
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

/** The setup screen after this one, if any. A browser that has passed the mic check skips it. */
function nextSetupStep(step: SetupStep, micCheckPassed: boolean): SetupStep | undefined {
  const next = SETUP_STEPS[SETUP_STEPS.indexOf(step) + 1];
  return next === 'micCheck' && micCheckPassed ? undefined : next;
}

/** Whether the setup screen showing has what it needs to go on. */
function setupAnswered(setup: Setup, nativeLanguage: LanguageCode) {
  switch (setup.step) {
    case 'nativeLanguage':
    case 'appearance':
      return true;
    case 'targetLanguage':
      return setup.targetLanguage !== null && setup.targetLanguage !== nativeLanguage;
    case 'aboutYou':
      return setup.startingStep !== null && setup.characterName.trim() !== '';
    // Start waits for the check to hear the Player or find no mic; Skip doesn't.
    case 'micCheck':
      return setup.mic === 'heard' || setup.mic === 'unavailable';
  }
}

/** New game setup, while it shows: its screen and the answers so far. */
export const selectSetup = (s: GameStore) => s.setup;
export const selectSetupCanGoOn = (s: GameStore) => s.setup !== null && setupAnswered(s.setup, s.nativeLanguage);
/** Whether the setup screen showing is the last, so going on starts the game. */
export const selectSetupIsLast = (s: GameStore) => s.setup !== null && !nextSetupStep(s.setup.step, s.micCheckPassed);
export const selectInputMode = (s: GameStore) => s.inputMode;
const TARGET_LANGUAGES = Object.fromEntries(
  LANGUAGE_CODES.map((native) => [native, LANGUAGE_CODES.filter((language) => language !== native)]),
) as Record<LanguageCode, LanguageCode[]>;
/** The Target Languages on offer: every language but the Native Language. */
export const selectTargetLanguages = (s: GameStore) => TARGET_LANGUAGES[s.nativeLanguage];
export const selectTitle = (s: GameStore) => s.title;
export const selectArrival = (s: GameStore) => s.arrival;
export const selectSavedCount = (s: GameStore) => s.savedCount;
export const selectPersistCallout = (s: GameStore) => s.persistCallout;
/** The place the title screen shows: where the Continue save was left, or home. */
export const selectTitlePlaceId = (s: GameStore): PlaceId => {
  const title = s.title?.status === 'ready' ? s.title : null;
  const card = title?.slots.find((slot) => slot.slotId === title.continueSlotId);
  return card?.status === 'ready' ? card.placeId : 'home';
};

export const selectTimeScale = (s: GameStore) => {
  if (s.tabHidden || s.journal || s.conversation?.tab === 'help') return CLOCK.timeScale.paused;
  return s.conversation ? CLOCK.timeScale.conversation : CLOCK.timeScale.normal;
};
export const selectHealth = (s: GameStore) => s.game.character.health;
export const selectHunger = (s: GameStore) => s.game.character.hunger;
export const selectThirst = (s: GameStore) => s.game.character.thirst;
export const selectMood = (s: GameStore) => s.game.character.mood;
export const selectMoneyInShifts = (s: GameStore) => s.game.character.moneyInShifts;
export const selectCulturePackId = (s: GameStore) => s.game.identity.culturePackId;
export const selectTargetLanguage = (s: GameStore) => s.game.identity.targetLanguage;
export const selectDay = (s: GameStore) => s.game.clock.day;
export const selectWeekday = (s: GameStore) => weekdayOf(s.game.clock.day);
/** Whole game minutes since midnight, so the clock re-renders once a game minute. */
export const selectClockMinute = (s: GameStore) => Math.floor(s.game.clock.minuteOfDay);
export const selectPlaceId = (s: GameStore) => s.game.placeId;
/** What E would use here. Staff at a closed place don't count: there's no one to talk to. */
export const selectInteractable = (s: GameStore) =>
  isNpc(s.interactable) && !isAtWork(s.interactable, s.game) ? null : s.interactable;
/** The current place's opening hours in this pack, for the place line above the dock. */
export const selectPlaceHours = (s: GameStore) => placeHours(s.game.placeId, s.game.identity.culturePackId);
/** Any place is open now: the world shuts the door of one that isn't. */
export const selectIsOpen = (placeId: PlaceId) => (s: GameStore) => isPlaceOpen(placeId, s.game);
export const selectPlaceOpen = (s: GameStore) => selectIsOpen(s.game.placeId)(s);
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
export const selectReadingAids = (s: GameStore) => s.readingAids;

export const selectSignTooltip = (s: GameStore) => s.sign?.tooltip ?? null;
/** An NPC line's reading aid, unless reading aids are hidden. */
export const selectLineReading =
  (line: number) =>
  (s: GameStore): Segment[] | null =>
    s.readingAids.show ? (s.conversation?.readings[line]?.segments ?? null) : null;
/** The NPC partway through saying a line, for the "speaking…" indicator over them. */
export const selectNpcSpeaking = (s: GameStore): NamedNpcId | null =>
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
