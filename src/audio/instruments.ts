// The game's instruments, all synthesised: every sound is made here from oscillators and noise, so there are no audio
// files to source or credit. Each plays into `out` at `at` (seconds on the context's clock) and lets itself go.

/** A sound that plays into `out` at `at`, on the context's clock, and lets itself go. */
export type Sound = (context: AudioContext, out: AudioNode, at: number) => void;

/** Something playing on until it's stopped: a music loop, an ambient bed. */
export type Playing = { stop: (fadeSeconds: number) => void };

/**
 * A gain into `out` that fades in from silence over `fadeSeconds`, and `fadeOut`, which fades it to silence from
 * wherever it is.
 */
export function fader(context: BaseAudioContext, out: AudioNode, fadeSeconds: number) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, context.currentTime);
  gain.gain.linearRampToValueAtTime(1, context.currentTime + fadeSeconds);
  gain.connect(out);
  const fadeOut = (seconds: number) => {
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + seconds);
  };
  return { gain, fadeOut };
}

/** A MIDI note number's frequency in Hz. */
export const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** Quieter than this is silence: exponential ramps can't reach 0. */
const SILENT = 0.0001;

/** A gain that rises to `peak` over `attack` seconds from `at`, then fades away over `decay`. */
export function envelope(context: BaseAudioContext, at: number, peak: number, attack: number, decay: number) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(SILENT, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, SILENT * 2), at + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, at + attack + decay);
  return gain;
}

type Tone = {
  frequency: number;
  type?: OscillatorType;
  peak: number;
  attack?: number;
  decay: number;
  /** Where the pitch ends up by the end of the decay, if it glides. */
  glideTo?: number;
};

/** One oscillator through its envelope. */
export function tone(context: BaseAudioContext, out: AudioNode, at: number, { frequency, type = 'sine', peak, attack = 0.005, decay, glideTo }: Tone) {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  if (glideTo) oscillator.frequency.exponentialRampToValueAtTime(glideTo, at + attack + decay);
  const gain = envelope(context, at, peak, attack, decay);
  oscillator.connect(gain).connect(out);
  oscillator.start(at);
  oscillator.stop(at + attack + decay + 0.05);
}

/** A bell's partials: [ratio to the strike note, level, how long it rings relative to the decay]. */
export type Partials = readonly (readonly [number, number, number])[];

/** A small bright bell: a bicycle bell, a shop door's chime, a tram's bell. */
export const SMALL_BELL: Partials = [
  [1, 1, 1],
  [2.76, 0.5, 0.6],
  [5.4, 0.25, 0.35],
  [8.93, 0.12, 0.2],
];

/** A church bell's hum, prime, minor third, fifth and nominal. */
export const CHURCH_BELL: Partials = [
  [0.5, 0.7, 1.3],
  [1, 1, 1],
  [1.2, 0.6, 0.8],
  [1.5, 0.35, 0.6],
  [2, 0.45, 0.5],
  [2.74, 0.15, 0.3],
];

/** A soft glassy chime: the UI's, and a shop door's. */
export const CHIME: Partials = [
  [1, 1, 1],
  [2, 0.3, 0.5],
  [3.01, 0.12, 0.3],
];

/** A struck bell: each partial fading at its own pace. */
export function bell(context: BaseAudioContext, out: AudioNode, at: number, frequency: number, { partials, peak, decay }: { partials: Partials; peak: number; decay: number }) {
  for (const [ratio, level, ring] of partials) tone(context, out, at, { frequency: frequency * ratio, peak: peak * level, attack: 0.002, decay: decay * ring });
}

/**
 * A soft electric piano: a sine whose brightness (frequency modulation) fades faster than its loudness, with a little
 * tine on the attack.
 */
