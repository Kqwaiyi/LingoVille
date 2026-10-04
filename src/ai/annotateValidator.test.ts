import { describe, expect, it } from 'vitest';
import { checkReadings, libraryPinyin, wordReading, type ReadingCheck, type Segment } from './index.ts';

type Case = { name: string; line: string; segments: Segment[]; expected: ReadingCheck['rule'] | 'pass' };

const s = (base: string, reading = ''): Segment => ({ base, reading });

const rule = (check: ReadingCheck) => (check.ok ? 'pass' : check.rule);

// The library readings these lines are known to get wrong, and the model's correct ones.
describe('the known library misreadings', () => {
  it('pinyin-pro reads 长得 as cháng dé and 还钱 as hái qián', () => {
    expect(libraryPinyin('他长得很高。').map((segment) => segment.reading)).toEqual(['tā', 'cháng', 'dé', 'hěn', 'gāo', '']);
    expect(libraryPinyin('我还钱给你。').map((segment) => segment.reading)).toEqual(['wǒ', 'hái', 'qián', 'gěi', 'nǐ', '']);
  });
});

const ZH: Case[] = [
  // Passing: the corrections the model exists for.
  { name: '长得 read as zhǎng de', line: '他长得很高。', segments: [s('他', 'tā'), s('长得', 'zhǎng de'), s('很高', 'hěn gāo'), s('。')], expected: 'pass' },
  { name: '还钱 read as huán qián', line: '我还钱给你。', segments: [s('我', 'wǒ'), s('还钱', 'huán qián'), s('给你', 'gěi nǐ'), s('。')], expected: 'pass' },
  { name: 'a neutral tone the library marks', line: '谢谢！', segments: [s('谢谢', 'xiè xie'), s('！')], expected: 'pass' },
  { name: '一 and 不 with or without tone sandhi', line: '一杯不要', segments: [s('一杯', 'yī bēi'), s('不要', 'bú yào')], expected: 'pass' },
  { name: 'digits and Latin letters with no reading', line: 'OK，28块。', segments: [s('OK，28'), s('块', 'kuài'), s('。')], expected: 'pass' },
  // Rule 1: the bases make up the line exactly.
  { name: 'a dropped full stop', line: '他长得很高。', segments: [s('他', 'tā'), s('长得', 'zhǎng de'), s('很高', 'hěn gāo')], expected: 'base' },
  { name: 'a changed character', line: '我还钱给你。', segments: [s('我', 'wǒ'), s('换钱', 'huàn qián'), s('给你', 'gěi nǐ'), s('。')], expected: 'base' },
  // Rule 2: pinyin syllables with tone marks.
  { name: 'tone numbers', line: '很高', segments: [s('很高', 'hen3 gao1')], expected: 'script' },
  { name: 'hanzi as the reading', line: '很高', segments: [s('很高', '很高')], expected: 'script' },
  { name: 'no tone marks at all', line: '你很高', segments: [s('你很高', 'ni hen gao')], expected: 'script' },
  { name: 'two tone marks in one syllable', line: '高', segments: [s('高', 'gāó')], expected: 'script' },
  // Rule 3: one syllable per hanzi.
  { name: 'one syllable for two hanzi', line: '长得', segments: [s('长得', 'zhǎng')], expected: 'length' },
  { name: 'a reading over punctuation', line: '好。', segments: [s('好', 'hǎo'), s('。', 'jù')], expected: 'length' },
  // Rule 4: agrees with pinyin-pro, except on its polyphonic characters.
  { name: 'a wrong tone on a character with one reading', line: '他很高', segments: [s('他很高', 'tā hén gāo')], expected: 'library' },
  { name: 'any reading over a polyphonic character', line: '我还钱', segments: [s('我还钱', 'wǒ hào qián')], expected: 'pass' },
  { name: 'a wrong reading next to a polyphonic character', line: '我还钱', segments: [s('我还钱', 'wǒ huán qiǎn')], expected: 'library' },
];

