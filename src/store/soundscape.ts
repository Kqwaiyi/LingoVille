import { CULTURE_PACKS, OPEN_AIR_PLACES, type AmbientSoundId } from '../content/index.ts';
import { AUDIO_MIX, type LightingPreset } from '../sim/index.ts';
import { selectClosingCard, selectDaylight, selectLampsOn, selectMicOpen, selectNpcExpression, type GameStore } from './gameStore.ts';

// What the game should sound like now, and which UI sounds a change to the store makes. The audio module plays them;
// the rules about what plays when live here, where they can be tested.

/** The soundtrack's loops: one for each lighting preset out in the town, home, the counters of every other place, and the title theme. */
export type MusicTrack = LightingPreset | 'home' | 'counters' | 'title';

/** The shared ambient beds, under every Culture Pack's one-shots. */
export type AmbientBed = 'street' | 'park' | 'night' | 'indoors';

/** Each bus's level, from 0 to 1: its volume setting under the master volume, ducked while something needs hearing over it. */
export type BusLevels = { music: number; ambient: number; voice: number; ui: number };

export type Soundscape = {
  music: MusicTrack;
  ambience: AmbientBed | null;
  /** The Culture Pack's local touches, played now and then over the bed. */
  oneShots: readonly AmbientSoundId[];
  levels: BusLevels;
};

/** The sounds the UI makes. Saved ✓ makes none. */
export type UiSound = 'click' | 'moneyIn' | 'moneyOut' | 'success' | 'failure' | 'pageTurn' | 'patienceLow';

const NO_ONE_SHOTS: readonly AmbientSoundId[] = [];

/** Out in the open: on the street, or in a place with no door. */
const outdoors = (s: GameStore) => s.onStreet || OPEN_AIR_PLACES.includes(s.game.placeId);

function music(s: GameStore): MusicTrack {
  if (s.screen !== 'playing') return 'title';
  if (outdoors(s)) {
    // The loop of whichever preset the light is nearer.
    const { from, to, blend } = selectDaylight(s);
    return blend < 0.5 ? from : to;
  }
  return s.game.placeId === 'home' ? 'home' : 'counters';
}

function ambience(s: GameStore): AmbientBed | null {
  if (s.screen !== 'playing') return null;
  if (!outdoors(s)) return 'indoors';
  if (selectLampsOn(s)) return 'night';
  return s.game.placeId === 'park' && !s.onStreet ? 'park' : 'street';
}

function levels(s: GameStore): BusLevels {
  const { master, music, ambient, voice, ui } = s.volumes;
  const duck = selectMicOpen(s) ? AUDIO_MIX.micOpen : s.conversation ? AUDIO_MIX.conversation : { music: 1, ambient: 1 };
  return { music: master * music * duck.music, ambient: master * ambient * duck.ambient, voice: master * voice, ui: master * ui };
}

/**
 * What plays now: the music, the ambient bed and its one-shots, and how loud each bus is. A new object on every call:
 * for reading in a store subscription, not for `useGame`.
 */
export function selectSoundscape(s: GameStore): Soundscape {
  const bed = ambience(s);
  const oneShots = bed && bed !== 'indoors' ? CULTURE_PACKS[s.game.identity.culturePackId].ambient : NO_ONE_SHOTS;
  return { music: music(s), ambience: bed, oneShots, levels: levels(s) };
}

/** How a conversation's outcome sounds: a chime for one that went well, a gentle tone for one that didn't. */
function outcomeSound(s: GameStore): UiSound | null {
  const card = selectClosingCard(s);
  if (card) return card.kind === 'failure' ? 'failure' : 'success';
  const outcome = s.conversation?.shiftCustomer ? s.conversation.outcome : null;
  if (!outcome) return null;
  return outcome.kind === 'served' ? 'success' : 'failure';
}

/**
 * The UI sounds a change to the store makes: money in or out, a conversation's outcome (as its closing card shows, or as
 * a Shift Customer is dealt with), the NPC's Patience running low, and a page turning as the Recap shows or the Journal
 * opens. Clicks are the UI's own. A save loading, or a game starting, makes none.
 */
export function uiSoundsBetween(before: GameStore, after: GameStore): UiSound[] {
  if (before.screen !== 'playing' || after.screen !== 'playing' || before.slotId !== after.slotId) return [];
  const sounds: UiSound[] = [];

  const money = after.game.character.moneyInShifts - before.game.character.moneyInShifts;
  if (money > 0) sounds.push('moneyIn');
  if (money < 0) sounds.push('moneyOut');

  const sameConversation = before.conversation !== null && before.conversation.id === after.conversation?.id;
  if (sameConversation && selectNpcExpression(after) === 'strained' && selectNpcExpression(before) !== 'strained') sounds.push('patienceLow');
  const outcome = outcomeSound(after);
  if (outcome && (!sameConversation || outcomeSound(before) === null)) sounds.push(outcome);

  if ((after.conversation?.showingRecap && !before.conversation?.showingRecap) || (after.journal && !before.journal)) sounds.push('pageTurn');
  return sounds;
}
