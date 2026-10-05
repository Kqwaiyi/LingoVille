import { METER_MAX, MOOD } from './tuning.ts';

/** The faces the dock's Mood gauge can show, worst first. */
export const MOOD_FACES = ['miserable', 'low', 'okay', 'good', 'great'] as const satisfies readonly (keyof typeof MOOD.faceFrom)[];
export type MoodFace = (typeof MOOD_FACES)[number];

/** What Shift pay and Life Skill XP are multiplied by at this Mood. */
export function moodModifier(mood: number): number {
  const { atZero, atMax } = MOOD.modifier;
  return atZero + (atMax - atZero) * (mood / METER_MAX);
}

/** The face that matches this Mood. */
export function moodFace(mood: number): MoodFace {
  return MOOD_FACES.findLast((face) => mood >= MOOD.faceFrom[face]) ?? MOOD_FACES[0];
}
