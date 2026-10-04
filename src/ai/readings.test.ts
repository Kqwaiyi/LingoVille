import { describe, expect, it } from 'vitest';
import { libraryKana, libraryPinyin, romaji, rubyUnits, type KanaToken, type Segment } from './index.ts';

const s = (base: string, reading = ''): Segment => ({ base, reading });

describe('libraryPinyin', () => {
  it('gives each hanzi its pinyin with tone marks, and everything else no reading', () => {
    expect(libraryPinyin('OK，你好！')).toEqual([s('O'), s('K'), s('，'), s('你', 'nǐ'), s('好', 'hǎo'), s('！')]);
  });
});

describe('libraryKana', () => {
  // As kuromoji tokenises 「ご注文はお決まりですか？」 and 「ホットラテ、食べました」.
  const tokens: KanaToken[] = [
    { surface: 'ご', reading: 'ゴ', pos: '接頭詞' },
    { surface: '注文', reading: 'チュウモン', pos: '名詞' },
    { surface: 'は', reading: 'ハ', pos: '助詞' },
    { surface: 'お', reading: 'オ', pos: '接頭詞' },
    { surface: '決まり', reading: 'キマリ', pos: '名詞' },
    { surface: 'です', reading: 'デス', pos: '助動詞' },
    { surface: 'か', reading: 'カ', pos: '助詞' },
    { surface: '？', reading: '？', pos: '記号' },
    { surface: 'ホットラテ', pos: '名詞' },
    { surface: '、', reading: '、', pos: '記号' },
    { surface: '食べ', reading: 'タベ', pos: '動詞' },
    { surface: 'まし', reading: 'マシ', pos: '助動詞' },
    { surface: 'た', reading: 'タ', pos: '助動詞' },
  ];

  it('gives words with kanji a hiragana reading, joining prefixes to their word and endings to their verb', () => {
    expect(libraryKana(tokens)).toEqual([
      s('ご注文', 'ごちゅうもん'),
      s('は'),
      s('お決まり', 'おきまり'),
      s('です'),
      s('か'),
      s('？'),
      s('ホットラテ'),
      s('、'),
      s('食べました', 'たべました'),
    ]);
  });

  it('leaves a word with kanji but no known reading without one', () => {
    expect(libraryKana([{ surface: '鬱', pos: '名詞' }])).toEqual([s('鬱')]);
  });
});

describe('rubyUnits', () => {
  it('zh: puts one syllable over each hanzi', () => {
    expect(rubyUnits('zh', [s('长得', 'zhǎng de'), s('，'), s('OK吗', 'ma')])).toEqual([
      s('长', 'zhǎng'),
      s('得', 'de'),
      s('，'),
      s('OK'),
      s('吗', 'ma'),
    ]);
  });

  it('ja: puts furigana over the kanji only, not their okurigana', () => {
    expect(rubyUnits('ja', [s('お決まりです', 'おきまりです'), s('一日中', 'いちにちじゅう'), s('は')])).toEqual([
      s('お'),
      s('決', 'き'),
      s('まりです'),
      s('一日中', 'いちにちじゅう'),
      s('は'),
    ]);
  });

  it('ja: keeps the whole reading when the kana cannot be lined up', () => {
    expect(rubyUnits('ja', [s('食べ', 'のみ')])).toEqual([s('食べ', 'のみ')]);
  });

  it('ja: keeps the whole reading over a number and its counter', () => {
    expect(rubyUnits('ja', [s('450円', 'よんひゃくごじゅうえん')])).toEqual([s('450円', 'よんひゃくごじゅうえん')]);
  });

  it('ja: needs no ruby over kana read as themselves', () => {
    expect(rubyUnits('ja', [s('ホットラテ', 'ホットラテ')])).toEqual([s('ホットラテ')]);
  });

  it('reads a word the same way whether its reading is hiragana or katakana', () => {
    expect(rubyUnits('ja', [s('決まり', 'キマリ')])).toEqual([s('決', 'キ'), s('まり')]);
  });
});

describe('romaji', () => {
  it('spells out the readings word by word, with particles as said', () => {
    expect(romaji([s('ご注文', 'ごちゅうもん'), s('は'), s('お決まりです', 'おきまりです'), s('か'), s('？')])).toBe(
      'gochuumon wa okimaridesu ka?',
    );
  });

  it('reads を and へ as said, and keeps numbers', () => {
    expect(romaji([s('450'), s('円', 'えん'), s('を'), s('駅', 'えき'), s('へ'), s('。')])).toBe('450 en o eki e.');
  });
});
