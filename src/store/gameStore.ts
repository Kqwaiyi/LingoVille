import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import {
  basketChangedScene,
  buildNpcSession,
  buildShiftCustomerSession,
  shiftCustomerChangeScene,
  checkReadings,
  hasReadingAids,
  NOT_UNDERSTOOD_TOOL,
  OUT_OF_PATIENCE_SCENE,
  shiftCustomerServedScene,
  tableServedScene,
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
  type ShiftRecapCustomer,
  type ToolResponse,
} from '../ai/index.ts';
import {
  APPEARANCE_PRESET_IDS,
  approachInteraction,
  CULTURE_PACKS,
  DEFAULT_DRINK,
  GROCERIES_SOLD,
  interactionStartedWithE,
  isDrink,
  interactionStartedWithF,
  jobAt,
  JOB_PLACES,
  localPlaceName,
  NAMED_NPCS,
  OPEN_AIR_PLACES,
  placeHours,
  placePhrasebook,
  RESTAURANT_DISHES,
  SHIFT_MENUS,
  shiftTemplates,
  tillFor,
  worldSign,
  type AppearancePresetId,
  type DietaryNoteId,
  type DrinkExtra,
  type DrinkModifiers,
  type DrinkSize,
  type DrinkTemperature,
  type GroceryId,
  type Interaction,
  type ItemId,
  type NamedNpcId,
  type PlacePhrase,
  type SignId,
  stopsBetween,
  TOWN_NPCS,
  TRAM_LINE,
  type TownNpcId,
  type TramStopId,
} from '../content/index.ts';
import {
  addToBasket,
  addToPhrasebook,
  applyInteractionOutcome,
  applyShiftCustomer,
  cancelShift,
  approachDue,
  applyRecapEvidence,
  applyShiftEvidence,
  bedUsable,
  CHARACTER_NAME,
  CLOCK,
  cook,
  createSave,
  drinkWater,
  ECONOMY,
  faintedBetween,
  endShift,
  enterPlace,
  hallwayApproach,
  hallwayApproachMade,
  gameMinutesFor,
  isGoneOff,
  isOpen,
  isOutOfPatience,
  LANGUAGE_CODES,
  isUnreadableTranscript,
  jobAids,
  lifeSkillLevels,
  MIC_CHECK,
  losePatience,
  moodFace,
  newPlayerTurn,
  nextShiftCustomer,
  npcExpression,
  putBackFromBasket,
  rentStatement,
  rideTram,
  SAVE,
  shiftRefusal,
  sleep,
  startPatience,
  startShift,
  tick,
  tramTripMinutes,
  weekdayOf,
  type ApproachId,
  type Basket,
  type ShiftOrder,
  addToTray,
  addPadLine,
  choosePadLine,
  clearTray,
  EMPTY_PAD,
  kitchenOrder,
  noteOnPad,
  removePadLine,
  writeOnPad,
  type Diner,
  type OrderPad,
  type PadDiner,
  changeOwed,
  coinsTotal,
  EMPTY_TRAY,
  suggestChange,
  tillTotal,
  type Checkout,
  type TillWork,
  redoTray,
  undoTray,
  type TrayHistory,
  type ConversationEvidence,
  type GameState,
  type InventoryItem,
  type LifeSkillId,
  type LanguageCode,
  type NewGameSetup,
  type NpcExpression,
  type OutcomeResult,
  type Patience,
  type PhrasebookEntry,
  type JobId,
  type PlaceId,
  type Shift,
  type ShiftRefusal,
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

/** Builds the NPC's session for a conversation, given the shopping on the counter at the time. */
type SessionFor = (onCounter: Basket) => NpcSession;

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

/** Dev only: Health for a game started about to faint: a few real seconds' worth with Hunger and Thirst empty. */
const DEV_FAINT_SOON_HEALTH = 0.5;

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

/** Something in the world the Character is close enough to use with E: the tap, an NPC to talk to, or a tram stop. */
export type Interactable = 'tap' | 'stove' | 'bed' | 'staff-door' | TownNpcId | TramStopId | GroceryId;

/** One thing in the inventory, and whether it has gone off yet. */
export type InventoryLine = InventoryItem & { goneOff: boolean };

/** Where the tram can take the Character from a stop, and how long each trip takes. */
export type TramDestination = { stopId: TramStopId; minutes: number };

/** The tram has just set the Character down at this stop. Each trip is a new object, so the world moves the Character once per ride. */
export type TramArrival = { stopId: TramStopId };

/** A line of the conversation. A typed player line is marked, so the Recap knows it wasn't misheard. */
export type ChatLine = TranscriptLine & { typed?: true };

/** A short notice over the game that clears itself. */
export type Toast =
  /** A network abandonment: the NPC (null for a Shift Customer, who is replaced) had to step away. */
  | { kind: 'npcSteppedAway'; npcId: NamedNpcId | null }
  | { kind: 'recapSaved' }
  | { kind: 'loadedBackup' }
  /** The bed is used before 20:00. */
  | { kind: 'tooEarlyForBed' }
  /** The stove is used with no groceries in the inventory. */
  | { kind: 'nothingToCook' }
  /** Staff standing in for a conversation that a later ticket brings. */
  | { kind: 'nothingToSay'; npcId: TownNpcId };

/**
 * The Shift is over: how it went and what it paid, shown until the Player closes it, with its one combined Recap
 * (null if there was nothing to write it from, as when a reload ended the Shift).
 */
export type ShiftEnd = { jobId: JobId; customers: number; served: number; payInShifts: number; recap: RecapView | null };

/** The staff door the Character is at: whether E starts a Shift there now (`refusal` null), or why not. */
export type StaffDoor = { jobId: JobId; refusal: Exclude<ShiftRefusal, 'underway'> | null };

/** The Fainting screen: the Character has fainted and is out until the Player wakes them in the ward. Shows what the bill was and whether it was paid. */
export type Fainting = { billInShifts: number; paid: boolean };

/** The Character has fainted and is taken to the ward. Each Fainting is a new object, so the world moves the Character into the ward bed once per Fainting. */
export type WardArrival = { wokeInWardOnDay: number };

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

/** How a Shift Customer was dealt with: served what they ordered, served something else, or gone unserved. */
export type ShiftCustomerOutcome = { kind: ShiftRecapCustomer['result'] };

/**
 * The Shift Customer at the counter, as the conversation shows them: what the Player has put on the tray to serve
 * (and can undo and redo), how the modifier toggles say the next drink is made, and whether a customer who changes
 * their mind has been told the Player has started on their order. At the till, the tray is what's been scanned and
 * fetched, and the rest is the till: the bag and points card toggles, the cash the Player keyed in as handed over
 * (null until they do), and the coins and notes counted out as change. At a restaurant table, the order pad.
 */
export type ShiftCustomerView = TrayHistory & {
  making: DrinkModifiers;
  startedOn: boolean;
  bag: boolean;
  pointsCard: boolean;
  received: number | null;
  change: readonly number[];
  pad: OrderPad;
};

/** A Shift Customer walks up to an empty tray, with the toggles set to make the default drink, an empty till and a fresh order pad. */
const NEW_SHIFT_CUSTOMER: ShiftCustomerView = {
  ...EMPTY_TRAY,
  making: DEFAULT_DRINK,
  startedOn: false,
  bag: false,
  pointsCard: false,
  received: null,
  change: [],
  pad: EMPTY_PAD,
};

/** A Shift Customer the Player dealt with, kept for the Shift's Recap: their order, how it went, and their conversation once they've gone. */
type ShiftLogEntry = {
  conversationId: number;
  order: ShiftOrder;
  changedFrom: ShiftOrder | null;
  /** At the till: what else they wanted, and what the Player did about it. */
  checkout: Checkout | null;
  atTheTill: TillWork | null;
  /** At a restaurant table: what each diner wanted, and what the Player wrote on the order pad. */
  table: readonly Diner[] | null;
  atTheTable: readonly PadDiner[] | null;
  result: ShiftCustomerOutcome['kind'];
  served: ShiftOrder;
  conversation: Conversation | null;
};

/** Who the conversation is with: a Named NPC in a Goal Interaction, or an anonymous Shift Customer. */
type Partner =
  | { npcId: NamedNpcId; interaction: Interaction; shiftCustomer: null }
  | { npcId: null; interaction: null; shiftCustomer: ShiftCustomerView };

/**
 * A conversation under way. It lives only here. A Goal Interaction is never saved in progress,
 * and leaving before its outcome is decided changes nothing. A Shift Customer left unserved is failed.
 */
export type Conversation = ConversationState & Partner;

/** A conversation with a Named NPC, which ends with a closing card and a Recap. */
type NpcConversation = Extract<Conversation, { shiftCustomer: null }>;

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
  /** What the Character brought to the counter: at the till, the shopping to pay for. */
  basket: Basket;
  /** The outcome is applied; the session closes once the NPC finishes saying goodbye. At a Shift, the next customer then walks up. */
  outcome: ClosingCard | ShiftCustomerOutcome | null;
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
  /** Dev only: a new game starts on this day (rent is still first due on day 7), or on day 1 (null). */
  devStartDay: () => number | null;
  /** Dev only: a new game starts about to faint, with money for the bill or (`broke`) none, or as usual (null). */
  devFaintSoon: () => 'paying' | 'broke' | null;
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
  devStartDay: devStartDayFromUrl,
  devFaintSoon: devFaintSoonFromUrl,
  openMic: openBrowserMic,
};

