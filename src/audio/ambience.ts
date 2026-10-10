import type { AmbientSoundId } from '../content/index.ts';
import type { AmbientBed } from '../store/index.ts';
import { bell, between, CHIME, CHURCH_BELL, fader, hz, noiseBed, noiseBurst, SMALL_BELL, tone, type Partials, type Playing, type Sound } from './instruments.ts';

// The shared ambient beds, the same in every Culture Pack, and the packs' one-shots that play now and then over them.
// None of it is speech: a street vendor's call is a wordless far-off cry.

/** Something in a bed that happens every so often, from `min` to `max` seconds apart. */
type Recurring = { min: number; max: number; play: Sound };

/** A bird far off: a few quick chirps. */
function birdsong(context: AudioContext, out: AudioNode, at: number) {
  const pitch = between(2600, 4200);
  const chirps = Math.floor(between(2, 5));
  for (let i = 0; i < chirps; i++) {
    tone(context, out, at + i * between(0.09, 0.16), { frequency: pitch, glideTo: pitch * between(1.15, 1.4), peak: 0.012, attack: 0.01, decay: 0.07 });
  }
}

/** A car going by, a street away. */
function carPassing(context: AudioContext, out: AudioNode, at: number) {
  noiseBurst(context, out, at, { colour: 'brown', filter: 'bandpass', frequency: 380, sweepTo: 700, q: 0.8, peak: 0.1, attack: 1.6, decay: 2.2 });
}

/** A cricket: three quick pulses. */
function cricket(context: AudioContext, out: AudioNode, at: number) {
  const pitch = between(4200, 4700);
  for (let i = 0; i < 3; i++) tone(context, out, at + i * 0.045, { frequency: pitch, peak: 0.008, attack: 0.004, decay: 0.022 });
}

type Bed = {
  beds: Parameters<typeof noiseBed>[2][];
  recurring: Recurring[];
};

const BEDS: Record<AmbientBed, Bed> = {
  street: {
    beds: [
      { colour: 'brown', filter: 'lowpass', frequency: 350, level: 0.3 },
      { colour: 'pink', filter: 'bandpass', frequency: 900, q: 0.5, level: 0.035 },
    ],
    recurring: [
      { min: 4, max: 12, play: birdsong },
      { min: 9, max: 24, play: carPassing },
    ],
  },
  park: {
    beds: [
      { colour: 'brown', filter: 'lowpass', frequency: 250, level: 0.12 },
      // Leaves in the wind.
      { colour: 'pink', filter: 'bandpass', frequency: 2500, q: 0.6, level: 0.04 },
    ],
    recurring: [{ min: 1.5, max: 5, play: birdsong }],
  },
  night: {
    beds: [{ colour: 'brown', filter: 'lowpass', frequency: 200, level: 0.16 }],
    recurring: [
      { min: 0.8, max: 1.6, play: cricket },
      { min: 14, max: 35, play: carPassing },
    ],
  },
  indoors: {
    beds: [{ colour: 'brown', filter: 'lowpass', frequency: 180, level: 0.1 }],
    recurring: [],
  },
};

/** Starts a bed playing into `out`, fading in. */
export function playBed(context: AudioContext, out: AudioNode, bed: AmbientBed, fadeSeconds: number): Playing {
  const { beds, recurring } = BEDS[bed];
  const { gain, fadeOut } = fader(context, out, fadeSeconds);
  const layers = beds.map((layer) => noiseBed(context, gain, layer));
  // The wind comes and goes: each layer swells and falls by up to this share of its level.
  const gust = context.createOscillator();
  gust.frequency.value = 0.12;
  layers.forEach((layer, i) => {
    const depth = context.createGain();
    depth.gain.value = beds[i]!.level * 0.4;
    gust.connect(depth).connect(layer.gain.gain);
  });
  gust.start();

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const playEverySoOften = ({ min, max, play }: Recurring) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      // While the context is suspended its clock stands still: what's scheduled now would all play at once later.
      if (context.state === 'running') play(context, gain, context.currentTime + 0.05);
      playEverySoOften({ min, max, play });
    }, between(min, max) * 1000);
    timers.add(timer);
  };
  recurring.forEach(playEverySoOften);

  return {
    stop: (fadeSeconds) => {
      const now = context.currentTime;
      fadeOut(fadeSeconds);
      timers.forEach(clearTimeout);
      for (const layer of layers) layer.stop(now + fadeSeconds + 0.1);
      gust.stop(now + fadeSeconds + 0.1);
      setTimeout(() => gain.disconnect(), (fadeSeconds + 3) * 1000);
    },
  };
}

/** A filter between a one-shot and where it plays, for its colour. */
function through(context: AudioContext, out: AudioNode, type: BiquadFilterType, frequency: number, q = 1) {
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  filter.connect(out);
  return filter;
}

const CROSSING_BELL: Partials = [
  [1, 1, 1],
  [2.4, 0.4, 0.5],
  [4.1, 0.2, 0.3],
];

