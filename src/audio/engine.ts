import type { AmbientSoundId } from '../content/index.ts';
import type { AmbientBed, MusicTrack, Soundscape, UiSound } from '../store/index.ts';
import { setVoiceVolume } from '../voice/index.ts';
import { ONE_SHOTS, playBed } from './ambience.ts';
import { between, pick, reverb, type Playing } from './instruments.ts';
import { playLoop } from './music.ts';
import { UI_SOUNDS } from './uiSounds.ts';

/** How loud each bus is at full volume, to balance the synthesised sounds against each other and the NPC's voice. */
const BUS_TRIM = { music: 0.7, ambient: 0.9, ui: 0.9 };
/** The rooms the music and the town's one-shots sound in: how long each echo lasts, in seconds, and how much goes to it. */
const MUSIC_ROOM = { seconds: 2.5, send: 0.25 };
const TOWN_ROOM = { seconds: 3.5, send: 0.6 };
/** How long one music loop takes to fade into the next, and one ambient bed into the next, in seconds. */
const MUSIC_CROSSFADE = 4;
const BED_CROSSFADE = 2;
/** How quickly a bus follows a change of level, as a time constant in seconds: ducking under the mic is all but at once. */
const LEVEL_FOLLOW = 0.08;
/** How far apart, in seconds, the Culture Pack's one-shots play out in the town. */
const ONE_SHOT_GAP = { min: 15, max: 45 };

export type AudioEngine = {
  /** Plays what the store says should be playing, at the levels it says. */
  apply: (soundscape: Soundscape) => void;
  play: (sound: UiSound) => void;
  close: () => void;
};

/** The sound, once the browser lets it start: its context, the buses, and what's playing on them. */
function startSound() {
  const context = new AudioContext();
  const bus = (trim: number) => {
    const gain = context.createGain();
    gain.gain.value = 0;
    const output = context.createGain();
    output.gain.value = trim;
    gain.connect(output).connect(context.destination);
    return gain;
  };
  const music = bus(BUS_TRIM.music);
  const ambient = bus(BUS_TRIM.ambient);
  const ui = bus(BUS_TRIM.ui);

  // A little room for the music, and distance for the town's one-shots.
  const musicRoom = reverb(context, MUSIC_ROOM.seconds);
  const musicSend = context.createGain();
  musicSend.gain.value = MUSIC_ROOM.send;
  music.connect(musicSend).connect(musicRoom).connect(context.destination);
  const town = context.createGain();
  const townRoom = reverb(context, TOWN_ROOM.seconds);
  const townSend = context.createGain();
  townSend.gain.value = TOWN_ROOM.send;
  town.connect(ambient);
  town.connect(townSend).connect(townRoom).connect(ambient);

  let track: { id: MusicTrack; playing: Playing } | null = null;
  let bed: { id: AmbientBed; playing: Playing } | null = null;
  let oneShots: readonly AmbientSoundId[] = [];

  /** One of the pack's one-shots, somewhere off to the side and some way off. */
  const playOneShot = () => {
    if (context.state !== 'running' || oneShots.length === 0) return;
    const pan = context.createStereoPanner();
    pan.pan.value = between(-0.8, 0.8);
    const distance = context.createGain();
    distance.gain.value = between(0.35, 0.8);
    pan.connect(distance).connect(town);
    ONE_SHOTS[pick(oneShots)](context, pan, context.currentTime + 0.05);
    setTimeout(() => pan.disconnect(), 15_000);
  };
  let oneShotTimer: ReturnType<typeof setTimeout>;
  const nextOneShot = () => {
    oneShotTimer = setTimeout(() => {
      playOneShot();
      nextOneShot();
    }, between(ONE_SHOT_GAP.min, ONE_SHOT_GAP.max) * 1000);
  };
  nextOneShot();

  const follow = (gain: GainNode, level: number) => gain.gain.setTargetAtTime(level, context.currentTime, LEVEL_FOLLOW);

  return {
    context,
    apply: ({ music: musicId, ambience, oneShots: packOneShots, levels }: Soundscape) => {
      if (track?.id !== musicId) {
        track?.playing.stop(MUSIC_CROSSFADE);
        track = { id: musicId, playing: playLoop(context, music, musicId, MUSIC_CROSSFADE) };
      }
      if (bed?.id !== ambience) {
        bed?.playing.stop(BED_CROSSFADE);
        bed = ambience ? { id: ambience, playing: playBed(context, ambient, ambience, BED_CROSSFADE) } : null;
      }
      oneShots = packOneShots;
      follow(music, levels.music);
      follow(ambient, levels.ambient);
      follow(ui, levels.ui);
    },
    play: (sound: UiSound) => {
      if (context.state === 'running') UI_SOUNDS[sound](context, ui, context.currentTime + 0.01);
    },
    close: () => {
      clearTimeout(oneShotTimer);
      track?.playing.stop(0);
      bed?.playing.stop(0);
      void context.close();
    },
  };
}

/**
 * The game's music, ambient sound and UI sounds. Nothing plays until the Player first presses a key or the pointer, as
 * browsers ask; it then picks up whatever the soundscape is by then. It's quiet while the tab is hidden.
 */
export function createAudioEngine(): AudioEngine {
  let sound: ReturnType<typeof startSound> | null = null;
  let wanted: Soundscape | null = null;
  // Only what changes reaches the sound, as the store changes many times a second.
  let applied = '';

  const apply = (soundscape: Soundscape) => {
    wanted = soundscape;
    setVoiceVolume(soundscape.levels.voice);
    const key = JSON.stringify(soundscape);
    if (!sound || key === applied) return;
    applied = key;
    sound.apply(soundscape);
  };
  const unlock = () => {
    if (sound) {
      if (sound.context.state === 'suspended' && document.visibilityState === 'visible') void sound.context.resume();
      return;
    }
    sound = startSound();
    void sound.context.resume();
    if (wanted) apply(wanted);
  };
  const onVisibility = () => {
    if (!sound) return;
    void (document.visibilityState === 'hidden' ? sound.context.suspend() : sound.context.resume());
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    apply,
    play: (uiSound) => sound?.play(uiSound),
    close: () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      document.removeEventListener('visibilitychange', onVisibility);
      sound?.close();
      sound = null;
    },
  };
}