/** Dev only: `?at=9` starts a new game at 09:00, so a smoke test can reach a place that opens after the First Morning. */
function devStartHourFromUrl(): number | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const hour = Number(new URLSearchParams(window.location.search).get('at') ?? NaN);
  return Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour : null;
}

/** Dev only: `?day=7` starts a new game on day 7, so a smoke test can reach the day rent falls due. */
function devStartDayFromUrl(): number | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const day = Number(new URLSearchParams(window.location.search).get('day') ?? NaN);
  return Number.isInteger(day) && day >= 1 ? day : null;
}

/** Dev only: `?faint` starts a new game seconds from Fainting, so a smoke test can reach the ward; `?faint=broke` with no money. */
function devFaintSoonFromUrl(): 'paying' | 'broke' | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const faint = new URLSearchParams(window.location.search).get('faint');
  if (faint === null) return null;
  return faint === 'broke' ? 'broke' : 'paying';
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
  /** The Player is choosing where to take the tram. */
  tramChoosing: boolean;
  /** An NPC has come up to the Character and stopped them: walking keys held then don't count until they are let go. */
  heldStill: boolean;
  tramArrival: TramArrival | null;
  conversation: Conversation | null;
  /** What the Character has taken off the supermarket's shelves and not paid for yet. Never saved. */
  basket: Basket;
  /** The grocery the cashier last pointed to, marked on its shelf until the Character takes one or leaves. */
  shelfMarker: GroceryId | null;
  /** The typed field has focus, so keys type into it instead of moving or acting. */
  typing: boolean;
  /** How loud the Player is while push-to-talk is held, or on the mic check, from 0 to 1. */
  micLevel: number;
  toast: Toast | null;
  /** No token could be minted for a conversation, so the "Voice service unavailable" screen shows. */
  voiceUnavailable: boolean;
  /** The full-screen Journal, while it is open. */
  journal: JournalView | null;
  /** The Fainting screen, while it shows. Time stands still behind it. */
  fainting: Fainting | null;
  wardArrival: WardArrival | null;
  /** What the Shift that just ended paid, until the Player closes it. */
  shiftEnd: ShiftEnd | null;
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
  /** E at a tram stop while the trams run: choose a stop to ride to. */
  openTram: () => void;
  closeTram: () => void;
  /** No walking key is held any more, so the Character can walk again after an NPC stopped them. */
  letGoOfWalkKeys: () => void;
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
  drinkWater: () => void;
  /** E at the stove: cooks a grocery into a meal, or says there's nothing to cook. */
  cook: () => void;
  /** E at a supermarket shelf: one of its grocery into the basket. */
  takeFromShelf: () => void;
  /** Puts one of an item in the basket back on its shelf. */
  putBack: (itemId: ItemId) => void;
  /** Closes the Fainting screen: the Character wakes in the ward bed, and the nurse comes over. */
  wakeInWard: () => void;
  /** Goes to bed at home: from 20:00, it wakes the next morning and saves; earlier, it says it's too early. */
  sleep: () => void;
  /** E at a staff door during opening hours, once hired there: starts the day's Shift, and the first Shift Customer walks up. */
  startShift: () => void;
  /** Taps the menu grid: one more of the item onto the tray for the Shift Customer, a drink made as the toggles say. */
  tapMenuItem: (itemId: ItemId) => void;
  /** The modifier toggles: how the next drink tapped is made. */
  setDrinkSize: (size: DrinkSize) => void;
  setDrinkTemperature: (temperature: DrinkTemperature) => void;
  toggleDrinkExtra: (extra: DrinkExtra) => void;
  clearTray: () => void;
  /** Takes back the last change to the tray, or puts back the last one taken back. */
  undoTray: () => void;
  redoTray: () => void;
  /** At the till: the bag and points card toggles for the customer at the till. */
  toggleBag: () => void;
  togglePointsCard: () => void;
  /** Keys in the cash the customer handed over, in local money (null clears it), so the till works out the change due. */
  setCashReceived: (amount: number | null) => void;
  /** One more of the pack's coins or notes onto the change counted out. */
  addChangeCoin: (coin: number) => void;
  clearChange: () => void;
  /** The Cashier skill's aid: counts out the change due for the cash keyed in, with the fewest coins. */
  suggestChange: () => void;
  /** At a restaurant table: another diner's line on the order pad, which line is written on, and taking the one written on off. */
  addPadDiner: () => void;
  choosePadDiner: (index: number) => void;
  removePadDiner: () => void;
  /** Notes a dietary need on the order pad line being written (null takes it off). */
  setDietaryNote: (note: DietaryNoteId | null) => void;
  /**
   * Hands the Shift Customer what is on the tray (at the till: finishes the sale; at a table: sends the order pad to the
   * kitchen). It is checked exactly against their order.
   */
  serveTray: () => void;
  /** Closes the pay shown at the end of a Shift. */
  closeShiftEnd: () => void;
  /** E near an NPC (or F, for their second conversation if they have one): opens a conversation, and the NPC speaks first. */
  talk: (key?: 'E' | 'F') => void;
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

const isTownNpc = (interactable: Interactable | null): interactable is TownNpcId =>
  interactable !== null && interactable in TOWN_NPCS;

const isTramStop = (interactable: Interactable | null): interactable is TramStopId =>
  (TRAM_LINE as readonly (Interactable | null)[]).includes(interactable);

const isShelf = (interactable: Interactable | null): interactable is GroceryId =>
  (GROCERIES_SOLD as readonly (Interactable | null)[]).includes(interactable);

/** It's open now in the Character's pack. Closing time stops new conversations and Shifts from starting here. */
const isPlaceOpen = (placeId: PlaceId, game: GameState) => isOpen(placeHours(placeId, game.identity.culturePackId), game.clock);

/** The Job whose staff door the Character is at, or null. */
const staffDoorJob = (interactable: Interactable | null, game: GameState): JobId | null =>
  interactable === 'staff-door' ? jobAt(game.placeId) : null;

/** Why E at this Job's staff door can't start a Shift now, or null if it can. Closing time stops new Shifts, never one under way. */
const staffDoorRefusal = (jobId: JobId, game: GameState) =>
  shiftRefusal(game, jobId, placeHours(JOB_PLACES[jobId], game.identity.culturePackId));

/** A Goal Interaction's outcome, which its closing card shows, rather than a Shift Customer's. */
const isClosingCard = (outcome: Conversation['outcome']): outcome is ClosingCard => outcome?.kind === 'success' || outcome?.kind === 'failure';

/** Staff can be talked to only while their place is open. Closing time stops new conversations, never one under way. */
const isAtWork = (npcId: TownNpcId, game: GameState) =>
  isOpen(placeHours(TOWN_NPCS[npcId].hoursId, game.identity.culturePackId), game.clock);

