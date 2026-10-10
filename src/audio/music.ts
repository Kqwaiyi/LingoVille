import type { MusicTrack } from '../store/index.ts';
import { electricPiano, fader, hz, noiseBurst, pad, pick, tone, type Playing } from './instruments.ts';

// One calm lo-fi soundtrack, played live: soft electric piano over a bass line, with brushes on the busier loops and a
// pad on the slower ones. It keeps to plain major and minor seventh chords and a free melody over them, so it belongs
// to no one country: the Culture Packs bring the local touches, in the ambient one-shots.

/** A chord: its bass note and the notes the piano voices it with, as MIDI note numbers. */
type Chord = { bass: number; notes: readonly number[] };

type Loop = {
  bpm: number;
  /** One chord per bar, round and round. */
  chords: readonly Chord[];
  /** Each eighth note's chance of a melody note. */
  melody: number;
  brushes: boolean;
  pad: boolean;
  /** How bright it is: the cutoff of the loop's lowpass filter, in Hz. */
  cutoff: number;
};

const LOOPS: Record<MusicTrack, Loop> = {
  // Fmaj7 Em7 Dm7 Cmaj7: waking up, unhurried.
  morning: {
    bpm: 74,
    chords: [
      { bass: 41, notes: [53, 57, 60, 64] },
      { bass: 40, notes: [52, 55, 59, 62] },
      { bass: 38, notes: [50, 53, 57, 60] },
      { bass: 36, notes: [52, 55, 59, 62] },
    ],
    melody: 0.28,
    brushes: true,
    pad: false,
    cutoff: 3200,
  },
  // Cmaj9 Am7 Dm9 G13: the town at its busiest.
  midday: {
    bpm: 82,
    chords: [
      { bass: 36, notes: [52, 55, 59, 62] },
      { bass: 45, notes: [52, 55, 57, 60] },
      { bass: 38, notes: [53, 57, 60, 64] },
      { bass: 43, notes: [53, 59, 64] },
    ],
    melody: 0.34,
    brushes: true,
    pad: false,
    cutoff: 4000,
  },
  // Ebmaj7 Cm7 Abmaj7 Bb7sus: warm, winding down.
  goldenHour: {
    bpm: 68,
    chords: [
      { bass: 39, notes: [55, 58, 62] },
      { bass: 36, notes: [55, 58, 60, 63] },
      { bass: 44, notes: [55, 60, 63, 67] },
      { bass: 46, notes: [56, 58, 63, 65] },
    ],
    melody: 0.24,
    brushes: true,
    pad: true,
    cutoff: 2400,
  },
  // Am9 Fmaj7 Dm9 E7sus: sparse and dark, no drums.
  night: {
    bpm: 60,
    chords: [
      { bass: 45, notes: [55, 59, 60, 64] },
      { bass: 41, notes: [53, 57, 60, 64] },
      { bass: 38, notes: [53, 57, 60, 64] },
      { bass: 40, notes: [57, 59, 62, 64] },
    ],
    melody: 0.16,
    brushes: false,
    pad: true,
    cutoff: 1800,
  },
  // Gmaj9 Bm7 Cmaj9 D9sus: close and quiet.
  home: {
    bpm: 66,
    chords: [
      { bass: 43, notes: [54, 57, 59, 62] },
      { bass: 47, notes: [54, 57, 59, 62] },
      { bass: 48, notes: [52, 55, 59, 62] },
      { bass: 50, notes: [55, 57, 60, 64] },
    ],
    melody: 0.2,
    brushes: false,
    pad: false,
    cutoff: 2600,
  },
  // Dmaj9 Bm7 Em7 A9: a light shuffle behind the counter.
  counters: {
    bpm: 86,
    chords: [
      { bass: 38, notes: [54, 57, 61, 64] },
      { bass: 47, notes: [54, 57, 59, 62] },
      { bass: 40, notes: [55, 59, 62, 64] },
      { bass: 45, notes: [55, 59, 61, 64] },
    ],
    melody: 0.3,
    brushes: true,
    pad: false,
    cutoff: 3400,
  },
  // Cmaj7 Am7 Fmaj7 G6: the title theme, slow and open.
  title: {
    bpm: 64,
    chords: [
      { bass: 36, notes: [52, 55, 59, 64] },
      { bass: 45, notes: [52, 55, 57, 60] },
      { bass: 41, notes: [52, 57, 60, 64] },
      { bass: 43, notes: [52, 55, 59, 62] },
    ],
    melody: 0.2,
    brushes: false,
    pad: true,
    cutoff: 2200,
  },
};

