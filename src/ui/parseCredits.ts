import { z } from 'zod';

// Reads `CREDITS.md`: each licence has its heading and a table under it. `tooling/credits.test.ts` holds the file to
// that shape.

const COLUMNS = { Asset: 'asset', Creator: 'creator', Source: 'source', Licence: 'licence', 'Used for': 'usedFor' } as const;

const CreditSchema = z.object({
  asset: z.string().min(1),
  creator: z.string().min(1),
  source: z.string().min(1),
  licence: z.string().min(1),
  usedFor: z.string().min(1),
});

export type Credit = z.infer<typeof CreditSchema>;
export type Credits = { ccBy: Credit[]; cc0: Credit[] };

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());

/** The rows of the table in one licence's section, or none. A CC0 table needs no Licence column. */
function readTable(section: string, licence: string | null): Credit[] {
  const [header, , ...rows] = section.split('\n').filter((line) => line.trim().startsWith('|'));
  if (!header) return [];
  const keys = cells(header).map((name) => {
    if (!(name in COLUMNS)) throw new Error(`CREDITS.md: no such column as "${name}"`);
    return COLUMNS[name as keyof typeof COLUMNS];
  });
  return rows.map((row) => {
    const credit = Object.fromEntries([...(licence ? [['licence', licence]] : []), ...keys.map((key, i) => [key, cells(row)[i] ?? ''])]);
    return CreditSchema.parse(credit);
  });
}

/** The CC-BY and CC0 tables in `CREDITS.md`. Throws on a table it can't read. */
export function parseCredits(markdown: string): Credits {
  const section = (heading: string) => markdown.split(/^## /m).find((part) => part.startsWith(`${heading}\n`) || part.startsWith(`${heading}\r\n`)) ?? '';
  return { ccBy: readTable(section('CC-BY'), null), cc0: readTable(section('CC0'), 'CC0 1.0') };
}
