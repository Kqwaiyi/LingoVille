import { expect, test, type Page } from '@playwright/test';
import { column, dock, npcLine, typeLine } from './barista.ts';
import { startNewGame } from './title.ts';

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });

/** A new game (learning Japanese, as Sam) inside the town office door at 10:00 on Monday, walked up to the clerk's counter. */
async function atTheClerk(page: Page) {
  await startNewGame(page, { path: '/?spawn=town-office&at=10' });
  await page.locator('canvas').click();
  await page.keyboard.down('KeyW');
  await expect(page.getByText('to talk — clerk')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up('KeyW');
}

test('registers the address on F, after which F has nothing more to offer', async ({ page }) => {
  await atTheClerk(page);
  await expect(page.getByText('Press F to register your address')).toBeVisible();

  await page.keyboard.press('KeyF');
  await expect(npcLine(page, 'こんにちは。住所の届け出ですね。お名前をお願いします。')).toBeVisible();
  await typeLine(page, 'Samです');
  await expect(npcLine(page, 'ご住所はどちらですか？')).toBeVisible();
  await typeLine(page, 'さくら荘です');
  await expect(npcLine(page, 'ご国籍はどちらですか？')).toBeVisible();
  await typeLine(page, 'アイルランドです');
  await expect(npcLine(page, 'お名前はSam様、ご住所はさくら荘、ご国籍はアイルランドですね。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');

  await expect(closingCard(page).getByText('Address registered · Mood ↑')).toBeVisible();
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
  await expect(column(page)).toBeHidden();
  await expect(page.getByText('Press F to register your address')).toBeHidden();
});

test('sends a parcel home on E, paying the postage', async ({ page }) => {
  await atTheClerk(page);

  await page.keyboard.press('KeyE');
  await expect(npcLine(page, 'いらっしゃいませ。小包ですか？どちらまで送りますか？')).toBeVisible();
  await typeLine(page, 'アイルランド');
  await expect(npcLine(page, '船便、航空便、EMSがございます。どれになさいますか？')).toBeVisible();
  await typeLine(page, '船便で');
  await expect(npcLine(page, 'アイルランドまで船便で、¥1,200です。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');

  await expect(closingCard(page).getByText('−¥1,200 · Mood ↑')).toBeVisible();
  await expect(dock(page).getByLabel('Money')).toHaveText('¥8,800');
});
