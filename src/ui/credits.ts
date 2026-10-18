import creditsMarkdown from '../../CREDITS.md?raw';
import { parseCredits } from './parseCredits.ts';

export type { Credit, Credits } from './parseCredits.ts';

/** The credits screen reads `CREDITS.md` itself, so the screen and the file are one list. */
export const CREDITS = parseCredits(creditsMarkdown);