/** How far ahead notes are scheduled, in seconds, and how often the scheduler looks. */
const LOOKAHEAD = 0.3;
const TICK_MS = 60;
/** Where the second eighth of each beat falls, as a share of the beat: a gentle swing. */
const SWING = 0.6;

/** Starts a loop playing into `out`, fading in. */
export function playLoop(context: AudioContext, out: AudioNode, track: MusicTrack, fadeSeconds: number): Playing {
  const loop = LOOPS[track];
  const beat = 60 / loop.bpm;
  const bar = beat * 4;

  const { gain, fadeOut } = fader(context, out, fadeSeconds);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = loop.cutoff;
  filter.connect(gain);

  let barCount = 0;
  let barStart = context.currentTime + 0.1;
  let eighth = 0;

  /** One eighth note of the loop: what plays on it. */
  const play = (at: number) => {
    const chord = loop.chords[barCount % loop.chords.length]!;
    if (eighth === 0) {
      chord.notes.forEach((note, i) => electricPiano(context, filter, at + i * 0.012, note, { peak: 0.08, decay: bar * 0.9 }));
      tone(context, filter, at, { frequency: hz(chord.bass), peak: 0.22, attack: 0.01, decay: beat * 1.8 });
      if (loop.pad) pad(context, filter, at, chord.notes, { peak: 0.035, seconds: bar, cutoff: loop.cutoff * 0.6 });
    }
    if (eighth === 4) tone(context, filter, at, { frequency: hz(chord.bass + (barCount % 2 ? 7 : 0)), peak: 0.15, attack: 0.01, decay: beat * 1.5 });
    if (loop.brushes) {
      noiseBurst(context, filter, at, { filter: 'highpass', frequency: 7000, peak: eighth % 2 ? 0.018 : 0.03, decay: 0.05 });
      if (eighth === 0 || eighth === 5) tone(context, filter, at, { frequency: 110, glideTo: 45, peak: 0.25, attack: 0.003, decay: 0.25 });
      if (eighth === 2 || eighth === 6) noiseBurst(context, filter, at, { filter: 'bandpass', frequency: 1800, q: 0.8, peak: 0.05, attack: 0.01, decay: 0.18 });
    }
    // The melody rests on the downbeat, under the chord, and otherwise wanders over the chord's notes an octave or two up.
    if (eighth !== 0 && Math.random() < loop.melody) {
      const note = pick(chord.notes) + (Math.random() < 0.7 ? 12 : 24);
      electricPiano(context, filter, at, Math.min(note, 86), { peak: 0.06, decay: beat * 1.5 });
    }
  };

  const schedule = () => {
    for (;;) {
      const at = barStart + Math.floor(eighth / 2) * beat + (eighth % 2) * beat * SWING;
      if (at > context.currentTime + LOOKAHEAD) return;
      play(at);
      if (++eighth === 8) {
        eighth = 0;
        barCount++;
        barStart += bar;
      }
    }
  };
  // A loop that fell far behind (the context was suspended, say) picks up from now rather than playing catch-up.
  const keepUp = () => {
    if (barStart + bar < context.currentTime) {
      barStart = context.currentTime + 0.05;
      eighth = 0;
    }
    schedule();
  };
  keepUp();
  const timer = setInterval(keepUp, TICK_MS);

  return {
    stop: (fadeSeconds) => {
      fadeOut(fadeSeconds);
      clearInterval(timer);
      setTimeout(() => gain.disconnect(), (fadeSeconds + LOOKAHEAD + 4) * 1000);
    },
  };
}
