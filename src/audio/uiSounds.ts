import type { UiSound } from '../store/index.ts';
import { bell, CHIME, hz, noiseBurst, tone, type Sound } from './instruments.ts';

// The UI's sounds: short and soft, so feedback is clear but never harsh. Saved ✓ has none.

export const UI_SOUNDS: Record<UiSound, Sound> = {
  click: (context, out, at) => tone(context, out, at, { frequency: 1400, glideTo: 900, peak: 0.05, attack: 0.001, decay: 0.03 }),
  // Two coins, up.
  moneyIn: (context, out, at) => {
    bell(context, out, at, hz(88), { partials: CHIME, peak: 0.07, decay: 0.5 });
    bell(context, out, at + 0.07, hz(95), { partials: CHIME, peak: 0.06, decay: 0.6 });
  },
  // Two coins, down, and quieter.
  moneyOut: (context, out, at) => {
    bell(context, out, at, hz(84), { partials: CHIME, peak: 0.05, decay: 0.35 });
    bell(context, out, at + 0.06, hz(79), { partials: CHIME, peak: 0.045, decay: 0.4 });
  },
  success: (context, out, at) => {
    [72, 76, 79, 84].forEach((note, i) => bell(context, out, at + i * 0.08, hz(note), { partials: CHIME, peak: 0.07, decay: 1.2 }));
  },
  // Two soft notes falling a minor third: something didn't work, gently.
  failure: (context, out, at) => {
    const soft = context.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 1200;
    soft.connect(out);
    tone(context, soft, at, { type: 'triangle', frequency: hz(64), peak: 0.07, attack: 0.01, decay: 0.35 });
    tone(context, soft, at + 0.18, { type: 'triangle', frequency: hz(61), peak: 0.06, attack: 0.01, decay: 0.5 });
  },
  pageTurn: (context, out, at) => {
    noiseBurst(context, out, at, { colour: 'pink', filter: 'bandpass', frequency: 900, sweepTo: 3500, q: 0.8, peak: 0.14, attack: 0.04, decay: 0.18 });
    noiseBurst(context, out, at + 0.17, { colour: 'pink', filter: 'lowpass', frequency: 600, peak: 0.08, decay: 0.05 });
  },
  // Low and quiet: a hint, not an alarm.
  patienceLow: (context, out, at) => {
    tone(context, out, at, { frequency: hz(57), peak: 0.06, attack: 0.02, decay: 0.4 });
    tone(context, out, at + 0.2, { frequency: hz(55), peak: 0.05, attack: 0.02, decay: 0.5 });
  },
};
