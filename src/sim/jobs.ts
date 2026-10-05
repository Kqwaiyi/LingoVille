import type { GameState, JobId } from './state.ts';

/**
 * A name as it is compared: full-width letters made plain, lower case, accents
 * dropped (but not the marks kana need), katakana read as hiragana, and split
 * into its parts at anything that isn't a letter or a digit.
 */
function nameParts(name: string): string[] {
  const plain = name
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .replace(/[ァ-ヶ]/g,(kana) => String.fromCharCode(kana.charCodeAt(0) - 0x60));
  return plain.split(/[^\p{L}\p{N}]+/u).filter((part) => part !== '');
}

/**
 * Whether the name an NPC heard is the Character's name from setup: the whole
 * name, or one part of it ("Sam" for "Sam Lee"). Hiring checks the applicant's
 * name with it, and so will `learn_name`.
 */
export function namesMatch(heard: string, characterName: string): boolean {
  const heardName = nameParts(heard).join('');
  if (heardName === '') return false;
  const parts = nameParts(characterName);
  return heardName === parts.join('') || parts.includes(heardName);
}

/** The Character has the Job. Each Job is hired once. */
export function hire(state: GameState, jobId: JobId): GameState {
  const { possessions } = state;
  if (possessions.jobsHired.includes(jobId)) return state;
  return { ...state, possessions: { ...possessions, jobsHired: [...possessions.jobsHired, jobId] } };
}
