import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCredits } from '../src/ui/parseCredits.ts';

// The in-game credits screen reads `CREDITS.md` itself (`src/ui/credits.ts`), so the two can't drift apart. These hold
// the file to the shape the screen reads: a table under each licence's heading, and every CC-BY asset credited as its
// licence asks.

const creditsMarkdown = readFileSync('CREDITS.md', 'utf8');
const CREDITS = parseCredits(creditsMarkdown);
const tableRows = (section: string) =>
  section
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .slice(2);

describe('the credits screen', () => {
  it('lists every row of every table in CREDITS.md', () => {
    const [, ccBy = '', cc0 = ''] = creditsMarkdown.split(/^## (?:CC-BY|CC0)$/m);

    expect(CREDITS.ccBy).toHaveLength(tableRows(ccBy).length);
    expect(CREDITS.cc0).toHaveLength(tableRows(cc0).length);
    expect(CREDITS.cc0.length).toBeGreaterThan(0);
    expect(CREDITS.cc0).toContainEqual(expect.objectContaining({ asset: 'Building Kit', creator: 'Kenney', source: 'https://kenney.nl/assets/building-kit' }));
  });

  it('credits each CC-BY asset with its creator, title, source and licence', () => {
    for (const credit of CREDITS.ccBy) {
      expect(credit.asset, JSON.stringify(credit)).not.toBe('');
      expect(credit.creator, JSON.stringify(credit)).not.toBe('');
      expect(credit.source, JSON.stringify(credit)).toMatch(/^https?:\/\//);
      expect(credit.licence, JSON.stringify(credit)).toMatch(/^CC BY/);
    }
  });

  it('reads a CC-BY table once one is added', () => {
    const credits = parseCredits(
      [
        '# Credits',
        '## CC-BY',
        '| Asset | Creator | Source | Licence | Used for |',
        '| --- | --- | --- | --- | --- |',
        '| Rain Loop | A. Person | https://example.test/rain | CC BY 4.0 | Rain at night |',
        '## CC0',
        'None.',
      ].join('\n'),
    );

    expect(credits).toEqual({
      ccBy: [{ asset: 'Rain Loop', creator: 'A. Person', source: 'https://example.test/rain', licence: 'CC BY 4.0', usedFor: 'Rain at night' }],
      cc0: [],
    });
  });

  it('fails loudly on a table it can’t read, rather than showing an empty screen', () => {
    expect(() => parseCredits(['## CC0', '| Asset | Maker |', '| --- | --- |', '| Kit | Kenney |'].join('\n'))).toThrow();
  });
});