/** A wordless cry, far off: a sung vowel through two formants, with vibrato. */
function vendorCall(context: AudioContext, out: AudioNode, at: number) {
  const voice = through(context, out, 'lowpass', 1500);
  const formants = [
    [700, 0.6],
    [1150, 0.35],
  ].map(([frequency, level]) => {
    const formant = through(context, voice, 'bandpass', frequency!, 6);
    const gain = context.createGain();
    gain.gain.value = level!;
    gain.connect(formant);
    return gain;
  });
  const glottis = context.createOscillator();
  glottis.type = 'sawtooth';
  glottis.frequency.setValueAtTime(220, at);
  glottis.frequency.linearRampToValueAtTime(300, at + 0.5);
  glottis.frequency.linearRampToValueAtTime(240, at + 1.6);
  const vibrato = context.createOscillator();
  vibrato.frequency.value = 5.5;
  const vibratoDepth = context.createGain();
  vibratoDepth.gain.value = 6;
  vibrato.connect(vibratoDepth).connect(glottis.frequency);
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(0.12, at + 0.2);
  envelope.gain.setValueAtTime(0.12, at + 1.2);
  envelope.gain.linearRampToValueAtTime(0, at + 1.7);
  glottis.connect(envelope);
  for (const formant of formants) envelope.connect(formant);
  for (const oscillator of [glottis, vibrato]) {
    oscillator.start(at);
    oscillator.stop(at + 1.8);
  }
}

/** Each Culture Pack one-shot, as it sounds out in the town. */
export const ONE_SHOTS: Record<AmbientSoundId, Sound> = {
  'bicycle-bell': (context, out, at) => {
    for (const delay of [0, 0.16]) bell(context, out, at + delay, 2900, { partials: SMALL_BELL, peak: 0.1, decay: 0.9 });
  },
  'bus-brakes': (context, out, at) => {
    tone(context, out, at, { frequency: 2600, glideTo: 2350, peak: 0.015, attack: 0.25, decay: 0.8 });
    noiseBurst(context, out, at + 1.1, { filter: 'highpass', frequency: 3000, peak: 0.08, attack: 0.01, decay: 0.9 });
  },
  'church-bells': (context, out, at) => {
    const peal = [64, 62, 60, 55];
    for (let i = 0; i < 8; i++) bell(context, out, at + i * 0.8, hz(peal[i % peal.length]!), { partials: CHURCH_BELL, peak: 0.1, decay: 4 });
  },
  'crow-caw': (context, out, at) => {
    const throat = through(context, out, 'bandpass', 1300, 3);
    for (let i = 0; i < 3; i++) {
      tone(context, throat, at + i * 0.45, { type: 'sawtooth', frequency: 520, glideTo: 430, peak: 0.12, attack: 0.02, decay: 0.26 });
      noiseBurst(context, throat, at + i * 0.45, { filter: 'bandpass', frequency: 1400, q: 2, peak: 0.05, attack: 0.02, decay: 0.24 });
    }
  },
  'evening-chime': (context, out, at) => {
    // A town loudspeaker's chime, far off: a slow phrase, softened by distance.
    const far = through(context, out, 'lowpass', 2000);
    [67, 69, 72, 69, 67, 64, 67].forEach((note, i) => bell(context, far, at + i * 0.55, hz(note), { partials: CHIME, peak: 0.06, decay: 1.1 }));
  },
  'level-crossing': (context, out, at) => {
    for (let i = 0; i < 10; i++) bell(context, out, at + i * 0.32, i % 2 ? 700 : 760, { partials: CROSSING_BELL, peak: 0.07, decay: 0.35 });
  },
  'pigeon-coo': (context, out, at) => {
    const chest = through(context, out, 'lowpass', 900);
    tone(context, chest, at, { frequency: 420, glideTo: 380, peak: 0.06, attack: 0.08, decay: 0.3 });
    tone(context, chest, at + 0.45, { frequency: 480, glideTo: 400, peak: 0.07, attack: 0.08, decay: 0.5 });
    tone(context, chest, at + 1.1, { frequency: 400, glideTo: 360, peak: 0.05, attack: 0.08, decay: 0.3 });
  },
  'scooter-horn': (context, out, at) => {
    const horn = through(context, out, 'lowpass', 1800);
    for (const delay of [0, 0.22]) {
      for (const frequency of [415, 520]) tone(context, horn, at + delay, { type: 'square', frequency, peak: 0.025, attack: 0.01, decay: 0.14 });
    }
  },
  'shop-door-chime': (context, out, at) => {
    [88, 84, 81].forEach((note, i) => bell(context, out, at + i * 0.12, hz(note), { partials: CHIME, peak: 0.06, decay: 1.2 }));
  },
  'street-vendor-call': vendorCall,
  'tram-bell': (context, out, at) => {
    for (const delay of [0, 0.45]) bell(context, out, at + delay, 1250, { partials: SMALL_BELL, peak: 0.12, decay: 1.4 });
  },
};
