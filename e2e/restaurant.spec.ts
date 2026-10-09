import { expect, test, type Page } from './test.ts';
import { column, dock, npcLine, typeLine } from './barista.ts';
import { startNewGame } from './title.ts';
import { walkUntil } from './walk.ts';

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });

/** A new game (learning Japanese) inside the restaurant's door at 12:00 on day 3, a Wednesday, walked up to the server. */
async function atTheServer(page: Page) {
  await startNewGame(page, { path: '/?spawn=restaurant&at=12&day=3' });
  await page.locator('canvas').click();
  await walkUntil(page, 'KeyD', 'to talk — server');
}

/** Closes the closing card, back to the server. */
async function skipRecap(page: Page) {
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
}

test('gets a table on E, orders a meal onto the bill, then pays the bill', async ({ page }) => {
  await atTheServer(page);

  await page.keyboard.press('KeyE');
  await expect(npcLine(page, 'いらっしゃいませ！何名様ですか？')).toBeVisible();
  await typeLine(page, '一人です');
  await typeLine(page, '窓際がいいです');
  await expect(npcLine(page, '1名様、窓際の席ですね。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');
  await expect(closingCard(page).getByText('Mood ↑')).toBeVisible();
  await skipRecap(page);
  await expect(page.getByText('to ask for a recommendation')).toBeVisible();

  await page.keyboard.press('KeyE');
  await typeLine(page, '焼き鮭定食をください');
  await expect(npcLine(page, '焼き鮭定食ですね。1200円です。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');
  // Eaten now, paid for with the bill.
  await expect(closingCard(page).getByText('Grilled salmon set meal · Mood ↑')).toBeVisible();
  await expect(dock(page).getByLabel('Money')).toHaveText('¥10,000');
  await skipRecap(page);
  await expect(page.getByText('to pay — server')).toBeVisible();

  await page.keyboard.press('KeyE');
  await expect(npcLine(page, 'お会計ですね。合計¥1,200になります。お支払いは現金とカード、どちらになさいますか？')).toBeVisible();
  await typeLine(page, '現金で');
  await typeLine(page, 'はい');

  await expect(closingCard(page).getByText('−¥1,200 · Mood ↑')).toBeVisible();
  await expect(dock(page).getByLabel('Money')).toHaveText('¥8,800');
});