export function electricPiano(context: BaseAudioContext, out: AudioNode, at: number, note: number, { peak, decay }: { peak: number; decay: number }) {
  const frequency = hz(note);
  const carrier = context.createOscillator();
  carrier.frequency.value = frequency;
  const modulator = context.createOscillator();
  modulator.frequency.value = frequency;
  const depth = context.createGain();
  depth.gain.setValueAtTime(frequency * 1.2, at);
  depth.gain.exponentialRampToValueAtTime(frequency * 0.08, at + Math.min(0.8, decay));
  modulator.connect(depth).connect(carrier.frequency);
  const gain = envelope(context, at, peak, 0.004, decay);
  carrier.connect(gain).connect(out);
  for (const oscillator of [carrier, modulator]) {
    oscillator.start(at);
    oscillator.stop(at + decay + 0.05);
  }
  tone(context, out, at, { frequency: frequency * 7, peak: peak * 0.06, attack: 0.001, decay: 0.08 });
}

/** A warm pad chord, swelling in and out over `seconds`. */
export function pad(context: BaseAudioContext, out: AudioNode, at: number, notes: readonly number[], { peak, seconds, cutoff }: { peak: number; seconds: number; cutoff: number }) {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + seconds * 0.35);
  gain.gain.linearRampToValueAtTime(0, at + seconds);
  filter.connect(gain).connect(out);
  for (const note of notes) {
    for (const detune of [-7, 7]) {
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = hz(note);
      oscillator.detune.value = detune;
      oscillator.connect(filter);
      oscillator.start(at);
      oscillator.stop(at + seconds + 0.05);
    }
  }
}

type NoiseColour = 'white' | 'pink' | 'brown';
const noiseBuffers = new WeakMap<BaseAudioContext, Partial<Record<NoiseColour, AudioBuffer>>>();

/** A few seconds of noise, made once per context, to loop or cut from. */
export function noise(context: BaseAudioContext, colour: NoiseColour): AudioBuffer {
  const made = noiseBuffers.get(context) ?? {};
  noiseBuffers.set(context, made);
  if (made[colour]) return made[colour];
  const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
  const samples = buffer.getChannelData(0);
  let brown = 0;
  let [b0, b1, b2] = [0, 0, 0];
  for (let i = 0; i < samples.length; i++) {
    const white = Math.random() * 2 - 1;
    if (colour === 'white') samples[i] = white;
    else if (colour === 'brown') samples[i] = brown = (brown + 0.02 * white) / 1.02;
    else {
      // Paul Kellet's economy pink filter.
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      samples[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    }
  }
  if (colour === 'brown') for (let i = 0; i < samples.length; i++) samples[i]! *= 3.5;
  return (made[colour] = buffer);
}

type Burst = { colour?: NoiseColour; filter: BiquadFilterType; frequency: number; sweepTo?: number; q?: number; peak: number; attack?: number; decay: number };

/** A burst of filtered noise: a brush on a drum, a page turning, air brakes letting go. */
export function noiseBurst(context: BaseAudioContext, out: AudioNode, at: number, { colour = 'white', filter: type, frequency, sweepTo, q = 1, peak, attack = 0.002, decay }: Burst) {
  const source = context.createBufferSource();
  source.buffer = noise(context, colour);
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(frequency, at);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + attack + decay);
  const gain = envelope(context, at, peak, attack, decay);
  source.connect(filter).connect(gain).connect(out);
  // Start somewhere in the buffer, so no two bursts sound the same.
  source.start(at, Math.random() * 3);
  source.stop(at + attack + decay + 0.05);
}

/** Looped noise through a filter: the body of an ambient bed. Returns the gain to fade it with. */
export function noiseBed(context: BaseAudioContext, out: AudioNode, { colour, filter: type, frequency, q = 0.7, level }: { colour: NoiseColour; filter: BiquadFilterType; frequency: number; q?: number; level: number }) {
  const source = context.createBufferSource();
  source.buffer = noise(context, colour);
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = context.createGain();
  gain.gain.value = level;
  source.connect(filter).connect(gain).connect(out);
  source.start(context.currentTime, Math.random() * 3);
  return { gain, stop: (at: number) => source.stop(at) };
}

/** A room's echo: decaying stereo noise as an impulse response. */
export function reverb(context: BaseAudioContext, seconds: number) {
  const convolver = context.createConvolver();
  const impulse = context.createBuffer(2, Math.floor(context.sampleRate * seconds), context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const samples = impulse.getChannelData(channel);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 3;
  }
  convolver.buffer = impulse;
  return convolver;
}

export const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!;
export const between = (min: number, max: number) => min + Math.random() * (max - min);
