import { describe, expect, it } from 'vitest';
import { RESOURCES } from './index.ts';

type Tree = { [key: string]: string | Tree };

/** Every string in a resource by its dotted key, as `t()` looks it up. */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const strings = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') strings.set(path, value);
    else for (const [nested, text] of flatten(value, path)) strings.set(nested, text);
  }
  return strings;
}

/** What the UI fills in or wraps: `{{name}}` placeholders and `<tag>` markers. */
const slots = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}|<\/?(\w+)>/g)].map((match) => match[0].replace(/\s/g, '')).sort();

const english = flatten(RESOURCES.en);
const others = (['ja', 'zh', 'de'] as const).map((language) => [language, flatten(RESOURCES[language])] as const);

describe('UI strings', () => {
  it.each(others)('%s has every English key, and no others', (_, strings) => {
    expect([...strings.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it.each([['en', english] as const, ...others])('%s has no empty strings', (_, strings) => {
    expect([...strings].filter(([, text]) => text.trim() === '').map(([key]) => key)).toEqual([]);
  });

  it.each(others)('%s fills in and wraps the same things as English', (_, strings) => {
    const mismatched = [...english].filter(([key, text]) => strings.has(key) && slots(strings.get(key)!).join() !== slots(text).join());
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });
});
