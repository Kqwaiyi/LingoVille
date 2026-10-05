import { describe, expect, it } from 'vitest';
import { namesMatch } from './index.ts';

describe('namesMatch: the name an NPC heard against the name from setup', () => {
  it('matches the same name', () => {
    expect(namesMatch('Sam', 'Sam')).toBe(true);
  });

  it('ignores case, spacing, punctuation and accents', () => {
    expect(namesMatch('  sam. ', 'Sam')).toBe(true);
    expect(namesMatch('Anne-Marie', 'anne marie')).toBe(true);
    expect(namesMatch('Zoe', 'Zoë')).toBe(true);
  });

  it('matches across full-width letters and between katakana and hiragana', () => {
    expect(namesMatch('Ｓａｍ', 'Sam')).toBe(true);
    expect(namesMatch('さむ', 'サム')).toBe(true);
  });

  it('matches one part of a name given in full', () => {
    expect(namesMatch('Sam', 'Sam Lee')).toBe(true);
    expect(namesMatch('Lee', 'Sam Lee')).toBe(true);
  });

  it('does not match a different name, or nothing at all', () => {
    expect(namesMatch('Pam', 'Sam')).toBe(false);
    expect(namesMatch('Samuel', 'Sam')).toBe(false);
    expect(namesMatch('', 'Sam')).toBe(false);
    expect(namesMatch('!', '!')).toBe(false);
  });
});
