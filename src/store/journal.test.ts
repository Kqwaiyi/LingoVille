import 'fake-indexeddb/auto';
import { createStore, set } from 'idb-keyval';
import { describe, expect, it } from 'vitest';
import { createJournal, JOURNAL_SCHEMA_VERSION, parseJournalEntry, type NewJournalEntry } from './index.ts';

let databases = 0;
/** A Journal over its own fresh IndexedDB database, with the raw store so a test can plant stored bytes. */
function freshJournal() {
  const raw = createStore(`journal-test-${++databases}`, 'entries');
  return { journal: createJournal(() => raw), raw };
}

const entry = (day: number, outcome = `Ordered a latte on day ${day}.`): NewJournalEntry => ({
  kind: 'goal',
  npcId: 'barista',
  npcName: '佐藤',
  interactionId: 'order-drink',
  placeName: 'ほしコーヒー',
  day,
  minuteOfDay: 7 * 60 + 30,
  targetLanguage: 'ja',
  nativeLanguage: 'en',
  outcome: 'success',
  recap: {
    outcome,
    corrections: [{ said: 'ラテ ください', natural: 'ラテをください', why: 'を marks what you want.' }],
    newWords: [{ base: 'いらっしゃいませ', reading: 'いらっしゃいませ', gloss: 'welcome' }],
  },
  lines: [
    { speaker: 'npc', text: 'いらっしゃいませ！' },
    { speaker: 'player', text: 'ラテ ください', typed: true },
  ],
  helpLog: [],
});

describe('the Journal', () => {
  it('keeps every entry for a slot, newest first', async () => {
    const { journal } = freshJournal();

    await journal.append('slot-1', entry(1));
    await journal.append('slot-1', entry(2));
    await journal.append('slot-1', entry(3));

    const entries = await journal.list('slot-1');
    expect(entries.map((e) => e.day)).toEqual([3, 2, 1]);
    expect(entries[0]).toMatchObject({ ...entry(3), schemaVersion: JOURNAL_SCHEMA_VERSION, noHelpNeeded: true });
  });

  it('keeps each slot’s entries apart', async () => {
    const { journal } = freshJournal();

    await journal.append('slot-1', entry(1));
    await journal.append('slot-2', entry(5));

    expect((await journal.list('slot-1')).map((e) => e.day)).toEqual([1]);
    expect((await journal.list('slot-2')).map((e) => e.day)).toEqual([5]);
    expect(await journal.list('slot-3')).toEqual([]);
  });

  it('survives a reload: a new Journal over the same database reads the same entries', async () => {
    const { journal, raw } = freshJournal();
    const written = await journal.append('slot-1', entry(1));

    expect(await createJournal(() => raw).list('slot-1')).toEqual([written]);
  });

  it('keeps an entry in the Native Language it was written in', async () => {
    const { journal } = freshJournal();

    await journal.append('slot-1', { ...entry(1, 'ラテを注文しました。'), nativeLanguage: 'ja' });

    expect((await journal.list('slot-1'))[0]).toMatchObject({ nativeLanguage: 'ja', recap: { outcome: 'ラテを注文しました。' } });
  });

  it('keeps a conversation whose Recap could not be written, with no Recap', async () => {
    const { journal } = freshJournal();

    await journal.append('slot-1', { ...entry(1), recap: null });

    expect((await journal.list('slot-1'))[0]?.recap).toBeNull();
  });

  it('marks an entry "No Help needed" only when its Help log is empty', async () => {
    const { journal } = freshJournal();

    await journal.append('slot-1', { ...entry(1), helpLog: [{ afterLine: 1, kind: 'hint', text: 'ラテをください。' }] });
    await journal.append('slot-1', entry(2));

    expect((await journal.list('slot-1')).map((e) => e.noHelpNeeded)).toEqual([true, false]);
  });

  it('refuses to write an entry that does not match its schema', async () => {
    const { journal } = freshJournal();

    await expect(journal.append('slot-1', { ...entry(1), nativeLanguage: 'fr' } as unknown as NewJournalEntry)).rejects.toThrow();
    expect(await journal.list('slot-1')).toEqual([]);
  });

  it('fails loudly on an entry for content the game no longer knows', async () => {
    const { journal, raw } = freshJournal();
    const good = await journal.append('slot-1', entry(1));
    await set('slot-1', [{ ...good, npcId: 'retired-barista' }], raw);

    await expect(journal.list('slot-1')).rejects.toThrow(/slot-1/);
  });

  it('fails loudly on a stored entry it cannot read, naming the slot', async () => {
    const { journal, raw } = freshJournal();
    await journal.append('slot-1', entry(1));
    const [good] = await journal.list('slot-1');
    await set('slot-1', [good, { ...good, schemaVersion: JOURNAL_SCHEMA_VERSION + 1 }], raw);

    await expect(journal.list('slot-1')).rejects.toThrow(/slot-1/);
  });

  it('reads an entry from before NPC names were kept as one with no name, and leaves the stored entry as it was', async () => {
    const { journal, raw } = freshJournal();
    const good = await journal.append('slot-1', entry(2));
    const v1: Record<string, unknown> = { ...(await journal.append('slot-1', entry(1))), schemaVersion: 1 };
    delete v1.npcName;
    await set('slot-1', [v1, good], raw);

    const [newest, oldest] = await journal.list('slot-1');

    expect(oldest).toEqual({ ...v1, schemaVersion: JOURNAL_SCHEMA_VERSION, npcName: null });
    expect(newest).toEqual(good);
    expect(await journal.raw('slot-1')).toEqual([v1, good]);
  });

  it('keeps NPC lines with their reading aids, and reads an entry from before readings were kept as one without them', async () => {
    const { journal } = freshJournal();
    const read = entry(1);
    read.lines[0] = { ...read.lines[0]!, reading: [{ base: 'いらっしゃいませ', reading: '' }, { base: '！', reading: '' }] };
    const stored = await journal.append('slot-1', read);
    expect(stored.lines).toEqual(read.lines);

    const v2 = await journal.append('slot-1', entry(2));
    expect(parseJournalEntry({ ...v2, schemaVersion: 2 })).toEqual(v2);
  });

  it('reads any one entry through the same migrations, refusing one it doesn’t know', async () => {
    const { journal } = freshJournal();
    const good = await journal.append('slot-1', entry(1));

    expect(parseJournalEntry({ ...good, schemaVersion: 1, npcName: undefined })).toEqual({ ...good, npcName: null });
    expect(() => parseJournalEntry({ ...good, schemaVersion: JOURNAL_SCHEMA_VERSION + 1 })).toThrow(/newer/);
    expect(() => parseJournalEntry('a page torn out')).toThrow();
  });

  it('takes a whole restored Journal for a slot, in place of any it had', async () => {
    const { journal } = freshJournal();
    const entries = [await journal.append('slot-1', entry(1)), await journal.append('slot-1', entry(2))];
    await journal.append('slot-2', entry(9));

    await journal.restore('slot-2', entries);

    expect(await journal.list('slot-2')).toEqual(await journal.list('slot-1'));
  });

  it('can be removed for one slot, leaving the others alone', async () => {
    const { journal } = freshJournal();
    await journal.append('slot-1', entry(1));
    await journal.append('slot-2', entry(2));

    await journal.remove('slot-1');

    expect(await journal.list('slot-1')).toEqual([]);
    expect(await journal.list('slot-2')).toHaveLength(1);
  });
});
