import type { LanguageCode } from '../src/sim/index.ts';

// Whether an NPC line is in the Target Language, by script and, between English and German, by their commonest words.
// Loanwords are fine: a few Latin words inside a Chinese or Japanese line ("latte", "OK") don't make it another language.

const HAN = /\p{Script=Han}/u;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const LATIN = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;
const WORD = /[\p{Script=Latin}'’]+/gu;

/** More Latin words in a row than a loanword or a name would take. */
const LATIN_RUN = /\p{Script=Latin}+(?:[\s,'’-]+\p{Script=Latin}+){2,}/u;

/** A Japanese line this long with no kana at all reads as Chinese. */
const KANJI_ONLY_LIMIT = 6;

// Words common in one language and rare in the other, so a line full of them gives itself away.
const COMMON_WORDS: Record<'en' | 'de', Set<string>> = {
  en: new Set(
    'the and is are you your would like what please thank thanks here have do does it that this of to for with sorry yes can we my be will how much one there anything else right'.split(' '),
  ),
  de: new Set(
    'der das und ist sind du sie ihr möchten möchtest bitte danke hier haben hast ich wir mein ein eine einen mit für zu nicht ja gern gerne kann können wie viel noch auch schon entschuldigung tschüss guten etwas sonst richtig'.split(
      ' ',
    ),
  ),
};

/** Why `line` isn't in `language`, or null if it is. */
export function offTargetLanguage(language: LanguageCode, line: string): string | null {
  const letters = [...line].filter((ch) => LETTER.test(ch));
  if (letters.length === 0) return null;
  const count = (script: RegExp) => letters.filter((ch) => script.test(ch)).length;
  const foreign = letters.find((ch) => !HAN.test(ch) && !KANA.test(ch) && !LATIN.test(ch) && ch !== 'ー');
  if (foreign) return `"${foreign}" is in another script`;

  if (language === 'zh' || language === 'ja') {
    if (language === 'zh' && count(KANA) > 0) return 'Japanese kana in a Chinese line';
    if (language === 'ja' && count(KANA) === 0 && count(HAN) >= KANJI_ONLY_LIMIT) return 'reads as Chinese: no kana at all';
    if (LATIN_RUN.test(line)) return 'a run of Latin words, more than a loanword';
    return null;
  }

  if (count(HAN) + count(KANA) > 0) return 'Chinese or Japanese characters';
  const other = language === 'en' ? 'de' : 'en';
  const words = (line.toLowerCase().match(WORD) ?? []).map((word) => word.replace(/['’]/g, ''));
  const own = words.filter((word) => COMMON_WORDS[language].has(word)).length;
  const others = words.filter((word) => COMMON_WORDS[other].has(word)).length;
  if (others >= 2 && others > own) return `reads as ${other === 'en' ? 'English' : 'German'}`;
  return null;
}
