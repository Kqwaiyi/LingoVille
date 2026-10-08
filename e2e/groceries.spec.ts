import { expect, test, type Page } from '@playwright/test';
import { GROCERIES } from '../src/sim/index.ts';
import { column, dock, npcLine, typeLine } from './barista.ts';
import { startNewGame } from './title.ts';

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });
const money = (page: Page) => dock(page).getByLabel('Money');
const basket = (page: Page) => page.getByRole('region', { name: 'Basket' });

/** Walks with `key` held until `prompt` shows. */
async function walkUntil(page: Page, key: string, prompt: string) {
  await page.keyboard.down(key);
  await expect(page.getByText(prompt)).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up(key);
}

/** A new game (learning Japanese) inside the supermarket's door on day 1 at 10:00, walked up to the cabbages. */
async function atTheCabbages(page: Page) {
  await startNewGame(page, { path: '/?spawn=supermarket&at=10' });
  await page.locator('canvas').click();
  await walkUntil(page, 'KeyW', 'to take キャベツ (Cabbage) · ¥360');
}

test('takes groceries off the shelf and pays at the till: bag, points card, read-back and the inventory', async ({ page }) => {
  await atTheCabbages(page);
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyE');
  await expect(basket(page)).toContainText('キャベツ (Cabbage) ×2');
  await expect(basket(page)).toContainText('Total ¥720');

  await walkUntil(page, 'KeyA', 'to pay — Cashier');
  await page.keyboard.press('KeyE');
  await expect(npcLine(page, 'いらっしゃいませ。レジ袋はご利用ですか？')).toBeVisible();
  await typeLine(page, 'はい');
  await expect(npcLine(page, 'ポイントカードはお持ちですか？')).toBeVisible();
  await typeLine(page, 'いいえ');
  await expect(npcLine(page, '合計¥720、レジ袋あり、ポイントカードなしですね。よろしいですか？')).toBeVisible();
  // Nothing is charged before the Player confirms.
  await expect(money(page)).toHaveText('¥10,000');
  await typeLine(page, 'はい');

  await expect(closingCard(page).getByText('Cabbage ×2 · −¥720 · Mood ↑')).toBeVisible();
  await expect(money(page)).toHaveText('¥9,280');
  await expect(basket(page)).toBeHidden();
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();

  await dock(page).getByRole('button', { name: 'Inventory (2)' }).click();
  const inventory = page.getByRole('region', { name: 'Inventory' });
  await expect(inventory).toContainText('キャベツ (Cabbage) ×2');
  await expect(inventory).toContainText(`Fresh until day ${1 + GROCERIES.expiryDays}`);
});

test('puts a cabbage back at the till, and the cashier reads back the new total', async ({ page }) => {
  await atTheCabbages(page);
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyE');
  await walkUntil(page, 'KeyA', 'to pay — Cashier');
  await page.keyboard.press('KeyE');
  await expect(npcLine(page, 'いらっしゃいませ。レジ袋はご利用ですか？')).toBeVisible();
  await typeLine(page, 'いいえ');
  await typeLine(page, 'いいえ');
  await expect(npcLine(page, '合計¥720、レジ袋なし、ポイントカードなしですね。よろしいですか？')).toBeVisible();

  const putBack = basket(page).getByRole('button', { name: 'Put one キャベツ (Cabbage) back' });
  await putBack.click();
  await expect(npcLine(page, '合計¥360、レジ袋なし、ポイントカードなしですね。よろしいですか？')).toBeVisible();
  // The last one stays on the counter: leaving the till puts it back.
  await expect(putBack).toBeDisabled();
  await typeLine(page, 'はい');

  await expect(closingCard(page).getByText('Cabbage · −¥360 · Mood ↑')).toBeVisible();
  await expect(money(page)).toHaveText('¥9,640');
});

test('with shopping in the basket, F asks the cashier where something else is', async ({ page }) => {
  await atTheCabbages(page);
  await page.keyboard.press('KeyE');
  await walkUntil(page, 'KeyA', 'to ask where something is');
  await page.keyboard.press('KeyF');
  await expect(npcLine(page, 'いらっしゃいませ。何かお探しですか？')).toBeVisible();
  await typeLine(page, 'うどんはどこですか');
  await typeLine(page, 'はい');
  await expect(closingCard(page).getByText('Udon noodles: marked on the shelf · Mood ↑')).toBeVisible();
  await expect(basket(page)).toContainText('キャベツ (Cabbage) ×1');
});

test('asks the cashier where the noodles are, and they mark the shelf', async ({ page }) => {
  await atTheCabbages(page);
  // With nothing in the basket, the cashier helps find something instead.
  await walkUntil(page, 'KeyA', 'to talk — Cashier');
  await page.keyboard.press('KeyE');
  await expect(npcLine(page, 'いらっしゃいませ。何かお探しですか？')).toBeVisible();

  await typeLine(page, 'うどんはどこですか');
  await expect(npcLine(page, 'うどんですね？')).toBeVisible();
  await typeLine(page, 'はい');
  await expect(npcLine(page, 'うどんはあちらの棚にございます。')).toBeVisible();

  await expect(closingCard(page).getByText('Udon noodles: marked on the shelf · Mood ↑')).toBeVisible();
  await expect(money(page)).toHaveText('¥10,000');
});

test('buys a bento over the convenience store counter, late at night, and Hunger rises', async ({ page }) => {
  // The convenience store never closes.
  await startNewGame(page, { path: '/?spawn=convenience-store&at=23' });
  await page.locator('canvas').click();
  await walkUntil(page, 'KeyW', 'to talk — Clerk');
  const hunger = dock(page).getByRole('meter', { name: 'Hunger' });
  await page.keyboard.press('KeyE');
  await expect(npcLine(page, 'いらっしゃいませ！ホットスナックやお弁当はいかがですか？')).toBeVisible();
  const before = Number(await hunger.getAttribute('aria-valuenow'));

  await typeLine(page, 'のり弁当 ください');
  await expect(npcLine(page, 'のり弁当ですね。720円です。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');

  await expect(closingCard(page).getByText('Seaweed bento box · −¥720 · Mood ↑')).toBeVisible();
  await expect(money(page)).toHaveText('¥9,280');
  expect(Number(await hunger.getAttribute('aria-valuenow'))).toBeGreaterThan(before);
});

test('brings a faulty cabbage back to the till on R, and gets its price back', async ({ page }) => {
  await atTheCabbages(page);
  await page.keyboard.press('KeyE');
  await walkUntil(page, 'KeyA', 'to pay — Cashier');
  await page.keyboard.press('KeyE');
  await typeLine(page, 'いいえ');
  await typeLine(page, 'いいえ');
  await typeLine(page, 'はい');
  await expect(money(page)).toHaveText('¥9,640');
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
  await expect(column(page)).toBeHidden();

  await expect(page.getByText('Press R to bring something back')).toBeVisible();
  await page.keyboard.press('KeyR');
  await expect(npcLine(page, 'いらっしゃいませ。返品でしょうか？')).toBeVisible();
  await typeLine(page, 'キャベツが傷んでいました');
  await expect(npcLine(page, 'キャベツですね。360円を返金いたします。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');

  await expect(closingCard(page).getByText('+¥360 · Mood ↑')).toBeVisible();
  await expect(money(page)).toHaveText('¥10,000');
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
  await expect(page.getByText('Press R to bring something back')).toBeHidden();
});
