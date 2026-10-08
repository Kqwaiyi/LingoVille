import { expect, test, type Page } from './test.ts';
import { column, dock, npcLine, talkToTheBarista, typeLine } from './barista.ts';
import { reloadAndContinue, startNewGame, titleMenu } from './title.ts';

const money = (page: Page) => dock(page).getByLabel('Money');
const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });

test('a browser with no saves is offered only New game', async ({ page }) => {
  await page.goto('/');

  await expect(titleMenu(page).getByRole('button', { name: 'New game' })).toBeEnabled();
  await expect(titleMenu(page).getByRole('button', { name: 'Continue' })).toHaveCount(0);
});

test('the game saves itself, with a brief "Saved ✓" under the clock', async ({ page }) => {
  await startNewGame(page);

  await expect(dock(page).getByText('Saved ✓')).toBeVisible();
  await expect(dock(page).getByText('Saved ✓')).toBeHidden({ timeout: 5_000 });
});

test('order a drink, reload, Continue: the money and the place are as they were', async ({ page }) => {
  await talkToTheBarista(page);
  await typeLine(page, 'ホットラテ ください');
  await expect(npcLine(page, 'ホットラテですね。450円です。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');
  await expect(closingCard(page)).toBeVisible();
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
  await expect(money(page)).toHaveText('¥9,550');

  await reloadAndContinue(page);

  await expect(money(page)).toHaveText('¥9,550');
  // Back at the café's entrance: a few steps forward reach the barista.
  await page.locator('canvas').click();
  await page.keyboard.down('KeyW');
  await expect(page.getByText('to talk — barista')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up('KeyW');
});

test('a reload mid-conversation comes back as if the conversation never happened', async ({ page }) => {
  await talkToTheBarista(page);
  await typeLine(page, 'ホットラテ ください');
  await expect(npcLine(page, 'ホットラテですね。450円です。よろしいですか？')).toBeVisible();

  await reloadAndContinue(page);

  await expect(column(page)).toBeHidden();
  await expect(money(page)).toHaveText('¥10,000');
});
