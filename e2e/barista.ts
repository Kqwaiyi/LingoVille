import { expect, type Page } from '@playwright/test';

export const column = (page: Page) => page.getByRole('complementary', { name: 'Conversation' });
export const chat = (page: Page) => column(page).getByRole('log', { name: 'Chat' });
export const field = (page: Page) => column(page).getByRole('textbox', { name: 'Typed reply' });
export const dock = (page: Page) => page.getByRole('region', { name: 'Dock' });

// What the scripted fake barista says in the ja pack (mock mode).
export const GREETING = 'いらっしゃいませ！ご注文はお決まりですか？';

/** Starts at the café door and walks up to the counter until the barista can be talked to. */
export async function walkToTheBarista(page: Page) {
  await page.goto('/?spawn=cafe');
  await page.locator('canvas').click();
  await page.keyboard.down('KeyW');
  await expect(page.getByText('to talk — barista')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up('KeyW');
}

export async function talkToTheBarista(page: Page) {
  await walkToTheBarista(page);
  await page.keyboard.press('KeyE');
  await expect(column(page)).toBeVisible();
  // The barista always speaks first.
  await expect(chat(page).getByText(GREETING)).toBeVisible();
}

/** The Typed Fallback: T focuses the field, then the line is typed and sent with Enter. */
export async function typeLine(page: Page, line: string) {
  await page.keyboard.press('KeyT');
  await field(page).fill(line);
  await page.keyboard.press('Enter');
}