/** The trams run now: the tram stop's hours are theirs. */
const tramsRunning = (game: GameState) => isPlaceOpen('tram-stop', game);

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
  // The Shift Customers dealt with so far this Shift, for its one combined Recap. One lost to the network isn't among them.
  let shiftLog: ShiftLogEntry[] = [];
  // Tells each Shift's end apart, so a late Shift Recap only lands on the end it was written for.
  let shiftsEnded = 0;
  // The size the Player last set on the toggles this Shift: with the Barista skill's remembered size, the next customer starts at it.
  let sizeLastSet: DrinkSize | null = null;
  // An NPC due to come up to the Character while the Player is busy, who waits until the Player is free.
  let pendingApproach: ApproachId | null = null;
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
    const save = ({ startsDay = false } = {}) => {
      const { screen, conversation, slotId } = get();
      if (screen !== 'playing') return;
      askToPersist();
      const game = conversation && !conversation.outcome && gameBeforeConversation ? gameBeforeConversation : get().game;
      realMsSinceSave = 0;
      // Started at once: IndexedDB runs writes in the order they began, so an older game never lands after a newer one.
      deps.saves.write(slotId, game, { startsDay }).then(
        () => set({ savedCount: get().savedCount + 1 }),
        (error: unknown) => console.error('[save] could not save:', error),
      );
    };

    const play = (game: GameState, slotId: string, arrival: Arrival, toast: Toast | null = null) => {
      realMsSinceSave = 0;
      // A Shift from another game is over without its Recap: its customers' readings go too.
      shiftLog.forEach(({ conversationId }) => lineReadings.delete(conversationId));
      shiftLog = [];
      set({ screen: 'playing', title: null, game, slotId, arrival, toast, basket: [], shelfMarker: null });
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

    /** Plays a loaded save. A Shift saved under way ends at once, paid for the customers already served. */
    const playLoaded = ({ save, fromBackup }: LoadedSave) => {
      play(save.game, save.slotId, 'continued', fromBackup ? { kind: 'loadedBackup' } : null);
      finishShift();
    };

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
      const startDay = deps.devStartDay();
      const faintSoon = deps.devFaintSoon();
      const onDay = startDay === null ? game : { ...game, clock: { ...game.clock, day: startDay } };
      const atHour = startHour === null ? onDay : { ...onDay, clock: { ...onDay.clock, minuteOfDay: (startHour / 24) * CLOCK.minutesPerDay } };
      play(
        faintSoon === null
          ? atHour
          : {
              ...atHour,
              character: {
                ...atHour.character,
                health: DEV_FAINT_SOON_HEALTH,
                hunger: 0,
                thirst: 0,
                ...(faintSoon === 'broke' && { moneyInShifts: 0 }),
              },
            },
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

    const updateConversation = (change: Partial<ConversationState>) => {
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

    /** A Recap's evidence moves the hidden Language Proficiency (`apply`), which is saved at once. */
    const applyEvidence = (apply: (game: GameState) => GameState) => {
      // A later conversation may have begun: a save during it writes the game from before it, which needs the evidence too.
      if (gameBeforeConversation) gameBeforeConversation = apply(gameBeforeConversation);
      set({ game: apply(get().game) });
      save();
    };

    const applyProficiencyEvidence = (conversation: NpcConversation, recap: Recap) => {
      const evidence: ConversationEvidence = {
        cefrEstimate: recap.cefrEstimate,
        lines: conversation.lines.map(({ speaker, text }) => ({ speaker, text })),
        helpLog: conversation.helpLog,
        notUnderstoodTurns: conversation.patience.turnsNotUnderstood,
      };
      applyEvidence((game) => applyRecapEvidence(game, evidence));
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
    const writeRecap = (conversation: NpcConversation, outcome: ClosingCard) => {
      const { game, nativeLanguage } = get();
      const { culturePackId, targetLanguage } = game.identity;
      const transcript = transcriptOf(conversation.lines);
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
        placeName: localPlaceName(conversation.interaction.placeId, culturePackId),
        day: game.clock.day,
        minuteOfDay: game.clock.minuteOfDay,
        targetLanguage,
        nativeLanguage,
        outcome: outcome.kind,
        recap: recap && journalRecap(recap, targetLanguage),
        lines: transcript.map((line, i) => {
          const reading = (lineReadings.get(conversation.id)?.readings ?? conversation.readings)[i];
          return reading && line.speaker === 'npc' ? { ...line, reading: reading.segments } : line;
        }),
        helpLog: conversation.helpLog,
      });
      updateConversation({ recap: { status: 'writing' } });
      deps
        .requestRecap(request)
        .then(
          (recap) => {
            applyProficiencyEvidence(conversation, recap);
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
      // A Shift Customer out of Patience gives up unserved.
      if (conversation.shiftCustomer) {
        settleShiftCustomer(null);
        return true;
      }
      const { state, result } = applyInteractionOutcome(get().game, conversation.interaction, { kind: 'failure' });
      if (result.kind === 'failure') settleOutcome(state, result);
      return true;
    };

    const answerToolCall = (conversation: Conversation, { name, args }: ToolCall): ToolResponse => {
      if (name === NOT_UNDERSTOOD_TOOL) return { result: notUnderstood(conversation) ? 'out_of_patience' : 'noted' };
      // A Shift Customer has no completion: what they're served is checked by the game.
      if (!conversation.interaction || name !== conversation.interaction.completion.name || conversation.outcome) return { result: 'unknown_tool' };

      const { basket, interaction } = conversation;
      const { state, result } = applyInteractionOutcome(get().game, interaction, { kind: 'success', args, basket });
      switch (result.kind) {
        case 'success':
          // Paid-for shopping leaves the basket for the inventory; an item pointed to is marked on its shelf.
          if (interaction.effect.kind === 'purchase') set({ basket: [] });
          if (result.pointedTo) set({ shelfMarker: result.pointedTo.itemId as GroceryId });
          settleOutcome(state, result);
          // An order or shopping is handed over; anything else is simply done.
          return { result: interaction.effect.kind === 'serveOrder' || interaction.effect.kind === 'purchase' ? 'served' : 'done' };
        case 'cannot_afford':
          return { result: 'cannot_afford' };
        case 'invalid_arguments':
          return { result: 'invalid_arguments', error: result.error };
        case 'wrong_name':
          return { result: 'wrong_name' };
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
      // Hints are written for a Goal Interaction's goal, or at a Shift for the Job's own lines (free, like all Help).
      const jobId = conversation.shiftCustomer ? game.possessions.shift?.jobId : undefined;
      const about = conversation.interaction ? { interactionId: conversation.interaction.id } : jobId ? { jobId } : null;
      if (!about) return { ...conversation, hints: { atLine, view: { status: 'failed' } } };
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
          ...about,
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

    /** The session is over. A Goal Interaction shows its closing card and starts its Recap; at a Shift, the customer leaves instead. */
    const showClosingCard = () => {
      if (get().conversation?.shiftCustomer) return shiftCustomerLeft();
      closeSession();
      updateConversation({ closed: true, npcLine: null, listening: false });
      set({ typing: false, micLevel: 0 });
      const conversation = get().conversation;
      if (conversation?.shiftCustomer === null && isClosingCard(conversation.outcome) && !conversation.recap) {
        writeRecap(conversation, conversation.outcome);
      }
    };

    /**
     * The Shift Customer at the counter is dealt with: served what is on the tray, or gone unserved (null). The sim
     * checks it exactly, and it's saved. One the Player had translated a line of is docked a share even if served right.
     * The customer says goodbye next, then leaves. At the till, `atTheTill` is what was done there; at a table,
     * `atTheTable` is the order pad. Returns whether it was their order.
     */
    const settleShiftCustomer = (served: ShiftOrder | null, { atTheTill, atTheTable }: { atTheTill?: TillWork; atTheTable?: readonly PadDiner[] } = {}) => {
      const { game, conversation } = get();
      const customer = game.possessions.shift?.customer;
      const translated = (conversation?.translated.length ?? 0) > 0;
      const { state, correct } = applyShiftCustomer(game, served, { translated, atTheTill, atTheTable });
      const result = correct ? 'served' : served ? 'wrongOrder' : 'walkedOut';
      if (customer && conversation) {
        const { order, changedFrom, checkout, table } = customer;
        shiftLog.push({
          conversationId: conversation.id,
          order,
          changedFrom,
          checkout,
          atTheTill: atTheTill ?? null,
          table,
          atTheTable: table ? (atTheTable ?? []) : null,
          result,
          served: served ?? [],
          conversation: null,
        });
      }
      set({ game: state });
      updateConversation({ outcome: { kind: result } });
      save();
      return correct;
    };

    /** Changes the Shift Customer at the counter as the conversation shows them (the tray, the toggles), while they can still be served. */
    const changeShiftCustomer = (change: (view: ShiftCustomerView) => ShiftCustomerView) => {
      const conversation = get().conversation;
      if (!conversation?.shiftCustomer || conversation.outcome) return;
      set({ conversation: { ...conversation, shiftCustomer: change(conversation.shiftCustomer) } });
    };

    /**
     * Once the Player has started on their order (something is on the tray), a Shift Customer who changes their mind
     * is told, once, as soon as they can hear it: at once, or when a dropped connection is back.
     */
    const tellStartedOn = () => {
      const conversation = get().conversation;
      const view = conversation?.shiftCustomer;
      if (!view || view.startedOn || view.tray.length === 0 || !get().game.possessions.shift?.customer?.changedFrom) return;
      if (!canTakeTurn(conversation) || !voice) return;
      changeShiftCustomer((before) => ({ ...before, startedOn: true }));
      voice.sendText(shiftCustomerChangeScene());
    };

    /**
     * A Shift Customer's conversation is over: if they were dealt with, it's kept for the Shift's Recap, with its
     * readings until the Journal entry is written. One lost before they were dealt with is forgotten.
     */
    const keepShiftCustomerLines = (conversation: Conversation) => {
      const logged = shiftLog.find((entry) => entry.conversationId === conversation.id);
      if (logged) logged.conversation = conversation;
      else lineReadings.delete(conversation.id);
    };

    /** The Shift is over: it's paid, the pay shows, and it's saved. Any customer still at the counter goes. Its Recap is written from every customer dealt with. */
    const finishShift = () => {
      const { shift } = get().game.possessions;
      if (!shift) return;
      closeSession();
      const conversation = get().conversation;
      if (conversation?.shiftCustomer) keepShiftCustomerLines(conversation);
      const log = shiftLog;
      shiftLog = [];
      const shiftId = ++shiftsEnded;
      const { state, payInShifts } = endShift(get().game);
      const { jobId, customers, served } = shift;
      const recap: RecapView | null = log.length > 0 ? { status: 'writing' } : null;
      set({ game: state, conversation: null, typing: false, micLevel: 0, shiftEnd: { jobId, customers, served, payInShifts, recap } });
      save();
      if (log.length > 0) writeShiftRecap(shiftId, shift, log);
      approachIfFree();
    };

    /**
     * Writes the Shift's one combined Recap over every customer dealt with, the moment it ends. Its evidence moves
     * Proficiency, with the Shift's results as listening evidence, and it goes to the Journal as one entry.
     */
    const writeShiftRecap = (shiftId: number, { jobId, customers, served }: Shift, log: ShiftLogEntry[]) => {
      const { game, nativeLanguage } = get();
      const { culturePackId, targetLanguage } = game.identity;
      const listenedAt = game.proficiencyStep;
      const dealtWith: ShiftRecapCustomer[] = log.map(({ order, changedFrom, checkout, atTheTill, table, atTheTable, result, served: handed, conversation }) => ({
        order,
        ...(changedFrom && { changedFrom }),
        ...(checkout && { checkout }),
        result,
        served: handed,
        ...(atTheTill && { atTheTill }),
        ...(table && { table }),
        ...(atTheTable && { atTheTable }),
        transcript: transcriptOf(conversation?.lines ?? []),
        helpLog: conversation?.helpLog ?? [],
      }));
      const request: RecapRequest = { kind: 'shift', jobId, culturePackId, step: listenedAt, nativeLanguage, customers: dealtWith };
      // Every customer's lines in order, each marked with its customer, and the Help log placed among them.
      const entry = (recap: Recap | null): NewJournalEntry => {
        const lines: NewJournalEntry['lines'] = [];
        const helpLog: HelpLogEntry[] = [];
        log.forEach(({ conversationId, conversation }, i) => {
          const { transcript, helpLog: helped } = dealtWith[i]!;
          const readings = lineReadings.get(conversationId)?.readings ?? conversation?.readings ?? {};
          helpLog.push(...helped.map((help) => ({ ...help, afterLine: help.afterLine + lines.length })));
          transcript.forEach((line, n) => {
            const reading = line.speaker === 'npc' ? readings[n] : undefined;
            lines.push({ ...line, ...(reading && { reading: reading.segments }), customer: i + 1 });
          });
        });
        return {
          kind: 'shift',
          jobId,
          customers,
          served,
          placeName: localPlaceName(JOB_PLACES[jobId], culturePackId),
          day: game.clock.day,
          minuteOfDay: game.clock.minuteOfDay,
          targetLanguage,
          nativeLanguage,
          recap: recap && journalRecap(recap, targetLanguage),
          lines,
          helpLog,
        };
      };
      const landed = (recap: RecapView) => {
        const shiftEnd = get().shiftEnd;
        if (shiftEnd && shiftId === shiftsEnded) set({ shiftEnd: { ...shiftEnd, recap } });
      };

      deps
        .requestRecap(request)
        .then(
          (recap) => {
            const customersSeen = log.map(({ result, conversation }) => ({
              lines: (conversation?.lines ?? []).map(({ speaker, text }) => ({ speaker, text })),
              helpLog: conversation?.helpLog ?? [],
              notUnderstoodTurns: conversation?.patience.turnsNotUnderstood ?? 0,
              served: result === 'served',
            }));
            applyEvidence((state) => applyShiftEvidence(state, { cefrEstimate: recap.cefrEstimate, listenedAt, customers: customersSeen }));
            landed({ status: 'ready', entry: journalPage(entry(recap)) });
            return recap;
          },
          (error: unknown) => {
            console.warn('[recap] the Shift Recap could not be written:', error instanceof Error ? error.message : error);
            landed({ status: 'failed' });
            return null;
          },
        )
        // The Journal keeps the corrected readings, so it waits for the last lines' annotations.
        .then(async (recap) => {
          await Promise.allSettled(log.flatMap(({ conversationId }) => lineReadings.get(conversationId)?.annotating ?? []));
          return deps.journal.append(get().slotId, entry(recap));
        })
        .catch((error: unknown) => console.error('[journal] could not save an entry:', error))
        .finally(() => log.forEach(({ conversationId }) => lineReadings.delete(conversationId)));
    };

    /** The next Shift Customer walks up to the counter and speaks first. With every customer seen to, the Shift ends. */
    const nextShiftCustomerOrEnd = () => {
      const { game } = get();
      const { shift } = game.possessions;
      if (!shift) return;
      const templates = shiftTemplates(shift.jobId);
      if (templates.length === 0 || shift.served + shift.failed >= shift.customers) return finishShift();
      const after = nextShiftCustomer(game, templates, tillFor(game.identity.culturePackId));
      set({ game: after });
      const customer = after.possessions.shift!.customer!;
      const pack = CULTURE_PACKS[after.identity.culturePackId];
      const remembered = sizeLastSet && jobAids(after, shift.jobId).includes('rememberedSize') ? sizeLastSet : null;
      const shiftCustomer = remembered ? { ...NEW_SHIFT_CUSTOMER, making: { ...DEFAULT_DRINK, size: remembered } } : NEW_SHIFT_CUSTOMER;
      openConversation({ npcId: null, interaction: null, shiftCustomer }, () =>
        buildShiftCustomerSession(customer, pack, after.proficiencyStep, { clock: after.clock }),
      );
    };

    /**
     * The Shift Customer has gone: their session closes, with no closing card and no Recap, and the next one walks
     * up. One who goes before they're dealt with (a dropped connection) is replaced, and doesn't count.
     */
    const shiftCustomerLeft = () => {
      closeSession();
      const conversation = get().conversation;
      if (conversation) keepShiftCustomerLines(conversation);
      set({ conversation: null, typing: false, micLevel: 0 });
      nextShiftCustomerOrEnd();
    };

    /** Closes the session and clears the conversation away, with whatever else should show instead. */
    const dropConversation = (instead: Partial<Pick<GameStore, 'toast' | 'voiceUnavailable'>> = {}) => {
      closeSession();
      // With no outcome there's no Journal entry to keep the readings for.
      const conversation = get().conversation;
      if (conversation && !conversation.outcome) lineReadings.delete(conversation.id);
      set({ conversation: null, typing: false, micLevel: 0, ...instead });
      approachIfFree();
    };

    const endConversation = () => {
      const conversation = get().conversation;
      if (conversation?.shiftCustomer) {
        // Leaving a Shift Customer before serving them fails them.
        if (!conversation.outcome) settleShiftCustomer(null);
        return shiftCustomerLeft();
      }
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
     * Opens a session for the conversation, built for the shopping on the counter now.
     * Every event from a session that has since been closed or replaced is ignored.
     */
    const openSession = (sessionFor: SessionFor, resumeFrom?: ChatLine[]) => {
      const npcSession = sessionFor(get().conversation!.basket);
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
          onDisconnect: live((current) => connectionFailed(current, sessionFor)),
        },
        { resumeFrom, typedOnly: get().inputMode === 'typed' },
      );
      voice = session;
      session.connect().then(
        live(() => {
          updateConversation({ reconnecting: false });
          tellStartedOn();
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
        // With no voice at all, no more customers can be served. Before any was dealt with, the day's Shift is given
        // back, since it's no fault of the Player's; after, the Shift ends with pay for those served.
        if (conversation.shiftCustomer) {
          const { shift } = get().game.possessions;
          if (shift && shift.served + shift.failed === 0) set({ game: cancelShift(get().game) });
          else finishShift();
        }
        return dropConversation({ voiceUnavailable: true });
      }
      if (conversation.retried) {
        // A Shift Customer lost to the network is replaced by the next, and doesn't count.
        if (conversation.shiftCustomer) {
          set({ toast: { kind: 'npcSteppedAway', npcId: null } });
          return shiftCustomerLeft();
        }
        return dropConversation({ toast: { kind: 'npcSteppedAway', npcId: conversation.npcId } });
      }
      set({
        micLevel: 0,
        conversation: { ...conversation, retried: true, reconnecting: true, listening: false, npcLine: null, heardLine: null },
      });
      openSession(sessionFor, conversation.lines);
    };

    /**
     * Health ran out during this tick: the Fainting screen shows, with the Character
     * already in the ward the next morning. Waking there starts the day, so it's saved as this morning's backup.
     */
    const fainted = (before: GameState, after: GameState) => {
      // A Shift under way ends where the Character collapsed, paid for the customers served so far.
      finishShift();
      // A conversation under way ends there too: abandoned, or closed if its outcome was decided.
      const conversation = get().conversation;
      if (conversation?.outcome && !conversation.closed) showClosingCard();
      if (get().conversation) endConversation();
      const billInShifts = ECONOMY.faintingBillInShifts;
      set({
        fainting: { billInShifts, paid: after.character.moneyInShifts < before.character.moneyInShifts },
        wardArrival: { wokeInWardOnDay: after.wokeInWardOnDay! },
        // Fainting moves the Character to the ward without going through a door, so the shopping goes back here.
        basket: [],
        shelfMarker: null,
      });
      save({ startsDay: true });
      noticeApproach(before, after);
    };

    /** Opens a conversation with a Named NPC, who speaks first: greeting the Character, or saying why they have come over. */
    const startConversation = (interaction: Interaction, approach: ApproachId | null) => {
      const { game } = get();
      const npc = NAMED_NPCS[interaction.npcId];
      const sessionFor: SessionFor = (onCounter) =>
        buildNpcSession(interaction, CULTURE_PACKS[game.identity.culturePackId], game.proficiencyStep, npc, {
          clock: game.clock,
          ...(approach && { approach }),
          ...(onCounter.length > 0 && { basket: onCounter }),
          ...(npc.id === 'landlord' && { rent: rentStatement(game) }),
        });
      // An NPC who comes up to the Character stops them where they are.
      if (approach) set({ heldStill: true });
      // At the till, the cashier rings up the basket as it is now.
      openConversation({ npcId: npc.id, interaction, shiftCustomer: null }, sessionFor, interaction.effect.kind === 'purchase' ? get().basket : []);
    };

    /** Opens a conversation with `partner`, whose session `sessionFor` builds for the shopping on the counter (`basket`). They speak first. */
    const openConversation = (partner: Partner, sessionFor: SessionFor, basket: Basket = []) => {
      gameBeforeConversation = get().game;
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
          basket,
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
      openSession(sessionFor);
    };

    /** An NPC who is due comes up to the Character, unless the Player is busy: then they wait until the Player is free. */
    const approachIfFree = () => {
      const approach = pendingApproach;
      const { conversation, fainting, journal, screen } = get();
      // No one comes over during a Shift: the Character is at work.
      if (!approach || conversation || fainting || journal || screen !== 'playing' || get().game.possessions.shift) return;
      pendingApproach = null;
      startConversation(approachInteraction(approach), approach);
    };

    /**
     * The Character has come within reach of the landlord, who stands in the hallway by the door, so passes
     * them on the way out: about rent due and unpaid, or a Newcomer Discount step-down, the landlord speaks
     * first. Only then and there, so a Player who is busy is let by rather than caught later somewhere else.
     */
    const catchInHallway = () => {
      const { game, conversation, fainting, journal, screen } = get();
      if (conversation || fainting || journal || screen !== 'playing') return;
      const approach = hallwayApproach(game, placeHours('landlord', game.identity.culturePackId));
      if (!approach) return;
      set({ game: hallwayApproachMade(game, approach) });
      startConversation(approachInteraction(approach), approach);
    };

    /** Whether this change to the game brings an NPC over to the Character. */
    const noticeApproach = (before: GameState, after: GameState) => {
      const due = approachDue(before, after);
      if (!due) return;
      pendingApproach = due;
      approachIfFree();
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
      tramChoosing: false,
      heldStill: false,
      tramArrival: null,
      conversation: null,
      basket: [],
      shelfMarker: null,
      typing: false,
      micLevel: 0,
      toast: null,
      voiceUnavailable: false,
      nativeLanguage: DEV_NATIVE_LANGUAGE,
      readingAids: { show: DEFAULT_DEVICE_SETTINGS.readingAids, romaji: DEFAULT_DEVICE_SETTINGS.showRomaji },
      inputMode: DEFAULT_DEVICE_SETTINGS.inputMode,
      micCheckPassed: DEFAULT_DEVICE_SETTINGS.micCheckPassed,
      journal: null,
      fainting: null,
      wardArrival: null,
      shiftEnd: null,
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
      saveNow: () => save(),
      advance: (realDeltaMs) => {
        if (get().screen !== 'playing') return;
        const before = get().game;
        const dt = gameMinutesFor(realDeltaMs, selectTimeScale(get()));
        if (dt > 0) set({ game: tick(before, dt) });
        realMsSinceSave += realDeltaMs;
        const after = get().game;
        if (faintedBetween(before, after)) return fainted(before, after);
        if (after.clock.day !== before.clock.day || realMsSinceSave >= SAVE.everyRealMs) save();
        noticeApproach(before, after);
      },
      setTabHidden: (tabHidden) => {
        set({ tabHidden });
        if (tabHidden) save();
      },
      // The world calls these every frame, so they only notify on a change.
      enterPlace: (placeId) => {
        // Behind the Fainting screen the Character is in the ward, wherever the world last had them standing.
        if (get().fainting) return;
        const before = get().game;
        // Out in the open, there's no door to keep anyone out.
        const hours = OPEN_AIR_PLACES.includes(placeId) ? null : placeHours(placeId, before.identity.culturePackId);
        const game = enterPlace(before, placeId, hours);
        if (game === get().game) return;
        // Anything not paid for goes back on the supermarket's shelves, and its marker goes.
        set({ game, ...(placeId !== 'supermarket' && { basket: [], shelfMarker: null }) });
        // Through a door.
        save();
        noticeApproach(before, game);
      },
      setInteractable: (interactable) => {
        if (get().interactable === interactable) return;
        const { conversation } = get();
        // Walking away is like Leave: no cost before the outcome, the closing card after it. A Shift holds the Character
        // behind the counter, so what is within reach there never matters to a Shift Customer.
        if (conversation?.shiftCustomer === null && !conversation.closed && interactable !== conversation.npcId) get().leaveConversation();
        set({ interactable, tramChoosing: false });
        if (interactable === 'landlord') catchInHallway();
      },
      openTram: () => {
        const { interactable, conversation, game } = get();
        if (conversation || !isTramStop(interactable) || !tramsRunning(game)) return;
        set({ tramChoosing: true });
      },
      closeTram: () => set({ tramChoosing: false }),
      letGoOfWalkKeys: () => {
        if (get().heldStill) set({ heldStill: false });
      },
      rideTram: (stopId) => {
        const { interactable, conversation, game, tramChoosing } = get();
        if (!tramChoosing || conversation || !isTramStop(interactable)) return;
        const after = rideTram(game, stopsBetween(interactable, stopId), placeHours('tram-stop', game.identity.culturePackId));
        if (after === game) return;
        set({ game: after, tramChoosing: false, interactable: null });
        // Health can run out on the way, and then the Character wakes in the ward instead of getting off.
        if (faintedBetween(game, after)) return fainted(game, after);
        set({ tramArrival: { stopId } });
        noticeApproach(game, after);
      },
      drinkWater: () => set({ game: drinkWater(get().game) }),
      cook: () => {
        const { game } = get();
        const after = cook(game);
        if (after === game) return set({ toast: { kind: 'nothingToCook' } });
        set({ game: after });
      },
      takeFromShelf: () => {
        const { interactable, conversation, basket, shelfMarker, game } = get();
        if (conversation || !isShelf(interactable) || !isPlaceOpen('supermarket', game)) return;
        set({ basket: addToBasket(basket, interactable), ...(shelfMarker === interactable && { shelfMarker: null }) });
      },
      putBack: (itemId) => {
        const state = get();
        const { basket, conversation, game } = state;
        if (!selectCanPutBack(state) || !basket.some((line) => line.itemId === itemId)) return;
        const after = putBackFromBasket(basket, itemId);
        set({ basket: after });
        if (!conversation) return;
        // The cashier rings up what is on the counter now, in a new turn of their own.
        updateConversation({ basket: after, npcLine: null, heardLine: null });
        voice?.sendText(basketChangedScene(after, game.identity.culturePackId));
      },
      wakeInWard: () => {
        if (!get().fainting) return;
        set({ fainting: null });
        approachIfFree();
      },
      sleep: () => {
        const { game } = get();
        if (!bedUsable(game.clock)) return set({ toast: { kind: 'tooEarlyForBed' } });
        const after = sleep(game);
        if (after === game) return;
        set({ game: after });
        // Waking starts the day, even after a bedtime past midnight, so the save becomes this morning's backup.
        save({ startsDay: true });
        noticeApproach(game, after);
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

      startShift: () => {
        const { interactable, conversation, game } = get();
        const jobId = staffDoorJob(interactable, game);
        if (conversation || get().journal || !jobId) return;
        const after = startShift(game, jobId, placeHours(JOB_PLACES[jobId], game.identity.culturePackId));
        if (after === game) return;
        set({ game: after, shiftEnd: null });
        sizeLastSet = null;
        nextShiftCustomerOrEnd();
      },
      tapMenuItem: (itemId) => {
        const { shift } = get().game.possessions;
        if (!shift || !SHIFT_MENUS[shift.jobId].includes(itemId)) return;
        // At a table, a tap writes the dish or the drink on the order pad line being written.
        if (shift.customer?.table) {
          const course = (RESTAURANT_DISHES as readonly ItemId[]).includes(itemId) ? 'dish' : 'drink';
          return changeShiftCustomer((view) => ({ ...view, pad: writeOnPad(view.pad, itemId, course) }));
        }
        changeShiftCustomer((view) => ({ ...view, ...addToTray(view, itemId, isDrink(itemId) ? view.making : null) }));
        tellStartedOn();
      },
      setDrinkSize: (size) => {
        if (!selectCanTapMenu(get())) return;
        sizeLastSet = size;
        changeShiftCustomer((view) => ({ ...view, making: { ...view.making, size } }));
      },
      setDrinkTemperature: (temperature) => changeShiftCustomer((view) => ({ ...view, making: { ...view.making, temperature } })),
      toggleDrinkExtra: (extra) =>
        changeShiftCustomer((view) => {
          const { extras } = view.making;
          const toggled = extras.includes(extra) ? extras.filter((e) => e !== extra) : [...extras, extra];
          return { ...view, making: { ...view.making, extras: toggled } };
        }),
      clearTray: () => changeShiftCustomer((view) => ({ ...view, ...clearTray(view), pad: EMPTY_PAD })),
      undoTray: () => changeShiftCustomer((view) => ({ ...view, ...undoTray(view) })),
      redoTray: () => changeShiftCustomer((view) => ({ ...view, ...redoTray(view) })),
      toggleBag: () => changeShiftCustomer((view) => ({ ...view, bag: !view.bag })),
      togglePointsCard: () => changeShiftCustomer((view) => ({ ...view, pointsCard: !view.pointsCard })),
      setCashReceived: (amount) =>
        changeShiftCustomer((view) => ({ ...view, received: amount !== null && Number.isFinite(amount) && amount >= 0 ? amount : null })),
      addChangeCoin: (coin) => {
        if (!tillFor(get().game.identity.culturePackId).denominations.includes(coin)) return;
        changeShiftCustomer((view) => ({ ...view, change: [...view.change, coin] }));
      },
      clearChange: () => changeShiftCustomer((view) => ({ ...view, change: [] })),
      suggestChange: () => {
        if (!selectCanSuggestChange(get())) return;
        const { denominations } = tillFor(get().game.identity.culturePackId);
        changeShiftCustomer((view) => ({ ...view, change: suggestChange(selectTill(get()).changeDue!, denominations) }));
      },
      addPadDiner: () => changeShiftCustomer((view) => ({ ...view, pad: addPadLine(view.pad) })),
      choosePadDiner: (index) => changeShiftCustomer((view) => ({ ...view, pad: choosePadLine(view.pad, index) })),
      removePadDiner: () => changeShiftCustomer((view) => ({ ...view, pad: removePadLine(view.pad) })),
      setDietaryNote: (note) => changeShiftCustomer((view) => ({ ...view, pad: noteOnPad(view.pad, note) })),
      serveTray: () => {
        const conversation = get().conversation;
        const view = conversation?.shiftCustomer;
        if (!view || !canTakeTurn(conversation) || !voice || !hasSomethingToServe(view)) return;
        const customer = get().game.possessions.shift?.customer;
        const pack = CULTURE_PACKS[get().game.identity.culturePackId];
        if (customer?.table) {
          const { diners } = view.pad;
          const correct = settleShiftCustomer(kitchenOrder(diners), { atTheTable: diners });
          return voice.sendText(tableServedScene(diners, correct, pack));
        }
        const { tray, bag, pointsCard, change } = view;
        const atTheTill = customer?.checkout ? { bag, pointsCard, change: coinsTotal(change) } : undefined;
        const correct = settleShiftCustomer(tray, { atTheTill });
        voice.sendText(shiftCustomerServedScene(tray, correct, pack, atTheTill));
      },
      closeShiftEnd: () => {
        // Closed before its Recap was there to read: it still goes to the Journal.
        const writing = get().shiftEnd?.recap?.status === 'writing';
        set({ shiftEnd: null, ...(writing && { toast: { kind: 'recapSaved' } as const }) });
      },
      talk: (key = 'E') => {
        const { interactable, conversation, game } = get();
        if (conversation || get().journal || !isTownNpc(interactable) || !isAtWork(interactable, game)) return;
        const interaction = key === 'E' ? selectTalkWithE(get()) : selectTalkWithF(get());
        // F is only a second choice: with none, it does nothing.
        if (!interaction) return key === 'E' ? set({ toast: { kind: 'nothingToSay', npcId: interactable } }) : undefined;
        startConversation(interaction, null);
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
        // Nor is it for a Shift Customer already dealt with, whose dock was settled by what was translated before.
        const readingBack = conversation.closed || (conversation.shiftCustomer !== null && conversation.outcome !== null);
        if (!readingBack) next = logHelp(next, 'translate', [npcLine.text]);
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
      closeJournal: () => {
        set({ journal: null });
        approachIfFree();
      },
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
  if (s.tabHidden || s.journal || s.fainting || s.conversation?.tab === 'help') return CLOCK.timeScale.paused;
  return s.conversation ? CLOCK.timeScale.conversation : CLOCK.timeScale.normal;
};
export const selectHealth = (s: GameStore) => s.game.character.health;
export const selectHunger = (s: GameStore) => s.game.character.hunger;
export const selectThirst = (s: GameStore) => s.game.character.thirst;
export const selectMood = (s: GameStore) => s.game.character.mood;
/** The face on the dock's Mood gauge. */
export const selectMoodFace = (s: GameStore) => moodFace(s.game.character.mood);
export const selectMoneyInShifts = (s: GameStore) => s.game.character.moneyInShifts;
/** What the Character owes, by kind, for the dock to show next to the money. */
export const selectDebts = (s: GameStore) => s.game.debts;
export const selectCulturePackId = (s: GameStore) => s.game.identity.culturePackId;
export const selectTargetLanguage = (s: GameStore) => s.game.identity.targetLanguage;
export const selectDay = (s: GameStore) => s.game.clock.day;
export const selectWeekday = (s: GameStore) => weekdayOf(s.game.clock.day);
/** Whole game minutes since midnight, so the clock re-renders once a game minute. */
export const selectClockMinute = (s: GameStore) => Math.floor(s.game.clock.minuteOfDay);
export const selectPlaceId = (s: GameStore) => s.game.placeId;
/** What E would use here. Staff at a closed place don't count: there's no one to talk to. */
export const selectInteractable = (s: GameStore) => {
  if (isTownNpc(s.interactable) && !isAtWork(s.interactable, s.game)) return null;
  // The shelves are only for shopping while the supermarket is open.
  if (isShelf(s.interactable) && !isPlaceOpen('supermarket', s.game)) return null;
  return s.interactable;
};
/** The shelf the Character could take a grocery from, or null. */
export const selectShelf = (s: GameStore) => {
  const interactable = selectInteractable(s);
  return isShelf(interactable) ? interactable : null;
};
/** The conversation `startedWith` starts with the Named NPC the Character is next to, given what they bring and the Jobs they have, or null. */
const talkWith = (s: GameStore, startedWith: typeof interactionStartedWithE): Interaction | null => {
  const npcId = selectInteractable(s);
  if (!isTownNpc(npcId) || !(npcId in NAMED_NPCS)) return null;
  return startedWith(npcId as NamedNpcId, { shopping: s.basket.length > 0, jobsHired: s.game.possessions.jobsHired });
};
/** The conversation E starts with the Named NPC the Character is next to, or null. */
export const selectTalkWithE = (s: GameStore) => talkWith(s, interactionStartedWithE);
/** The second conversation F starts with that NPC (at the till with shopping, asking where something is; asking for work), or null. */
export const selectTalkWithF = (s: GameStore) => talkWith(s, interactionStartedWithF);
/** What the Character has taken off the shelves to pay for. */
export const selectBasket = (s: GameStore) => s.basket;
/**
 * Whether shopping can go back on the shelves now: any time but in a conversation, and at the till until it's paid for,
 * while the cashier can hear about it (not while the Player is talking, Help is open or the connection is coming back).
 * Not the last item at the till, though: leaving the till puts everything back.
 */
export const selectCanPutBack = (s: GameStore) => {
  const { conversation, basket } = s;
  if (!conversation) return true;
  const { interaction, outcome, reconnecting, listening, tab } = conversation;
  const atTheTill = interaction?.effect.kind === 'purchase' && !outcome;
  const cashierListening = !reconnecting && !listening && tab === 'chat';
  const lastItem = basket.length === 1 && basket[0]!.quantity === 1;
  return atTheTill && cashierListening && !lastItem;
};
/** The grocery the cashier pointed to, marked on its shelf. */
export const selectShelfMarker = (s: GameStore) => s.shelfMarker;

const inventoryLines = new WeakMap<readonly InventoryItem[], { day: number; lines: readonly InventoryLine[] }>();
/** What the Character owns, and which groceries have gone off today. The same array until either changes. */
export const selectInventory = (s: GameStore): readonly InventoryLine[] => {
  const { inventory } = s.game.possessions;
  const { day } = s.game.clock;
  const kept = inventoryLines.get(inventory);
  if (kept?.day === day) return kept.lines;
  const lines = inventory.map((item) => ({ ...item, goneOff: isGoneOff(item, day) }));
  inventoryLines.set(inventory, { day, lines });
  return lines;
};
const skillLevels = new WeakMap<GameState['progression']['lifeSkillXp'], Record<LifeSkillId, number>>();
/** Each Life Skill's level, 0–5 stars. The same object until the XP changes. */
export const selectLifeSkillLevels = (s: GameStore): Record<LifeSkillId, number> => {
  const { lifeSkillXp } = s.game.progression;
  const kept = skillLevels.get(lifeSkillXp);
  if (kept) return kept;
  const levels = lifeSkillLevels(s.game);
  skillLevels.set(lifeSkillXp, levels);
  return levels;
};
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
/** An NPC who came up to the Character has stopped them, until the walking keys held then are let go. */
export const selectHeldStill = (s: GameStore) => s.heldStill;
/** Keys belong to the UI, not the world: the typed field has focus, the Journal or the Fainting screen is open, or the Player is choosing a tram stop. */
export const selectWorldKeysOff = (s: GameStore) => s.typing || s.journal !== null || s.fainting !== null || s.tramChoosing;
export const selectListening = (s: GameStore) => s.conversation?.listening ?? false;
export const selectMicLevel = (s: GameStore) => s.micLevel;
export const selectReconnecting = (s: GameStore) => s.conversation?.reconnecting ?? false;
export const selectConversationUsage = (s: GameStore) => s.conversation?.usage ?? NO_USAGE;
export const selectToast = (s: GameStore) => s.toast;
export const selectVoiceUnavailable = (s: GameStore) => s.voiceUnavailable;
/** The closing card, once the session is over. */
export const selectClosingCard = (s: GameStore): ClosingCard | null => (s.conversation?.closed && isClosingCard(s.conversation.outcome) ? s.conversation.outcome : null);
/** The Recap in the column, once See Recap is chosen. */
export const selectRecap = (s: GameStore) => (s.conversation?.showingRecap ? s.conversation.recap : null);
export const selectJournal = (s: GameStore) => s.journal;
export const selectFainting = (s: GameStore) => s.fainting;
export const selectWardArrival = (s: GameStore) => s.wardArrival;
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

// --- Shifts -----------------------------------------------------------------

/** A Shift under way, as the Player sees it: how many Shift Customers come, how many are done with, and how many were served right. */
export type ShiftView = { jobId: JobId; customers: number; done: number; served: number };
const shiftViews = new WeakMap<Shift, ShiftView>();
/** The Shift under way, or null. The same object until the Shift changes. */
export const selectShift = (s: GameStore): ShiftView | null => {
  const { shift } = s.game.possessions;
  if (!shift) return null;
  let view = shiftViews.get(shift);
  if (!view) {
    view = { jobId: shift.jobId, customers: shift.customers, done: shift.served + shift.failed, served: shift.served };
    shiftViews.set(shift, view);
  }
  return view;
};
/** What the Shift that just ended paid, until the Player closes it. */
export const selectShiftEnd = (s: GameStore) => s.shiftEnd;
/** Each staff door view, made once, so the selector hands back the same object while nothing changes. */
const STAFF_DOORS = new Map<string, StaffDoor>();
/** The staff door the Character is at, and whether E starts a Shift there now; null away from one, or during a Shift. */
export const selectStaffDoor = (s: GameStore): StaffDoor | null => {
  const jobId = staffDoorJob(s.interactable, s.game);
  if (!jobId) return null;
  const refusal = staffDoorRefusal(jobId, s.game);
  if (refusal === 'underway') return null;
  const key = `${jobId}:${refusal}`;
  if (!STAFF_DOORS.has(key)) STAFF_DOORS.set(key, { jobId, refusal });
  return STAFF_DOORS.get(key)!;
};
/** Part of the menu grid: with the Barista skill's grouped grid, drinks and food apart; otherwise the whole menu, ungrouped. */
export type MenuGroup = { group: 'drinks' | 'food' | null; items: readonly ItemId[] };
const NO_MENU: readonly MenuGroup[] = [];
const MENU_GRIDS = new Map<string, readonly MenuGroup[]>();
/** What the Player can tap on the grid in the Shift under way, grouped once the Job's Life Skill has unlocked it. */
export const selectShiftMenu = (s: GameStore): readonly MenuGroup[] => {
  const { shift } = s.game.possessions;
  const menu = shift && SHIFT_MENUS[shift.jobId];
  if (!menu) return NO_MENU;
  const grouped = jobAids(s.game, shift.jobId).includes('groupedGrid');
  const key = `${shift.jobId}:${grouped}`;
  if (!MENU_GRIDS.has(key)) {
    const groups: MenuGroup[] = grouped
      ? [
          { group: 'drinks', items: menu.filter(isDrink) },
          { group: 'food', items: menu.filter((itemId) => !isDrink(itemId)) },
        ]
      : [{ group: null, items: menu }];
    MENU_GRIDS.set(key, groups.filter(({ items }) => items.length > 0));
  }
  return MENU_GRIDS.get(key)!;
};
const NOTHING_ON_THE_TRAY: ShiftOrder = [];
/** The Shift Customer at the counter can still be served: the grid takes taps until they've been dealt with. */
export const selectCanTapMenu = (s: GameStore) => s.conversation?.shiftCustomer != null && !s.conversation.outcome;
/** What is on the tray for the Shift Customer at the counter. */
export const selectTray = (s: GameStore): ShiftOrder => s.conversation?.shiftCustomer?.tray ?? NOTHING_ON_THE_TRAY;
/** How the modifier toggles say the next drink tapped is made. */
export const selectDrinkModifiers = (s: GameStore): DrinkModifiers => s.conversation?.shiftCustomer?.making ?? DEFAULT_DRINK;
/** There's a change to the tray to take back, or one taken back to put back, while the customer can still be served. */
export const selectCanUndoTray = (s: GameStore) => selectCanTapMenu(s) && s.conversation!.shiftCustomer!.undo.length > 0;
export const selectCanRedoTray = (s: GameStore) => selectCanTapMenu(s) && s.conversation!.shiftCustomer!.redo.length > 0;
/** There's something to hand over: on the tray, or written on the order pad. */
function hasSomethingToServe({ tray, pad }: ShiftCustomerView) {
  return tray.length > 0 || pad.diners.some(({ dish, drink }) => dish !== null || drink !== null);
}
/**
 * Serve can be pressed: something is on the tray (or the order pad), and the customer is listening (not while the
 * Player talks, Help is open or the connection is coming back).
 */
export const selectCanServe = (s: GameStore) => {
  const { conversation } = s;
  if (!conversation?.shiftCustomer || conversation.outcome || conversation.reconnecting || conversation.listening) return false;
  return conversation.tab === 'chat' && hasSomethingToServe(conversation.shiftCustomer);
};
/** The order pad for the table being served: a line per diner, and which one is being written. */
export const selectOrderPad = (s: GameStore): OrderPad => s.conversation?.shiftCustomer?.pad ?? EMPTY_PAD;
/** The Server skill has unlocked quick-pick dietary notes for the Shift under way. */
export const selectQuickPickNotes = (s: GameStore) => {
  const { shift } = s.game.possessions;
  return shift !== null && jobAids(s.game, shift.jobId).includes('quickPickNotes');
};
const NOTHING_ON_THE_COUNTER: ShiftOrder = [];
const COUNTERS = new WeakMap<ShiftOrder, ShiftOrder>();
/** The shopping the customer at the till has put on the counter, which the Player can see; not what they want from behind it. */
export const selectCheckoutCounter = (s: GameStore): ShiftOrder => {
  const customer = s.conversation?.shiftCustomer ? s.game.possessions.shift?.customer : null;
  if (!customer?.checkout) return NOTHING_ON_THE_COUNTER;
  if (!COUNTERS.has(customer.order)) {
    const behind = customer.checkout.fromBehindTheCounter;
    COUNTERS.set(customer.order, customer.order.filter(({ itemId }) => itemId !== behind));
  }
  return COUNTERS.get(customer.order)!;
};

/**
 * The till, as the Player sees it, in local money: what's been rung up comes to `total`; the bag and points card
 * toggles; the cash keyed in as handed over and the change due from it (null until keyed in); and the coins and
 * notes counted out as change, which come to `changeGiven`.
 */
export type TillView = {
  total: number;
  bag: boolean;
  pointsCard: boolean;
  received: number | null;
  changeDue: number | null;
  change: readonly number[];
  changeGiven: number;
};
const EMPTY_TILL: TillView = { total: 0, bag: false, pointsCard: false, received: null, changeDue: null, change: [], changeGiven: 0 };
const TILLS = new WeakMap<ShiftCustomerView, TillView>();
/** The till for the customer at the counter. The same object until it changes. */
export const selectTill = (s: GameStore): TillView => {
  const view = s.conversation?.shiftCustomer;
  if (!view) return EMPTY_TILL;
  if (!TILLS.has(view)) {
    const { tray, bag, pointsCard, received, change } = view;
    const total = tillTotal(tray, tillFor(s.game.identity.culturePackId));
    const changeDue = received === null ? null : changeOwed(received, total);
    TILLS.set(view, { total, bag, pointsCard, received, changeDue, change, changeGiven: coinsTotal(change) });
  }
  return TILLS.get(view)!;
};
/** The Cashier skill has unlocked coin suggestions for the Shift under way. */
export const selectSuggestsChange = (s: GameStore) => {
  const { shift } = s.game.possessions;
  return shift !== null && jobAids(s.game, shift.jobId).includes('suggestedChange');
};
/** The Cashier skill can count out the change: it's unlocked, and the cash keyed in covers what's been rung up. */
export const selectCanSuggestChange = (s: GameStore) => {
  const { shift } = s.game.possessions;
  if (!shift || !selectCanTapMenu(s) || !jobAids(s.game, shift.jobId).includes('suggestedChange')) return false;
  const { changeDue } = selectTill(s);
  return changeDue !== null && changeDue >= 0;
};
/** A Shift Customer is at the counter, and partway through saying a line: for the "speaking…" indicator over them. */
export const selectShiftCustomerSpeaking = (s: GameStore) =>
  s.conversation?.shiftCustomer != null && !s.conversation.closed && s.conversation.npcLine !== null;
/** A Shift Customer stands at the counter, from walking up until they leave. */
export const selectShiftCustomerAtCounter = (s: GameStore) => s.conversation?.shiftCustomer != null;
/** How many people the Shift Customer at the counter is: everyone at their table at the restaurant, otherwise just them; none between customers. */
export const selectShiftCustomerParty = (s: GameStore) =>
  s.conversation?.shiftCustomer ? (s.game.possessions.shift?.customer?.table?.length ?? 1) : 0;
