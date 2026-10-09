import { expect, test, type Page } from './test.ts';
import { column, dock, npcLine, typeLine } from './barista.ts';
import { startNewGame } from './title.ts';
import { walkUntil } from './walk.ts';

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });

/** A new game (learning Japanese) inside the bookshop's door at 10:00, walked up to the shopkeeper. */
async function atTheShopkeeper(page: Page) {
  await startNewGame(page, { path: '/?spawn=bookshop&at=10' });
  await page.locator('canvas').click();
  await walkUntil(page, 'KeyW', 'to talk — shopkeeper');
  await expect(page.getByText('to buy a gift')).toBeVisible();
  await expect(page.getByText('Press T to chat')).toBeVisible();
}

test('buys a magazine on E: a Comfort Purchase that lifts Mood', async ({ page }) => {
  await atTheShopkeeper(page);
  await page.keyboard.press('KeyE');
  await expect(npcLine(page, 'いらっしゃいませ。本をお探しですか？')).toBeVisible();
  await typeLine(page, '雑誌をください');
  await expect(npcLine(page, '雑誌ですね。600円です。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');

  await expect(closingCard(page).getByText('Magazine · −¥600 · Mood ↑')).toBeVisible();
  await expect(dock(page).getByLabel('Money')).toHaveText('¥9,400');
});

test('buys wrapped flowers on F, and they go into the inventory, ready to give', async ({ page }) => {
  await atTheShopkeeper(page);
  await page.keyboard.press('KeyF');
  await expect(npcLine(page, 'いらっしゃいませ。贈り物をお探しですか？')).toBeVisible();
  await typeLine(page, '花束をください');
  await expect(npcLine(page, '花束ですね。プレゼント用にお包みしましょうか？')).toBeVisible();
  await typeLine(page, 'はい');
  await expect(npcLine(page, '花束、1200円、お包みありですね。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');

  await expect(closingCard(page).getByText('Bouquet of flowers · −¥1,200 · Mood ↑')).toBeVisible();
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
  await dock(page).getByRole('button', { name: 'Inventory (1)' }).click();
  await expect(page.getByRole('region', { name: 'Inventory' })).toContainText('花束 (Bouquet of flowers) ×1');
});

test('gives the flowers to the shopkeeper in a chat, after asking what they would love', async ({ page }) => {
  await atTheShopkeeper(page);
  await page.keyboard.press('KeyF');
  await typeLine(page, '花束をください');
  await expect(npcLine(page, '花束ですね。プレゼント用にお包みしましょうか？')).toBeVisible();
  await typeLine(page, 'はい');
  await expect(npcLine(page, '花束、1200円、お包みありですね。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
  await expect(column(page)).toBeHidden();

  await page.keyboard.press('KeyT');
  await expect(npcLine(page, 'こんにちは！今日はいい天気ですね。')).toBeVisible();
  await typeLine(page, '好きなプレゼントは何ですか');
  await expect(npcLine(page, 'プレゼントなら、アロマキャンドルが一番うれしいです！')).toBeVisible();

  await column(page).getByRole('button', { name: '🎁 Gift' }).click();
  await column(page).getByRole('region', { name: 'Give a gift' }).getByRole('button', { name: '花束 (Bouquet of flowers)' }).click();

  await expect(npcLine(page, 'わあ、ありがとうございます！')).toBeVisible();
  await expect(column(page).getByRole('button', { name: '🎁 Gift' })).toBeHidden();
  await expect(dock(page).getByRole('button', { name: 'Inventory (0)' })).toBeVisible();
});