const JA: Case[] = [
  // Passing: the corrections the model exists for.
  {
    name: '一日中 read as いちにちじゅう',
    line: '一日中ずっと働きました。',
    segments: [s('一日中', 'いちにちじゅう'), s('ずっと'), s('働きました', 'はたらきました'), s('。')],
    expected: 'pass',
  },
  { name: 'この方 read as このかた', line: 'この方はどなたですか？', segments: [s('この'), s('方', 'かた'), s('は'), s('どなたですか'), s('？')], expected: 'pass' },
  { name: 'kana read as themselves', line: 'ホットラテですね', segments: [s('ホットラテ', 'ホットラテ'), s('ですね', 'ですね')], expected: 'pass' },
  { name: 'a number with or without a reading', line: '450円です', segments: [s('450'), s('円', 'えん'), s('です')], expected: 'pass' },
  { name: 'a price read as one word', line: '450円です', segments: [s('450円', 'よんひゃくごじゅうえん'), s('です')], expected: 'pass' },
  // Rule 1: the bases make up the line exactly.
  { name: 'a dropped particle', line: 'この方はどなたですか？', segments: [s('この'), s('方', 'かた'), s('どなたですか'), s('？')], expected: 'base' },
  // Rule 2: kana only.
  { name: 'romaji as the reading', line: '方', segments: [s('方', 'kata')], expected: 'script' },
  { name: 'kanji in the reading', line: '一日中', segments: [s('一日中', 'いち日じゅう')], expected: 'script' },
  // Rule 3: plausible length, and kana read as themselves.
  { name: 'no reading over kanji', line: '方です', segments: [s('方'), s('です')], expected: 'length' },
  { name: 'kana read as something else', line: '方です', segments: [s('方', 'かた'), s('です', 'だ')], expected: 'length' },
  { name: 'fewer kana than kanji', line: '一日中', segments: [s('一日中', 'いち')], expected: 'length' },
  { name: 'okurigana that do not match the reading', line: '食べました', segments: [s('食べました', 'のみました')], expected: 'length' },
  { name: 'a reading over punctuation', line: '方。', segments: [s('方', 'かた'), s('。', 'まる')], expected: 'length' },
];

describe('checkReadings', () => {
  it.each(ZH)('zh: $name → $expected', ({ line, segments, expected }) => {
    expect(rule(checkReadings('zh', line, segments))).toBe(expected);
  });

  it.each(JA)('ja: $name → $expected', ({ line, segments, expected }) => {
    expect(rule(checkReadings('ja', line, segments))).toBe(expected);
  });

  it('accepts the library’s own reading of a line', () => {
    const line = '一杯热拿铁，二十八块。对吗？';
    expect(checkReadings('zh', line, libraryPinyin(line))).toEqual({ ok: true });
  });

  it('says what failed', () => {
    const check = checkReadings('zh', '他很高', [s('他很高', 'tā hén gāo')]);
    expect(check).toMatchObject({ ok: false, rule: 'library' });
    expect(check.ok || check.detail).toContain('很');
  });
});

describe('wordReading', () => {
  it('keeps a word’s reading that passes the checks', () => {
    expect(wordReading('ja', s('この方', 'このかた'), [s('この'), s('方', 'ほう')])).toBe('このかた');
    expect(wordReading('zh', s('长得', 'zhǎng de'), libraryPinyin('长得'))).toBe('zhǎng de');
  });

  it('puts the library’s reading in place of one that fails', () => {
    expect(wordReading('ja', s('一日中', 'ichinichijuu'), [s('一日', 'いちにち'), s('中', 'ちゅう')])).toBe('いちにちちゅう');
    expect(wordReading('ja', s('ご注文は', 'ちゅうもん'), [s('ご注文', 'ごちゅうもん'), s('は')])).toBe('ごちゅうもんは');
    expect(wordReading('zh', s('长得，', 'zhang3 de'), libraryPinyin('长得，'))).toBe('cháng dé');
  });

  it('has no reading when the library can’t read the word either', () => {
    expect(wordReading('ja', s('方', 'kata'), null)).toBe('');
  });
});
