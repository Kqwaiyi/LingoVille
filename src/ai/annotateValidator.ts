import {
  alignFurigana,
  hasHan,
  isHan,
  isKanaOnly,
  pinyinPerCharacter,
  toHiraganaOnly,
  type ReadingLanguage,
  type Segment,
} from './readings.ts';

// The four checks the model's readings must pass before they replace the
// library's. Any doubt keeps the library reading: a reading aid that is
// quietly wrong is worse than one that is a little off.

/** Which check failed: the bases, the script, the length, or agreement with pinyin-pro. */
export type ReadingRule = 'base' | 'script' | 'length' | 'library';
export type ReadingCheck = { ok: true; rule?: never } | { ok: false; rule: ReadingRule; detail: string };

const PASS: ReadingCheck = { ok: true };
const fail = (rule: ReadingRule, detail: string): ReadingCheck => ({ ok: false, rule, detail });

/** Checks the model's segments for a line. They replace the library reading only if this passes. */
export function checkReadings(language: ReadingLanguage, line: string, segments: Segment[]): ReadingCheck {
  const joined = segments.map((segment) => segment.base).join('');
  if (joined !== line) return fail('base', `the segments make "${joined}", not "${line}"`);
  return language === 'zh' ? checkPinyin(line, segments) : checkKana(segments);
}

// --- zh ----------------------------------------------------------------------

const TONED = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const TONE_MARK = new RegExp(`[${TONED}]`, 'g');
const SYLLABLE = new RegExp(`^[a-zü${TONED}]+$`);
const TONELESS: Record<string, string> = Object.fromEntries(
  [...TONED].map((vowel, i) => [vowel, 'aeiouü'[Math.floor(i / 4)]!]),
);
const toneless = (syllable: string) => syllable.replace(TONE_MARK, (vowel) => TONELESS[vowel]!);
const toneMarks = (syllable: string) => syllable.match(TONE_MARK)?.length ?? 0;

// They change tone with the syllable after them, which pinyin-pro may or may not apply.
const TONE_SANDHI = new Set(['一', '不']);

function checkPinyin(line: string, segments: Segment[]): ReadingCheck {
  const read: { char: string; syllable: string }[] = [];
  for (const { base, reading } of segments) {
    const syllables = reading.split(/\s+/).filter(Boolean);
    const bad = syllables.find((syllable) => !SYLLABLE.test(syllable) || toneMarks(syllable) > 1);
    if (bad !== undefined) return fail('script', `"${bad}" in "${base}" is not a pinyin syllable with tone marks`);
    const hanzi = [...base].filter(isHan);
    if (syllables.length !== hanzi.length) return fail('length', `"${base}" has ${hanzi.length} hanzi but ${syllables.length} syllables`);
    hanzi.forEach((char, i) => read.push({ char, syllable: syllables[i]! }));
  }
  const library = pinyinPerCharacter(line).filter(({ char }) => isHan(char));
  // A line of only neutral tones is possible (吗？), but not when pinyin-pro hears tones in it.
  const marked = (syllables: string[]) => syllables.some((syllable) => toneMarks(syllable) > 0);
  if (!marked(read.map(({ syllable }) => syllable)) && marked(library.map(({ reading }) => reading))) {
    return fail('script', 'no syllable has a tone mark');
  }

  for (const [i, { char, syllable }] of read.entries()) {
    const known = library[i]!;
    if (!agrees(char, syllable, known.reading, known.polyphonic)) {
      return fail('library', `${char} read as "${syllable}", but pinyin-pro reads it "${known.reading}"`);
    }
  }
  return PASS;
}

/** A syllable agrees with pinyin-pro's reading of its hanzi, allowing for neutral tones and tone sandhi. */
function agrees(char: string, syllable: string, reading: string, polyphonic: string[]) {
  // A hanzi pinyin-pro can't read, or one of its polyphonic hanzi: these are what the model is for.
  if (!reading || polyphonic.length > 1) return true;
  if (syllable === reading) return true;
  // A neutral tone where a dictionary marks one, as in 谢谢 xiè xie.
  if (toneMarks(syllable) === 0 && toneless(reading) === syllable) return true;
  return TONE_SANDHI.has(char) && toneless(syllable) === toneless(reading);
}

// --- ja ----------------------------------------------------------------------

// The most kana one kanji plausibly reads as (承 is three: うけたまわ is the outlier at five).
const MAX_KANA_PER_KANJI = 5;

function checkKana(segments: Segment[]): ReadingCheck {
  for (const { base, reading } of segments) {
    if (reading !== '' && !isKanaOnly(reading)) return fail('script', `"${reading}" over "${base}" is not kana`);
    if (hasHan(base)) {
      const chars = [...base];
      const kanji = chars.filter(isHan).length;
      const kana = chars.filter((char) => isKanaOnly(char)).length;
      // A number read out (450円 よんひゃくごじゅうえん) can be any length.
      const number = /\d/.test(base);
      const length = [...reading].length;
      if (length < kanji + kana || (!number && length > kanji * MAX_KANA_PER_KANJI + kana)) {
        return fail('length', `"${reading}" is an implausible reading of "${base}"`);
      }
      if (!alignFurigana(base, reading)) return fail('length', `the kana in "${base}" don't match "${reading}"`);
    } else if (isKanaOnly(base)) {
      if (reading !== '' && toHiraganaOnly(reading) !== toHiraganaOnly(base)) {
        return fail('length', `kana "${base}" read as "${reading}"`);
      }
    } else if (reading !== '' && !/\d/.test(base)) {
      return fail('length', `"${base}" needs no reading, but has "${reading}"`);
    }
  }
  return PASS;
}

/**
 * A word's reading, as a Recap's new words show it: the model's if it passes the
 * checks, otherwise the library's reading of the word, or none if there is none.
 */
export function wordReading(language: ReadingLanguage, word: Segment, library: Segment[] | null): string {
  if (checkReadings(language, word.base, [word]).ok) return word.reading;
  if (!library) return '';
  if (language === 'zh') return library.flatMap((segment) => (segment.reading ? [segment.reading] : [])).join(' ');
  return library.map((segment) => segment.reading || segment.base).join('');
}
