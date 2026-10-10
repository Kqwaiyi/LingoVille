import { expect, type Page } from '@playwright/test';
import { startNewGame, type NewGame } from './title.ts';
import { walkUntil } from './walk.ts';

export const column = (page: Page) => page.getByRole('complementary', { name: 'Conversation' });
export const chat = (page: Page) => column(page).getByRole('log', { name: 'Chat' });
export const field = (page: Page) => column(page).getByRole('textbox', { name: 'Typed reply' });
export const dock = (page: Page) => page.getByRole('region', { name: 'Dock' });
/**
 * A finished NPC line in the chat. Its text is interleaved with its reading aid
 * (注文ちゅうもん), so it's found by the plain line its 🔊 Replay says.
 */
export const npcLine = (page: Page, text: string) => chat(page).getByRole('button', { name: `Replay “${text}”`, exact: true });

// What the scripted fake barista says in the ja pack (mock mode).
export const GREETING = 'いらっしゃいませ！ご注文はお決まりですか？';

/**
 * Starts a new game at the café door at 09:00 (learning Japanese, or as `answers`
 * say) and walks up to the counter until the barista can be talked to. At 07:00,
 * when the First Morning starts, the de café isn't open yet. The First Morning
 * is under way unless `answers` skip the tutorial, so the first order there can't fail.
 */
export async function walkToTheBarista(page: Page, answers: Omit<NewGame, 'path'> = {}) {
  await startNewGame(page, { path: '/?spawn=cafe&at=9', ...answers });
  await page.locator('canvas').click();
  await walkUntil(page, 'KeyW', 'to talk — barista');
}

export async function talkToTheBarista(page: Page, answers: Omit<NewGame, 'path'> = {}) {
  await walkToTheBarista(page, answers);
  await page.keyboard.press('KeyE');
  await expect(column(page)).toBeVisible();
  // The barista always speaks first.
  await expect(npcLine(page, GREETING)).toBeVisible();
}

/**
 * The Typed Fallback: T focuses the field, then the line is typed and sent with Enter. Only once the NPC can take a
 * turn: the field takes no line while they say goodbye or the connection is coming back.
 */
export async function typeLine(page: Page, line: string) {
  await expect(field(page)).toBeEditable();
  await page.keyboard.press('KeyT');
  await expect(field(page)).toBeFocused();
  await field(page).fill(line);
  await page.keyboard.press('Enter');
}
