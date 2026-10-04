import { pinyin } from 'pinyin-pro';
import { toRomaji } from 'wanakana';
import { z } from 'zod';
import type { LanguageCode } from '../sim/index.ts';

// Reading aids for Chinese and Japanese: pinyin over hanzi, furigana over kanji.
// A line is a list of segments; joined, their bases are the line. A segment's
// reading is empty when it needs none (kana, punctuation, numbers, Latin).

export const SegmentSchema = z.object({
  base: z.string().describe('A word or run of characters from the line, exactly as written.'),
  reading: z.string().describe('How the word is read, or empty when it needs no reading.'),
});
export type Segment = z.infer<typeof SegmentSchema>;

/** The Target Languages with reading aids. */
export const READING_LANGUAGES = ['zh', 'ja'] as const;
export type ReadingLanguage = (typeof READING_LANGUAGES)[number];

export function hasReadingAids(language: LanguageCode): language is ReadingLanguage {
  return (READING_LANGUAGES as readonly string[]).includes(language);
}

// Hanzi and kanji, including 々.
const HAN = /\p{Script=Han}/u;
const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;

export const isHan = (char: string) => HAN.test(char);
export const hasHan = (text: string) => [...text].some(isHan);
export const isKanaOnly = (text: string) => KANA_ONLY.test(text);

/** Katakana as hiragana, leaving ー and everything else as it is. */
export function toHiraganaOnly(text: string) {
  return text.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

/** pinyin-pro's reading of a line, per character, in context. */
export function pinyinPerCharacter(line: string) {
  return pinyin(line, { type: 'all' }).map((char) => ({ char: char.origin, reading: char.pinyin, polyphonic: char.polyphonic }));
}

/** The zh library reading: each hanzi with its pinyin from pinyin-pro, everything else with none. */
export function libraryPinyin(line: string): Segment[] {
  return pinyinPerCharacter(line).map(({ char, reading }) => ({ base: char, reading: isHan(char) ? reading : '' }));
}

/** A word as kuromoji tokenises it: its surface form, its reading in katakana if known, and its part of speech. */
export type KanaToken = { surface: string; reading?: string; pos: string };

// Auxiliary verbs (ます, た) join the verb, or the ending, before them: 食べました, not 食べ まし た.
const ENDING = '助動詞';
const TAKES_ENDINGS = new Set(['動詞', ENDING]);
// Joined to the word after them: prefixes (ご, お).
const PREFIX = '接頭詞';

/**
 * The ja library reading, from kuromoji's tokens: each word with kanji gets a
 * hiragana reading. Prefixes join their word and endings their verb, so romaji
 * reads as words.
 */
export function libraryKana(tokens: KanaToken[]): Segment[] {
  const words: { base: string; kana: string | null; pos: string }[] = [];
  for (const token of tokens) {
    // A word with kanji needs a reading to have one at all.
    const kana = token.reading && token.reading !== '*' ? toHiraganaOnly(token.reading) : hasHan(token.surface) ? null : token.surface;
    const last = words.at(-1);
    if (last && (last.pos === PREFIX || (token.pos === ENDING && TAKES_ENDINGS.has(last.pos)))) {
      last.base += token.surface;
      last.kana = last.kana === null || kana === null ? null : last.kana + kana;
      // The word is what the prefix was joined to; a verb with an ending takes more endings.
      if (last.pos === PREFIX) last.pos = token.pos;
    } else {
      words.push({ base: token.surface, kana, pos: token.pos });
    }
  }
  return words.map(({ base, kana }) => ({ base, reading: hasHan(base) && kana !== null ? kana : '' }));
}

const isPunctuation = (text: string) => /^[\p{P}\p{S}\s]+$/u.test(text);

/**
 * Lines a word's kana reading up with its kanji, so furigana sit over the kanji
 * and not their okurigana: 決まり + きまり → 決(き)まり. Numbers are read too, as
 * in 450円 よんひゃくごじゅうえん. Null if the kana in the word don't match the reading.
 */
export function alignFurigana(base: string, reading: string): Segment[] | null {
  const runs = [...base].reduce<{ text: string; read: boolean }[]>((acc, char) => {
    const read = isHan(char) || /\d/.test(char);
    const last = acc.at(-1);
    if (last && last.read === read) last.text += char;
    else acc.push({ text: char, read });
    return acc;
  }, []);
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = runs.map((run) => (run.read ? '(.+?)' : `(${escape(toHiraganaOnly(run.text))})`)).join('');
  const match = new RegExp(`^${pattern}$`, 'u').exec(toHiraganaOnly(reading));
  if (!match) return null;
  // The reading's own characters, so katakana readings stay katakana.
  let at = 0;
  return runs.map((run, i) => {
    const length = [...match[i + 1]!].length;
    const piece = [...reading].slice(at, at + length).join('');
    at += length;
    return { base: run.text, reading: run.read ? piece : '' };
  });
}

/**
 * What to put a ruby over, from a line's segments: one syllable over each
 * hanzi, and furigana over kanji but not their okurigana.
 */
export function rubyUnits(language: ReadingLanguage, segments: Segment[]): Segment[] {
  return segments.flatMap((segment) => (language === 'zh' ? pinyinUnits(segment) : furiganaUnits(segment)));
}

function pinyinUnits({ base, reading }: Segment): Segment[] {
  const syllables = reading.split(/\s+/).filter(Boolean);
  const chars = [...base];
  if (syllables.length !== chars.filter(isHan).length) return [{ base, reading }];
  const units: Segment[] = [];
  for (const char of chars) {
    if (isHan(char)) units.push({ base: char, reading: syllables.shift()! });
    else if (units.at(-1)?.reading === '') units.at(-1)!.base += char;
    else units.push({ base: char, reading: '' });
  }
  return units;
}

function furiganaUnits({ base, reading }: Segment): Segment[] {
  if (!reading || !hasHan(base)) return [{ base, reading: '' }];
  // Where a number's reading ends and its counter's begins can't be told, so the reading spans both.
  if (/\d/.test(base)) return [{ base, reading }];
  return alignFurigana(base, reading) ?? [{ base, reading }];
}

// Particles that are written one way and said another.
const SAID_AS: Record<string, string> = { は: 'wa', へ: 'e', を: 'o' };

/** The romaji line under a Japanese line: its readings spelled out word by word. */
export function romaji(segments: Segment[]): string {
  let line = '';
  for (const { base, reading } of segments) {
    const word = SAID_AS[base] ?? toRomaji(reading || base);
    if (isPunctuation(base)) line += word;
    else line += (line === '' || line.endsWith(' ') ? '' : ' ') + word;
  }
  return line.trim();
}
